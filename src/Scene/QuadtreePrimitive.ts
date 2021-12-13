/* eslint-disable no-mixed-operators */
import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { defaultValue } from '@/Core/defaultValue';
import { defined } from '@/Core/defined';
import { Ellipsoid } from '@/Core/Ellipsoid';
import { Event } from '@/Core/Event';
import { getTimestamp } from '@/Core/getTimestamp';
import { Rectangle } from '@/Core/Rectangle';
import { SceneMode } from '@/Core/SceneMode';
import { Visibility } from '@/Core/Visibility';
import { Ray } from 'three';
import { FrameState } from './FrameState';
import { GlobeSurfaceTileProvider } from './GlobeSurfaceTileProvider';
import { QuadtreeOccluders } from './QuadtreeOccluders';
import { QuadtreeTile } from './QuadtreeTile';
import { QuadtreeTileLoadState } from './QuadtreeTileLoadState';
import { QuadtreeTileProvider } from './QuadtreeTileProvider';
import { TileReplacementQueue } from './TileReplacementQueue';

const clearTileLoadQueue = function clearTileLoadQueue (primitive: any) {
    const debug = primitive._debug;
    debug.maxDepth = 0;
    debug.tilesVisited = 0;
    debug.tilesCulled = 0;
    debug.tilesRendered = 0;
    debug.tilesWaitingForChildren = 0;

    primitive._tileLoadQueueHigh.length = 0;
    primitive._tileLoadQueueMedium.length = 0;
    primitive._tileLoadQueueLow.length = 0;
};

const invalidateAllTiles = function invalidateAllTiles (primitive: any) {
    // Clear the replacement queue
    const replacementQueue = primitive._tileReplacementQueue;
    replacementQueue.head = undefined;
    replacementQueue.tail = undefined;
    replacementQueue.count = 0;

    clearTileLoadQueue(primitive);

    // Free and recreate the level zero tiles.
    const levelZeroTiles = primitive._levelZeroTiles;
    if (defined(levelZeroTiles)) {
        for (let i = 0; i < levelZeroTiles.length; ++i) {
            const tile = levelZeroTiles[i];
            const customData = tile.customData;
            const customDataLength = customData.length;

            for (let j = 0; j < customDataLength; ++j) {
                const data = customData[j];
                data.level = 0;
                primitive._addHeightCallbacks.push(data);
            }

            levelZeroTiles[i].freeResources();
        }
    }

    primitive._levelZeroTiles = undefined;

    primitive._tileProvider.cancelReprojections();
};

// var scratchRay = new Ray();
// var scratchCartographic = new Cartographic();
// var scratchPosition = new Cartesian3();
// var scratchArray = [];

const addTileToRenderList = function addTileToRenderList (primitive: any, tile: any) {
    primitive._tilesToRender.push(tile);
    ++primitive._debug.tilesRendered;
};

function processTileLoadQueue (primitive: any, frameState: FrameState) {
    const tileLoadQueueHigh = primitive._tileLoadQueueHigh;
    const tileLoadQueueMedium = primitive._tileLoadQueueMedium;
    const tileLoadQueueLow = primitive._tileLoadQueueLow;

    if (tileLoadQueueHigh.length === 0 && tileLoadQueueMedium.length === 0 && tileLoadQueueLow.length === 0) {
        return;
    }

    // console.log(tileLoadQueueHigh.length)
    // console.log(tileLoadQueueHigh.length);
    // Remove any tiles that were not used this frame beyond the number
    // we're allowed to keep.
    primitive._tileReplacementQueue.trimTiles(primitive.tileCacheSize);

    const endTime = getTimestamp() + primitive._loadQueueTimeSlice;
    const tileProvider = primitive._tileProvider;

    processSinglePriorityLoadQueue(primitive, frameState, tileProvider, endTime, tileLoadQueueHigh);
    processSinglePriorityLoadQueue(primitive, frameState, tileProvider, endTime, tileLoadQueueMedium);
    processSinglePriorityLoadQueue(primitive, frameState, tileProvider, endTime, tileLoadQueueLow);
}

function processSinglePriorityLoadQueue (primitive: any, frameState: FrameState, tileProvider: any, endTime: number, loadQueue: any[]) {
    for (let i = 0, len = loadQueue.length; i < len && getTimestamp() < endTime; ++i) {
        const tile = loadQueue[i];
        primitive._tileReplacementQueue.markTileRendered(tile);
        tileProvider.loadTile(frameState, tile);
    }
}

const scratchRay = new Ray();
const scratchCartographic = new Cartographic();
const scratchPosition = new Cartesian3();
const scratchArray: any[] = [];

const updateHeights = (primitive: any, frameState:FrameState) => {
    const tryNextFrame = scratchArray;
    tryNextFrame.length = 0;
    const tilesToUpdateHeights = primitive._tileToUpdateHeights;
    const terrainProvider = primitive._tileProvider.terrainProvider;

    const startTime = getTimestamp();
    const timeSlice = primitive._updateHeightsTimeSlice;
    const endTime = startTime + timeSlice;

    const mode = frameState.mode;
    const projection = frameState.mapProjection;
    const ellipsoid = projection.ellipsoid;
    let i;

    while (tilesToUpdateHeights.length > 0) {
        const tile = tilesToUpdateHeights[0];
        if (tile.state !== QuadtreeTileLoadState.DONE) {
            tryNextFrame.push(tile);
            tilesToUpdateHeights.shift();
            primitive._lastTileIndex = 0;
            continue;
        }
        const customData = tile.customData;
        const customDataLength = customData.length;

        let timeSliceMax = false;
        for (i = primitive._lastTileIndex; i < customDataLength; ++i) {
            const data = customData[i];

            if (tile.level > data.level) {
                if (!defined(data.positionOnEllipsoidSurface)) {
                    // cartesian has to be on the ellipsoid surface for `ellipsoid.geodeticSurfaceNormal`
                    data.positionOnEllipsoidSurface = Cartesian3.fromRadians(data.positionCartographic.longitude, data.positionCartographic.latitude, 0.0, ellipsoid);
                }

                if (mode === SceneMode.SCENE3D) {
                    const surfaceNormal = ellipsoid.geodeticSurfaceNormal(data.positionOnEllipsoidSurface, scratchRay.direction);

                    // compute origin point

                    // Try to find the intersection point between the surface normal and z-axis.
                    // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
                    const rayOrigin = ellipsoid.getSurfaceNormalIntersectionWithZAxis(data.positionOnEllipsoidSurface, 11500.0, scratchRay.origin);

                    // Theoretically, not with Earth datums, the intersection point can be outside the ellipsoid
                    if (!defined(rayOrigin)) {
                        // intersection point is outside the ellipsoid, try other value
                        // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
                        const magnitude = Math.min(defaultValue(tile.data.minimumHeight, 0.0), -11500.0);

                        // multiply by the *positive* value of the magnitude
                        const vectorToMinimumPoint = Cartesian3.multiplyByScalar(surfaceNormal, Math.abs(magnitude) + 1, scratchPosition);
                        Cartesian3.subtract(data.positionOnEllipsoidSurface, vectorToMinimumPoint, scratchRay.origin);
                    }
                } else {
                    Cartographic.clone(data.positionCartographic, scratchCartographic);

                    // minimum height for the terrain set, need to get this information from the terrain provider
                    scratchCartographic.height = -11500.0;
                    projection.project(scratchCartographic, scratchPosition);
                    Cartesian3.fromElements(scratchPosition.z, scratchPosition.x, scratchPosition.y, scratchPosition);
                    Cartesian3.clone(scratchPosition, scratchRay.origin);
                    Cartesian3.clone(Cartesian3.UNIT_X, scratchRay.direction);
                }

                const position = tile.data.pick(scratchRay, mode, projection, false, scratchPosition);
                if (defined(position)) {
                    data.callback(position);
                    data.level = tile.level;
                }
            } else if (tile.level === data.level) {
                const children = tile.children;
                const childrenLength = children.length;

                let child;
                for (let j = 0; j < childrenLength; ++j) {
                    child = children[j];
                    if (Rectangle.contains(child.rectangle, data.positionCartographic)) {
                        break;
                    }
                }

                const tileDataAvailable = terrainProvider.getTileDataAvailable(child.x, child.y, child.level);
                const parentTile = tile.parent;
                if (defined(tileDataAvailable) && !tileDataAvailable ||
                    defined(parentTile) && defined(parentTile.data) && defined(parentTile.data.terrainData) &&
                     !parentTile.data.terrainData.isChildAvailable(parentTile.x, parentTile.y, child.x, child.y)) {
                    data.removeFunc();
                }
            }

            if (getTimestamp() >= endTime) {
                timeSliceMax = true;
                break;
            }
        }

        if (timeSliceMax) {
            primitive._lastTileIndex = i;
            break;
        } else {
            primitive._lastTileIndex = 0;
            tilesToUpdateHeights.shift();
        }
    }
    for (i = 0; i < tryNextFrame.length; i++) {
        tilesToUpdateHeights.push(tryNextFrame[i]);
    }
};

function createRenderCommandsForSelectedTiles (primitive: any, frameState: FrameState) {
    const tileProvider = primitive._tileProvider;
    const tilesToRender = primitive._tilesToRender;
    const tilesToUpdateHeights = primitive._tileToUpdateHeights;

    for (let i = 0, len = tilesToRender.length; i < len; ++i) {
        const tile = tilesToRender[i];
        tileProvider.showTileThisFrame(tile, frameState);

        if (tile._frameRendered !== frameState.frameNumber - 1) {
            tilesToUpdateHeights.push(tile);
        }
        tile._frameRendered = frameState.frameNumber;
    }
}

function screenSpaceError (primitive: any, frameState: FrameState, tile: any) {
    const maxGeometricError = primitive._tileProvider.getLevelMaximumGeometricError(
        tile.level
    );

    const distance = tile._distance;
    const height = frameState.scene.drawingBufferSize.height;
    const sseDenominator = frameState.camera.sseDenominator;

    let error = (maxGeometricError * height) / (distance * sseDenominator);

    // if (frameState.fog.enabled) {
    //     error -=
    //       CesiumMath.fog(distance, frameState.fog.density) * frameState.fog.sse;
    // }

    error /= frameState.pixelRatio;

    return error;
}

const queueChildTileLoad = function queueChildTileLoad (primitive: any, childTile: any) {
    primitive._tileReplacementQueue.markTileRendered(childTile);
    if (childTile.needsLoading) {
        if (childTile.renderable) {
            primitive._tileLoadQueueLow.push(childTile);
        } else {
            // A tile blocking refine loads with high priority
            primitive._tileLoadQueueHigh.push(childTile);
        }
    }
};

const queueChildLoadNearToFar = function queueChildLoadNearToFar (primitive: any, cameraPosition: any, southwest: any, southeast: any, northwest: any, northeast: any) {
    if (cameraPosition.longitude < southwest.east) {
        if (cameraPosition.latitude < southwest.north) {
            // Camera in southwest quadrant
            queueChildTileLoad(primitive, southwest);
            queueChildTileLoad(primitive, southeast);
            queueChildTileLoad(primitive, northwest);
            queueChildTileLoad(primitive, northeast);
        } else {
            // Camera in northwest quadrant
            queueChildTileLoad(primitive, northwest);
            queueChildTileLoad(primitive, southwest);
            queueChildTileLoad(primitive, northeast);
            queueChildTileLoad(primitive, southeast);
        }
    } else if (cameraPosition.latitude < southwest.north) {
        // Camera southeast quadrant
        queueChildTileLoad(primitive, southeast);
        queueChildTileLoad(primitive, southwest);
        queueChildTileLoad(primitive, northeast);
        queueChildTileLoad(primitive, northwest);
    } else {
        // Camera in northeast quadrant
        queueChildTileLoad(primitive, northeast);
        queueChildTileLoad(primitive, northwest);
        queueChildTileLoad(primitive, southeast);
        queueChildTileLoad(primitive, southwest);
    }
};

const visitTile = function visitTile (primitive: any, frameState: FrameState, tile: any) {
    const debug = primitive._debug;

    ++debug.tilesVisited;

    primitive._tileReplacementQueue.markTileRendered(tile);
    tile._updateCustomData(frameState.frameNumber);

    if (tile.level > debug.maxDepth) {
        debug.maxDepth = tile.level;
    }

    if (screenSpaceError(primitive, frameState, tile) < primitive.maximumScreenSpaceError) {
        // This tile meets SSE requirements, so render it.
        if (tile.needsLoading) {
            // Rendered tile meeting SSE loads with medium priority.
            primitive._tileLoadQueueMedium.push(tile);
        }
        addTileToRenderList(primitive, tile);
        return;
    }

    const southwestChild = tile.southwestChild;
    const southeastChild = tile.southeastChild;
    const northwestChild = tile.northwestChild;
    const northeastChild = tile.northeastChild;
    const allAreRenderable = southwestChild.renderable && southeastChild.renderable &&
                           northwestChild.renderable && northeastChild.renderable;
    const allAreUpsampled = southwestChild.upsampledFromParent && southeastChild.upsampledFromParent &&
                          northwestChild.upsampledFromParent && northeastChild.upsampledFromParent;

    if (allAreRenderable) {
        if (allAreUpsampled) {
            // No point in rendering the children because they're all upsampled.  Render this tile instead.
            addTileToRenderList(primitive, tile);

            // Load the children even though we're (currently) not going to render them.
            // A tile that is "upsampled only" right now might change its tune once it does more loading.
            // A tile that is upsampled now and forever should also be done loading, so no harm done.
            queueChildLoadNearToFar(primitive, frameState.camera.positionCartographic, southwestChild, southeastChild, northwestChild, northeastChild);

            if (tile.needsLoading) {
                // Rendered tile that's not waiting on children loads with medium priority.
                primitive._tileLoadQueueMedium.push(tile);
            }
        } else {
            // SSE is not good enough and children are loaded, so refine.
            // No need to add the children to the load queue because they'll be added (if necessary) when they're visited.
            visitVisibleChildrenNearToFar(primitive, southwestChild, southeastChild, northwestChild, northeastChild, frameState);

            if (tile.needsLoading) {
                // Tile is not rendered, so load it with low priority.
                primitive._tileLoadQueueLow.push(tile);
            }
        }
    } else {
        // We'd like to refine but can't because not all of our children are renderable.  Load the refinement blockers with high priority and
        // render this tile in the meantime.
        queueChildLoadNearToFar(primitive, frameState.camera.positionCartographic, southwestChild, southeastChild, northwestChild, northeastChild);
        addTileToRenderList(primitive, tile);

        if (tile.needsLoading) {
            // We will refine this tile when it's possible, so load this tile only with low priority.
            primitive._tileLoadQueueLow.push(tile);
        }
    }
};

let comparisonPoint: Cartographic;
const centerScratch = new Cartographic();
const compareDistanceToPoint = function compareDistanceToPoint (a: any, b: any) {
    let center = Rectangle.center(a.rectangle, centerScratch);
    const alon = center.longitude - (comparisonPoint).longitude;
    const alat = center.latitude - comparisonPoint.latitude;

    center = Rectangle.center(b.rectangle, centerScratch);
    const blon = center.longitude - comparisonPoint.longitude;
    const blat = center.latitude - comparisonPoint.latitude;

    return alon * alon + alat * alat - (blon * blon + blat * blat);
};

const selectTilesForRendering = function selectTilesForRendering (primitive: any, frameState: FrameState) {
    const debug = primitive._debug;
    if (debug.suspendLodUpdate) {
        return;
    }

    // Clear the render list.
    const tilesToRender = primitive._tilesToRender;
    tilesToRender.length = 0;

    // We can't render anything before the level zero tiles exist.
    const tileProvider = primitive._tileProvider;

    // 是否存在第0层级的tile
    if (!defined(primitive._levelZeroTiles)) {
        if (tileProvider.ready) {
            const tilingScheme = tileProvider.tilingScheme;
            primitive._levelZeroTiles = QuadtreeTile.createLevelZeroTiles(tilingScheme);
        } else {
            // Nothing to do until the provider is ready.
            return;
        }
    }

    primitive._occluders.ellipsoid.cameraPosition = frameState.camera.positionWC;

    let tile;
    const levelZeroTiles = primitive._levelZeroTiles;
    const occluders = levelZeroTiles.length > 1
        ? primitive._occluders
        : undefined;

    // Sort the level zero tiles by the distance from the center to the camera.
    // The level zero tiles aren't necessarily a nice neat quad, so we can't use the
    // quadtree ordering we use elsewhere in the tree
    comparisonPoint = frameState.camera.positionCartographic;
    levelZeroTiles.sort(compareDistanceToPoint);

    const customDataAdded = primitive._addHeightCallbacks;
    const customDataRemoved = primitive._removeHeightCallbacks;
    const frameNumber = frameState.frameNumber;

    let i;
    let len;
    if (customDataAdded.length > 0 || customDataRemoved.length > 0) {
        for (i = 0, len = levelZeroTiles.length; i < len; ++i) {
            tile = levelZeroTiles[i];
            tile._updateCustomData(frameNumber, customDataAdded, customDataRemoved);
        }

        customDataAdded.length = 0;
        customDataRemoved.length = 0;
    }

    // Our goal with load ordering is to first load all of the tiles we need to
    // render the current scene at full detail.  Loading any other tiles is just
    // a form of prefetching, and we need not do it at all (other concerns aside).  This
    // simple and obvious statement gets more complicated when we realize that, because
    // we don't have bounding volumes for the entire terrain tile pyramid, we don't
    // precisely know which tiles we need to render the scene at full detail, until we do
    // some loading.
    //
    // So our load priority is (from high to low):
    // 1. Tiles that we _would_ render, except that they're not sufficiently loaded yet.
    //    Ideally this would only include tiles that we've already determined to be visible,
    //    but since we don't have reliable visibility information until a tile is loaded,
    //    and because we (currently) must have all children in a quad renderable before we
    //    can refine, this pretty much means tiles we'd like to refine to, regardless of
    //    visibility. (high)
    // 2. Tiles that we're rendering. (medium)
    // 3. All other tiles. (low)
    //
    // Within each priority group, tiles should be loaded in approximate near-to-far order,
    // but currently they're just loaded in our traversal order which makes no guarantees
    // about depth ordering.

    // Traverse in depth-first, near-to-far order.
    for (i = 0, len = levelZeroTiles.length; i < len; ++i) {
        tile = levelZeroTiles[i];
        primitive._tileReplacementQueue.markTileRendered(tile);
        if (!tile.renderable) {
            if (tile.needsLoading) {
                primitive._tileLoadQueueHigh.push(tile);
            }
            ++debug.tilesWaitingForChildren;
        } else if (tileProvider.computeTileVisibility(tile, frameState, occluders) !== Visibility.NONE) {
            visitTile(primitive, frameState, tile);
        } else {
            if (tile.needsLoading) {
                primitive._tileLoadQueueLow.push(tile);
            }
            ++debug.tilesCulled;
        }
    }
};

/**
     * Checks if the load queue length has changed since the last time we raised a queue change event - if so, raises
     * a new change event at the end of the render cycle.
     */
const updateTileLoadProgress = function updateTileLoadProgress (primitive: any, frameState: FrameState) {
    const currentLoadQueueLength = primitive._tileLoadQueueHigh.length + primitive._tileLoadQueueMedium.length + primitive._tileLoadQueueLow.length;

    if (currentLoadQueueLength !== primitive._lastTileLoadQueueLength || primitive._tilesInvalidated) {
        frameState.afterRender.push(Event.prototype.raiseEvent.bind(primitive._tileLoadProgressEvent, currentLoadQueueLength));
        primitive._lastTileLoadQueueLength = currentLoadQueueLength;
    }

    const debug = primitive._debug;
    if (debug.enableDebugOutput && !debug.suspendLodUpdate) {
        if (debug.tilesVisited !== debug.lastTilesVisited ||
                debug.tilesRendered !== debug.lastTilesRendered ||
                debug.tilesCulled !== debug.lastTilesCulled ||
                debug.maxDepth !== debug.lastMaxDepth ||
                debug.tilesWaitingForChildren !== debug.lastTilesWaitingForChildren) {
            console.log('Visited ' + debug.tilesVisited + ', Rendered: ' + debug.tilesRendered + ', Culled: ' + debug.tilesCulled + ', Max Depth: ' + debug.maxDepth + ', Waiting for children: ' + debug.tilesWaitingForChildren);

            debug.lastTilesVisited = debug.tilesVisited;
            debug.lastTilesRendered = debug.tilesRendered;
            debug.lastTilesCulled = debug.tilesCulled;
            debug.lastMaxDepth = debug.maxDepth;
            debug.lastTilesWaitingForChildren = debug.tilesWaitingForChildren;
        }
    }
};

const visitVisibleChildrenNearToFar = function visitVisibleChildrenNearToFar (primitive: any, southwest: any, southeast: any, northwest: any, northeast: any, frameState: FrameState) {
    const cameraPosition = frameState.camera.positionCartographic;
    const tileProvider = primitive._tileProvider;
    const occluders = primitive._occluders;

    if (cameraPosition.longitude < southwest.rectangle.east) {
        if (cameraPosition.latitude < southwest.rectangle.north) {
            // Camera in southwest quadrant
            visitIfVisible(primitive, southwest, tileProvider, frameState, occluders);
            visitIfVisible(primitive, southeast, tileProvider, frameState, occluders);
            visitIfVisible(primitive, northwest, tileProvider, frameState, occluders);
            visitIfVisible(primitive, northeast, tileProvider, frameState, occluders);
        } else {
            // Camera in northwest quadrant
            visitIfVisible(primitive, northwest, tileProvider, frameState, occluders);
            visitIfVisible(primitive, southwest, tileProvider, frameState, occluders);
            visitIfVisible(primitive, northeast, tileProvider, frameState, occluders);
            visitIfVisible(primitive, southeast, tileProvider, frameState, occluders);
        }
    } else if (cameraPosition.latitude < southwest.rectangle.north) {
        // Camera southeast quadrant
        visitIfVisible(primitive, southeast, tileProvider, frameState, occluders);
        visitIfVisible(primitive, southwest, tileProvider, frameState, occluders);
        visitIfVisible(primitive, northeast, tileProvider, frameState, occluders);
        visitIfVisible(primitive, northwest, tileProvider, frameState, occluders);
    } else {
        // Camera in northeast quadrant
        visitIfVisible(primitive, northeast, tileProvider, frameState, occluders);
        visitIfVisible(primitive, northwest, tileProvider, frameState, occluders);
        visitIfVisible(primitive, southeast, tileProvider, frameState, occluders);
        visitIfVisible(primitive, southwest, tileProvider, frameState, occluders);
    }
};

function visitIfVisible (primitive: any, tile: any, tileProvider: any, frameState: FrameState, occluders: any) {
    if (tileProvider.computeTileVisibility(tile, frameState, occluders) !== Visibility.NONE) {
        visitTile(primitive, frameState, tile);
    } else {
        ++primitive._debug.tilesCulled;
        primitive._tileReplacementQueue.markTileRendered(tile);

        // We've decided this tile is not visible, but if it's not fully loaded yet, we've made
        // this determination based on possibly-incorrect information.  We need to load this
        // culled tile with low priority just in case it turns out to be visible after all.
        if (tile.needsLoading) {
            primitive._tileLoadQueueLow.push(tile);
        }
    }
}

class QuadtreePrimitive {
    _tileProvider: GlobeSurfaceTileProvider;
    _debug: any;
    _tilesToRender: any[];
    _tileLoadQueueHigh: any[];
    _tileLoadQueueMedium: any[];
    _tileLoadQueueLow: any[];
    _tileReplacementQueue: TileReplacementQueue;
    _levelZeroTiles: any;
    _loadQueueTimeSlice: number;
    _tilesInvalidated: boolean;
    _addHeightCallbacks: any[];
    _removeHeightCallbacks: any[];

    _tileToUpdateHeights: any[];
    _lastTileIndex: number;
    _updateHeightsTimeSlice: number;

    maximumScreenSpaceError: number;

    tileCacheSize: number;
    _occluders: QuadtreeOccluders;
    _tileLoadProgressEvent: Event;
    _lastTileLoadQueueLength: number;
    _lastSelectionFrameNumber: any
    constructor (options: {
        tileProvider: any,
        maximumScreenSpaceError?: number,
        tileCacheSize?: number
    }) {
        this._tileProvider = options.tileProvider;
        this._tileProvider.quadtree = this;

        this._debug = {
            enableDebugOutput: false,

            maxDepth: 0,
            maxDepthVisited: 0,
            tilesVisited: 0,
            tilesCulled: 0,
            tilesRendered: 0,
            tilesWaitingForChildren: 0,

            lastMaxDepth: -1,
            lastMaxDepthVisited: -1,
            lastTilesVisited: -1,
            lastTilesCulled: -1,
            lastTilesRendered: -1,
            lastTilesWaitingForChildren: -1,

            suspendLodUpdate: false
        };

        const tilingScheme = this._tileProvider.tilingScheme as any;
        const ellipsoid = tilingScheme.ellipsoid;

        this._tilesToRender = [];
        this._tileLoadQueueHigh = []; // high priority tiles are preventing refinement
        this._tileLoadQueueMedium = []; // medium priority tiles are being rendered
        this._tileLoadQueueLow = []; // low priority tiles were refined past or are non-visible parts of quads.
        this._tileReplacementQueue = new TileReplacementQueue();
        this._levelZeroTiles = undefined;
        this._loadQueueTimeSlice = 5.0;
        this._tilesInvalidated = false;

        this._addHeightCallbacks = [];
        this._removeHeightCallbacks = [];

        this._tileToUpdateHeights = [];
        this._lastTileIndex = 0;
        this._updateHeightsTimeSlice = 2.0;

        /**
         * Gets or sets the maximum screen-space error, in pixels, that is allowed.
         * A higher maximum error will render fewer tiles and improve performance, while a lower
         * value will improve visual quality.
         * @type {Number}
         * @default 2
         */
        this.maximumScreenSpaceError = defaultValue(options.maximumScreenSpaceError, 2) as number;

        /**
         * Gets or sets the maximum number of tiles that will be retained in the tile cache.
         * Note that tiles will never be unloaded if they were used for rendering the last
         * frame, so the actual number of resident tiles may be higher.  The value of
         * this property will not affect visual quality.
         * @type {Number}
         * @default 100
         */
        this.tileCacheSize = defaultValue(options.tileCacheSize, 100) as number;

        this._occluders = new QuadtreeOccluders({
            ellipsoid: ellipsoid
        });

        this._tileLoadProgressEvent = new Event();
        this._lastTileLoadQueueLength = 0;

        this._lastSelectionFrameNumber = undefined;
    }

    get tileProvider (): GlobeSurfaceTileProvider {
        return this._tileProvider;
    }

    render (frameState: FrameState): void {
        const passes = frameState.passes;
        const tileProvider = this._tileProvider;

        if (passes.render) {
            tileProvider.beginUpdate(frameState);

            selectTilesForRendering(this, frameState);
            createRenderCommandsForSelectedTiles(this, frameState);

            tileProvider.endUpdate(frameState);
        }
    }

    /**
     * Initializes values for a new render frame and prepare the tile load queue.
     * @private
     */
    beginFrame (frameState:FrameState):void {
        const passes = frameState.passes;
        if (!passes.render) {
            return;
        }

        if (this._tilesInvalidated) {
            invalidateAllTiles(this);
            this._tilesInvalidated = false;
        }

        // Gets commands for any texture re-projections
        this._tileProvider.initialize(frameState);

        if (this._debug.suspendLodUpdate) {
            return;
        }

        clearTileLoadQueue(this);
        this._tileReplacementQueue.markStartOfRenderFrame();
    }

    endFrame (frameState: FrameState): void {
        const passes = frameState.passes;
        if (!passes.render || frameState.mode === SceneMode.MORPHING) {
            // Only process the load queue for a single pass.
            // Don't process the load queue or update heights during the morph flights.
            return;
        }

        // Load/create resources for terrain and imagery. Prepare texture re-projections for the next frame.
        processTileLoadQueue(this, frameState);
        updateHeights(this, frameState);
        updateTileLoadProgress(this, frameState);
    }

    /**
     * Updates the tile provider imagery and continues to process the tile load queue.
     * @private
     */
    update (frameState: FrameState): void {
        if (defined(this._tileProvider.update)) {
            this._tileProvider.update(frameState);
        }
    }

    /**
     * Invalidates and frees all the tiles in the quadtree.  The tiles must be reloaded
     * before they can be displayed.
     *
     * @memberof QuadtreePrimitive
     */
    invalidateAllTiles (): void {
        this._tilesInvalidated = true;
    }

    /**
     * Invokes a specified function for each {@link QuadtreeTile} that is partially
     * or completely loaded.
     *
     * @param {Function} tileFunction The function to invoke for each loaded tile.  The
     *        function is passed a reference to the tile as its only parameter.
     */
    forEachLoadedTile (tileFunction: any): void {
        let tile = this._tileReplacementQueue.head;
        while (defined(tile)) {
            if (tile.state !== QuadtreeTileLoadState.START) {
                tileFunction(tile);
            }
            tile = tile.replacementNext;
        }
    }
}
export { QuadtreePrimitive };
