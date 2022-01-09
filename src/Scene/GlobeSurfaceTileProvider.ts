/* eslint-disable no-mixed-operators */

import { BoundingSphere } from '@/Core/BoundingSphere';
import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartesian4 } from '@/Core/Cartesian4';
import { Cartographic } from '@/Core/Cartographic';
import { CesiumColor } from '@/Core/CesiumColor';
import { CesiumMath } from '@/Core/CesiumMath';
import { defaultValue } from '@/Core/defaultValue';
import { defined } from '@/Core/defined';
import { DeveloperError } from '@/Core/DeveloperError';
import { EllipsoidTerrainProvider } from '@/Core/EllipsoidTerrainProvider';
import { Event } from '@/Core/Event';
import { GeographicTilingScheme } from '@/Core/GeographicTilingScheme';
import { Intersect } from '@/Core/Intersect';
import { OrientedBoundingBox } from '@/Core/OrientedBoundingBox';
import { Rectangle } from '@/Core/Rectangle';
import { SceneMode } from '@/Core/SceneMode';
import { TerrainExaggeration } from '@/Core/TerrainExaggeration';
import { TerrainQuantization } from '@/Core/TerrainQuantization';
import { Visibility } from '@/Core/Visibility';
import { TileMaterial } from '@/Material/TileMaterial';
import { DrawMeshCommand } from '@/Renderer/DrawMeshCommand';
import { Vector4, Vector3, DoubleSide } from 'three';
import { TerrainProvider } from './../Core/TerrainProvider';
import { FrameState } from './FrameState';
import { GlobeSurfaceTile } from './GlobeSurfaceTile';
import { Imagery } from './Imagery';
import { ImageryLayer } from './ImageryLayer';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { ImageryState } from './ImageryState';
import { QuadtreeOccluders } from './QuadtreeOccluders';
import { QuadtreePrimitive } from './QuadtreePrimitive';
import { QuadtreeTile } from './QuadtreeTile';
import { QuadtreeTileLoadState } from './QuadtreeTileLoadState';
import { TerrainFillMesh } from './TerrainFillMesh';
import { TerrainState } from './TerrainState';
import { TileBoundingRegion } from './TileBoundingRegion';
import { TileImagery } from './TileImagery';
import TileSelectionResult from './TileSelectionResult';

const readyImageryScratch: any[] = [];
const canRenderTraversalStack: any[] = [];

const cornerPositionsScratch = [
    new Cartesian3(),
    new Cartesian3(),
    new Cartesian3(),
    new Cartesian3()
];

const tileDirectionScratch = new Cartesian3();

function computeOccludeePoint (
    tileProvider:GlobeSurfaceTileProvider,
    center:Cartesian3,
    rectangle:Rectangle,
    minimumHeight: number,
    maximumHeight: number,
    result: Cartesian3
) {
    const ellipsoidalOccluder = tileProvider.quadtree._occluders.ellipsoid;
    const ellipsoid = ellipsoidalOccluder.ellipsoid;

    const cornerPositions = cornerPositionsScratch;
    Cartesian3.fromRadians(
        rectangle.west,
        rectangle.south,
        maximumHeight,
        ellipsoid,
        cornerPositions[0]
    );
    Cartesian3.fromRadians(
        rectangle.east,
        rectangle.south,
        maximumHeight,
        ellipsoid,
        cornerPositions[1]
    );
    Cartesian3.fromRadians(
        rectangle.west,
        rectangle.north,
        maximumHeight,
        ellipsoid,
        cornerPositions[2]
    );
    Cartesian3.fromRadians(
        rectangle.east,
        rectangle.north,
        maximumHeight,
        ellipsoid,
        cornerPositions[3]
    );

    return ellipsoidalOccluder.computeHorizonCullingPointPossiblyUnderEllipsoid(
        center,
        cornerPositions,
        minimumHeight,
        result
    );
}

function updateTileBoundingRegion (tile: QuadtreeTile, tileProvider:GlobeSurfaceTileProvider, frameState:FrameState) {
    let surfaceTile = tile.data;
    if (surfaceTile === undefined) {
        surfaceTile = tile.data = new GlobeSurfaceTile();
    }

    const ellipsoid = tile.tilingScheme.ellipsoid;
    if (surfaceTile.tileBoundingRegion === undefined) {
        surfaceTile.tileBoundingRegion = new TileBoundingRegion({
            computeBoundingVolumes: false,
            rectangle: tile.rectangle,
            ellipsoid: ellipsoid,
            minimumHeight: 0.0,
            maximumHeight: 0.0
        });
    }

    const tileBoundingRegion = surfaceTile.tileBoundingRegion;
    const oldMinimumHeight = tileBoundingRegion.minimumHeight;
    const oldMaximumHeight = tileBoundingRegion.maximumHeight;
    let hasBoundingVolumesFromMesh = false;
    let sourceTile = tile;

    // Get min and max heights from the mesh.
    // If the mesh is not available, get them from the terrain data.
    // If the terrain data is not available either, get them from an ancestor.
    // If none of the ancestors are available, then there are no min and max heights for this tile at this time.
    const mesh = surfaceTile.mesh;
    const terrainData = surfaceTile.terrainData;
    if (
        mesh !== undefined &&
      mesh.minimumHeight !== undefined &&
      mesh.maximumHeight !== undefined
    ) {
        tileBoundingRegion.minimumHeight = mesh.minimumHeight;
        tileBoundingRegion.maximumHeight = mesh.maximumHeight;
        hasBoundingVolumesFromMesh = true;
    } else if (
        terrainData !== undefined &&
      terrainData._minimumHeight !== undefined &&
      terrainData._maximumHeight !== undefined
    ) {
        tileBoundingRegion.minimumHeight = terrainData._minimumHeight;
        tileBoundingRegion.maximumHeight = terrainData._maximumHeight;
    } else {
        // No accurate min/max heights available, so we're stuck with min/max heights from an ancestor tile.
        tileBoundingRegion.minimumHeight = Number.NaN;
        tileBoundingRegion.maximumHeight = Number.NaN;

        let ancestorTile = tile.parent;
        while (ancestorTile !== undefined) {
            const ancestorSurfaceTile = ancestorTile.data;
            if (ancestorSurfaceTile !== undefined) {
                const ancestorMesh = ancestorSurfaceTile.mesh;
                const ancestorTerrainData = ancestorSurfaceTile.terrainData;
                if (
                    ancestorMesh !== undefined &&
            ancestorMesh.minimumHeight !== undefined &&
            ancestorMesh.maximumHeight !== undefined
                ) {
                    tileBoundingRegion.minimumHeight = ancestorMesh.minimumHeight;
                    tileBoundingRegion.maximumHeight = ancestorMesh.maximumHeight;
                    break;
                } else if (
                    ancestorTerrainData !== undefined &&
            ancestorTerrainData._minimumHeight !== undefined &&
            ancestorTerrainData._maximumHeight !== undefined
                ) {
                    tileBoundingRegion.minimumHeight = ancestorTerrainData._minimumHeight;
                    tileBoundingRegion.maximumHeight = ancestorTerrainData._maximumHeight;
                    break;
                }
            }
            ancestorTile = ancestorTile.parent;
        }
        sourceTile = ancestorTile;
    }

    // Update bounding regions from the min and max heights
    if (sourceTile !== undefined) {
        const exaggeration = frameState.terrainExaggeration;
        const exaggerationRelativeHeight =
        frameState.terrainExaggerationRelativeHeight;
        const hasExaggeration = exaggeration !== 1.0;
        if (hasExaggeration) {
            hasBoundingVolumesFromMesh = false;
            tileBoundingRegion.minimumHeight = TerrainExaggeration.getHeight(
                tileBoundingRegion.minimumHeight,
                exaggeration,
                exaggerationRelativeHeight
            );
            tileBoundingRegion.maximumHeight = TerrainExaggeration.getHeight(
                tileBoundingRegion.maximumHeight,
                exaggeration,
                exaggerationRelativeHeight
            );
        }

        if (hasBoundingVolumesFromMesh) {
            if (!surfaceTile.boundingVolumeIsFromMesh) {
                tileBoundingRegion._orientedBoundingBox = OrientedBoundingBox.clone(
                    mesh.orientedBoundingBox,
                    tileBoundingRegion._orientedBoundingBox
                ) as OrientedBoundingBox;
                tileBoundingRegion._boundingSphere = BoundingSphere.clone(
                    mesh.boundingSphere3D,
                    tileBoundingRegion._boundingSphere
                );
                surfaceTile.occludeePointInScaledSpace = Cartesian3.clone(
                    mesh.occludeePointInScaledSpace,
                    surfaceTile.occludeePointInScaledSpace
                );

                // If the occludee point is not defined, fallback to calculating it from the OBB
                if (!defined(surfaceTile.occludeePointInScaledSpace)) {
                    surfaceTile.occludeePointInScaledSpace = computeOccludeePoint(
                        tileProvider,
                        tileBoundingRegion._orientedBoundingBox.center,
                        tile.rectangle,
                        tileBoundingRegion.minimumHeight,
                        tileBoundingRegion.maximumHeight,
                        surfaceTile.occludeePointInScaledSpace
                    ) as Cartesian3;
                }
            }
        } else {
            const needsBounds =
          tileBoundingRegion._orientedBoundingBox === undefined ||
          tileBoundingRegion._boundingSphere === undefined;
            const heightChanged =
          tileBoundingRegion.minimumHeight !== oldMinimumHeight ||
          tileBoundingRegion.maximumHeight !== oldMaximumHeight;
            if (heightChanged || needsBounds) {
                // Bounding volumes need to be recomputed in some circumstances
                tileBoundingRegion.computeBoundingVolumes(ellipsoid);
                surfaceTile.occludeePointInScaledSpace = computeOccludeePoint(
                    tileProvider,
                    (tileBoundingRegion._orientedBoundingBox as OrientedBoundingBox).center,
                    tile.rectangle,
                    tileBoundingRegion.minimumHeight,
                    tileBoundingRegion.maximumHeight,
                    surfaceTile.occludeePointInScaledSpace
                ) as Cartesian3;
            }
        }
        surfaceTile.boundingVolumeSourceTile = sourceTile;
        surfaceTile.boundingVolumeIsFromMesh = hasBoundingVolumesFromMesh;
    } else {
        surfaceTile.boundingVolumeSourceTile = undefined;
        surfaceTile.boundingVolumeIsFromMesh = false;
    }
}

const boundingSphereScratch = new BoundingSphere();
const rectangleIntersectionScratch = new Rectangle();
const splitCartographicLimitRectangleScratch = new Rectangle();
const rectangleCenterScratch = new Cartographic();

// cartographicLimitRectangle may span the IDL, but tiles never will.
function clipRectangleAntimeridian (tileRectangle:Rectangle, cartographicLimitRectangle:Rectangle):Rectangle {
    if (cartographicLimitRectangle.west < cartographicLimitRectangle.east) {
        return cartographicLimitRectangle;
    }
    const splitRectangle = Rectangle.clone(
        cartographicLimitRectangle,
        splitCartographicLimitRectangleScratch
    ) as Rectangle;
    const tileCenter = Rectangle.center(tileRectangle, rectangleCenterScratch);
    if (tileCenter.longitude > 0.0) {
        splitRectangle.east = CesiumMath.PI;
    } else {
        splitRectangle.west = -CesiumMath.PI;
    }
    return splitRectangle;
}

function isUndergroundVisible (tileProvider:GlobeSurfaceTileProvider, frameState: FrameState): boolean {
    // if (frameState.cameraUnderground) {
    //     return true;
    // }

    // if (frameState.globeTranslucencyState.translucent) {
    //     return true;
    // }

    // if (tileProvider.backFaceCulling) {
    //     return false;
    // }

    // const clippingPlanes = tileProvider._clippingPlanes;
    // if (defined(clippingPlanes) && clippingPlanes.enabled) {
    //     return true;
    // }

    if (!Rectangle.equals(tileProvider.cartographicLimitRectangle, Rectangle.MAX_VALUE)) {
        return true;
    }

    return false;
}

const otherPassesInitialColor = new Vector4(0.0, 0.0, 0.0, 0.0);
const tileRectangleScratch = new Vector4();
const rtcScratch = new Vector3();
const southwestScratch = new Vector3();
const northeastScratch = new Vector3();

const surfaceShaderSetOptionsScratch : {
    frameState?: FrameState,
    surfaceTile: any,
    enableLighting: boolean,
    useWebMercatorProjection: boolean,
    numberOfDayTextures?: number
} = {
    surfaceTile: undefined,
    enableLighting: false,
    useWebMercatorProjection: false
};

function sortTileImageryByLayerIndex (a: any, b: any) {
    let aImagery = a.loadingImagery;
    if (!defined(aImagery)) {
        aImagery = a.readyImagery;
    }

    let bImagery = b.loadingImagery;
    if (!defined(bImagery)) {
        bImagery = b.readyImagery;
    }

    return aImagery.imageryLayer._layerIndex - bImagery.imageryLayer._layerIndex;
}

const createTileUniformMap = (frameState: FrameState, tileProvider: any, surfaceShaderSetOptions: any, quantization: TerrainQuantization) => {
    const material = new TileMaterial({
        // side: DoubleSide
        // wireframe: true
        // depthTest: false
    }, surfaceShaderSetOptions);

    if (quantization === TerrainQuantization.NONE) {
        material.defines.INCLUDE_WEB_MERCATOR_Y = '';
        return material;
    }

    material.defines.QUANTIZATION_BITS12 = '';
    material.defines.INCLUDE_WEB_MERCATOR_Y = '';
    return material;
};

// function updateCredits (surface: GlobeSurfaceTileProvider, frameState: FrameState) {
//     const creditDisplay = frameState.creditDisplay;
//     if (
//         surface._terrainProvider.ready &&
//       defined(surface._terrainProvider.credit)
//     ) {
//         creditDisplay.addCredit(surface._terrainProvider.credit);
//     }

//     const imageryLayers = surface._imageryLayers;
//     for (let i = 0, len = imageryLayers.length; i < len; ++i) {
//         const imageryProvider = imageryLayers.get(i).imageryProvider;
//         if (imageryProvider.ready && defined(imageryProvider.credit)) {
//             creditDisplay.addCredit(imageryProvider.credit);
//         }
//     }
// }

const addDrawCommandsForTile = (tileProvider: any, tile: any, frameState: FrameState) => {
    const surfaceTile = tile.data;

    if (!defined(surfaceTile.vertexArray)) {
        if (surfaceTile.fill === undefined) {
            // No fill was created for this tile, probably because this tile is not connected to
            // any renderable tiles. So create a simple tile in the middle of the tile's possible
            // height range.
            surfaceTile.fill = new (TerrainFillMesh as any)(tile);
        }
        surfaceTile.fill.update(tileProvider, frameState);
    }

    const mesh = surfaceTile.renderedMesh;
    let rtc = mesh.center;
    const encoding = mesh.encoding;

    // Not used in 3D.
    const tileRectangle = tileRectangleScratch;

    const useWebMercatorProjection = false;

    if (frameState.mode !== SceneMode.SCENE3D) {
        const projection = frameState.mapProjection;
        const southwest = projection.project(Rectangle.southwest(tile.rectangle), southwestScratch);
        const northeast = projection.project(Rectangle.northeast(tile.rectangle), northeastScratch);

        tileRectangle.x = southwest.x;
        tileRectangle.y = southwest.y;
        tileRectangle.z = northeast.x;
        tileRectangle.w = northeast.y;

        // In 2D and Columbus View, use the center of the tile for RTC rendering.
        if (frameState.mode !== SceneMode.MORPHING) {
            rtc = rtcScratch;
            rtc.x = 0.0;
            rtc.y = (tileRectangle.z + tileRectangle.x) * 0.5;
            rtc.z = (tileRectangle.w + tileRectangle.y) * 0.5;
            tileRectangle.x -= rtc.y;
            tileRectangle.y -= rtc.z;
            tileRectangle.z -= rtc.y;
            tileRectangle.w -= rtc.z;
        }
    }

    const surfaceShaderSetOptions = surfaceShaderSetOptionsScratch;
    surfaceShaderSetOptions.frameState = frameState;
    surfaceShaderSetOptions.surfaceTile = surfaceTile;

    const quantization = encoding.quantization;
    surfaceShaderSetOptions.enableLighting = tileProvider.enableLighting;
    surfaceShaderSetOptions.useWebMercatorProjection = useWebMercatorProjection;

    const tileImageryCollection = surfaceTile.imagery;
    let imageryIndex = 0;
    const imageryLen = tileImageryCollection.length;

    let initialColor = tileProvider._firstPassInitialColor;

    do {
        let numberOfDayTextures = 0;

        let command;
        let uniformMap;

        const dayTextures = [];
        const dayTextureTranslationAndScale = [];
        const dayTextureTexCoordsRectangle = [];
        while (imageryIndex < imageryLen) {
            const tileImagery = tileImageryCollection[imageryIndex];
            const imagery = tileImagery.readyImagery;
            ++imageryIndex;

            if (!defined(imagery)) {
                continue;
            }

            const texture = tileImagery.useWebMercatorT
                ? imagery.textureWebMercator
                : imagery.texture;

            const imageryLayer = imagery.imageryLayer;

            if (!defined(tileImagery.textureTranslationAndScale)) {
                tileImagery.textureTranslationAndScale = imageryLayer._calculateTextureTranslationAndScale(tile, tileImagery);
            }

            dayTextures[numberOfDayTextures] = texture;
            dayTextureTranslationAndScale[numberOfDayTextures] = tileImagery.textureTranslationAndScale;
            dayTextureTexCoordsRectangle[numberOfDayTextures] = tileImagery.textureCoordinateRectangle;

            ++numberOfDayTextures;
        }

        surfaceShaderSetOptions.numberOfDayTextures = dayTextures.length;

        if (tileProvider._drawCommands.length <= tileProvider._usedDrawCommands) {
            command = new DrawMeshCommand();
            command.owner = tile;
            command.frustumCulled = false;
            command.boundingVolume = new BoundingSphere();
            command.orientedBoundingBox = undefined;

            uniformMap = createTileUniformMap(frameState, tileProvider, surfaceShaderSetOptions, quantization);

            tileProvider._drawCommands.push(command);
            tileProvider._uniformMaps.push(uniformMap);
        } else {
            command = tileProvider._drawCommands[tileProvider._usedDrawCommands];
            uniformMap = tileProvider._uniformMaps[tileProvider._usedDrawCommands];
        }

        if (uniformMap.defines.TEXTURE_UNITS !== uniformMap.dayTextures.length || imageryLen !== uniformMap.dayTextures.length || quantization === TerrainQuantization.BITS12 && !defined(uniformMap.defines.QUANTIZATION_BITS12)) {
            uniformMap.dispose();
            uniformMap = createTileUniformMap(frameState, tileProvider, surfaceShaderSetOptions, quantization);
        }

        ++tileProvider._usedDrawCommands;

        uniformMap.dayTextures = dayTextures;
        uniformMap.dayTextureTranslationAndScale = dayTextureTranslationAndScale;
        uniformMap.dayTextureTexCoordsRectangle = dayTextureTexCoordsRectangle;

        Cartesian4.clone(initialColor, uniformMap.initialColor);

        command.owner = tile;

        if (frameState.mode === SceneMode.COLUMBUS_VIEW) {
            command.position.set(rtc.y, rtc.z, rtc.x);
        } else if (frameState.mode === SceneMode.SCENE3D) {
            command.position.set(rtc.x, rtc.y, rtc.z);
        }

        command.updateMatrixWorld();

        uniformMap.tileRectangle = tileRectangle;

        uniformMap.minMaxHeight.x = encoding.minimumHeight;
        uniformMap.minMaxHeight.y = encoding.maximumHeight;

        uniformMap.scaleAndBias = encoding.threeMatrix4;

        command.geometry = mesh.geometry;
        command.material = uniformMap;

        let boundingVolume = command.boundingVolume;
        const orientedBoundingBox = command.orientedBoundingBox;

        if (frameState.mode !== SceneMode.SCENE3D) {
            BoundingSphere.fromRectangleWithHeights2D(tile.rectangle, frameState.mapProjection, surfaceTile.minimumHeight, surfaceTile.maximumHeight, boundingVolume);
            // Vector3.fromElements(boundingVolume.center.z, boundingVolume.center.x, boundingVolume.center.y, boundingVolume.center);

            Cartesian3.fromElements(boundingVolume.center.x, boundingVolume.center.y, boundingVolume.center.z, boundingVolume.center);

            if (frameState.mode === SceneMode.MORPHING) {
                boundingVolume = BoundingSphere.union(surfaceTile.boundingSphere3D, boundingVolume, boundingVolume);
            }
        } else {
            command.boundingVolume = BoundingSphere.clone(surfaceTile.boundingSphere3D, boundingVolume);
            command.orientedBoundingBox = OrientedBoundingBox.clone(surfaceTile.orientedBoundingBox, orientedBoundingBox);
        }

        // if (defined(command.boundingVolume)) {
        //     let sphere = getDebugBoundingSphere(command.boundingVolume, CesiumColor.RED);
        //     sphere._levelId = tile.levelId;
        //     frameState.commandList.push(sphere);
        // }

        frameState.commandList.push(command);

        // if (uniformMap.defines.TEXTURE_UNITS !== uniformMap.dayTextures.length) {
        //     debugger;
        // }

        initialColor = otherPassesInitialColor;
    } while (imageryIndex < imageryLen);
};

class GlobeSurfaceTileProvider {
    _imageryLayers: ImageryLayerCollection;
    _quadtree?: QuadtreePrimitive;
    _terrainProvider: EllipsoidTerrainProvider | TerrainProvider;
    _errorEvent: Event;
    _imageryLayersUpdatedEvent: Event;
    _tileLoadedEvent: Event;
    _tilesToRenderByTextureCount: any[];

    _drawCommands: any[];
    _compressCommands: any[];
    _uniformMaps: any[];
    _compressUniformMaps: any[];

    _usedDrawCommands: number;
    _usedCompressCommands: number;

    _vertexArraysToDestroy: any[];
    cartographicLimitRectangle: Rectangle;

    _debug: {
        wireframe: boolean,
        boundingSphereTile: BoundingSphere | undefined,
        tilesRendered?: any,
        texturesRendered?: any
    }

    _baseColor: CesiumColor | undefined;
    _firstPassInitialColor: Cartesian4;

    _layerOrderChanged: boolean;
    _hasFillTilesThisFrame: boolean;
    _hasLoadedTilesThisFrame: boolean;
    constructor (options: {
        terrainProvider: EllipsoidTerrainProvider;
        imageryLayers: ImageryLayerCollection;
    }) {
        this._quadtree = undefined;
        this._imageryLayers = options.imageryLayers;
        this._terrainProvider = options.terrainProvider;

        this._errorEvent = new Event();

        this._imageryLayersUpdatedEvent = new Event();

        this._imageryLayers.layerAdded.addEventListener(GlobeSurfaceTileProvider.prototype._onLayerAdded, this);
        this._imageryLayers.layerRemoved.addEventListener(GlobeSurfaceTileProvider.prototype._onLayerRemoved, this);
        this._imageryLayers.layerMoved.addEventListener(GlobeSurfaceTileProvider.prototype._onLayerMoved, this);
        this._imageryLayers.layerShownOrHidden.addEventListener(GlobeSurfaceTileProvider.prototype._onLayerShownOrHidden, this);
        this._tileLoadedEvent = new Event();
        this._imageryLayersUpdatedEvent = new Event();

        this._tilesToRenderByTextureCount = [];
        this._drawCommands = [];
        this._compressCommands = [];

        this._uniformMaps = [];
        this._compressUniformMaps = [];

        this._usedDrawCommands = 0;
        this._usedCompressCommands = 0;

        this._vertexArraysToDestroy = [];

        this._tileLoadedEvent = new Event();
        this.cartographicLimitRectangle = Rectangle.clone(Rectangle.MAX_VALUE) as Rectangle;

        this._hasLoadedTilesThisFrame = false;
        this._hasFillTilesThisFrame = false;

        this._debug = {
            wireframe: false,
            boundingSphereTile: undefined
        };

        this._layerOrderChanged = false;

        this._baseColor = undefined;
        this._firstPassInitialColor = new Cartesian4(0.0, 0.0, 0.5, 1.0);
        this.baseColor = new CesiumColor(0.0, 0.0, 0.5, 1.0);
    }

    get baseColor (): CesiumColor {
        return this._baseColor as CesiumColor;
    }

    set baseColor (value: CesiumColor) {
        // >>includeStart('debug', pragmas.debug);
        if (!defined(value)) {
            throw new DeveloperError('value is required.');
        }
        // >>includeEnd('debug');

        this._baseColor = value;
        this._firstPassInitialColor = Cartesian4.fromColor(value, this._firstPassInitialColor);
    }

    get quadtree (): QuadtreePrimitive {
        return (this._quadtree as QuadtreePrimitive);
    }

    set quadtree (value: QuadtreePrimitive) {
        this._quadtree = value;
    }

    get tilingScheme (): GeographicTilingScheme {
        return this._terrainProvider.tilingScheme as GeographicTilingScheme;
    }

    get terrainProvider (): EllipsoidTerrainProvider | TerrainProvider {
        return this._terrainProvider;
    }

    set terrainProvider (terrainProvider: EllipsoidTerrainProvider | TerrainProvider) {
        if (this._terrainProvider === terrainProvider) {
            return;
        }

        // >>includeStart('debug', pragmas.debug);
        if (!defined(terrainProvider)) {
            throw new DeveloperError('terrainProvider is required.');
        }
        // >>includeEnd('debug');

        this._terrainProvider = terrainProvider;

        if (defined(this._quadtree)) {
            (this._quadtree as QuadtreePrimitive).invalidateAllTiles();
        }
    }

    get imageryLayersUpdatedEvent (): Event {
        return this._imageryLayersUpdatedEvent;
    }

    get ready (): any {
        return (
            this._terrainProvider.ready &&
            (this._imageryLayers.length === 0 ||
              this._imageryLayers.get(0).imageryProvider.ready)
        );
    }

    /**
     * Determines if the given tile can be refined
     * @param {QuadtreeTile} tile The tile to check.
     * @returns {boolean} True if the tile can be refined, false if it cannot.
     */
    anRefine (tile: QuadtreeTile): boolean {
    // Only allow refinement it we know whether or not the children of this tile exist.
    // For a tileset with `availability`, we'll always be able to refine.
    // We can ask for availability of _any_ child tile because we only need to confirm
    // that we get a yes or no answer, it doesn't matter what the answer is.
        if (defined((tile.data as GlobeSurfaceTile).terrainData)) {
            return true;
        }
        const childAvailable = this.terrainProvider.getTileDataAvailable(
            tile.x * 2,
            tile.y * 2,
            tile.level + 1
        );
        return childAvailable !== undefined;
    }

    /**
     * Called at the beginning of the update cycle for each render frame, before {@link QuadtreeTileProvider#showTileThisFrame}
     * or any other functions.
     *
     * @param {FrameState} frameState The frame state.
     */
    beginUpdate (frameState: FrameState): void {
        const tilesToRenderByTextureCount = this._tilesToRenderByTextureCount;
        for (let i = 0, len = tilesToRenderByTextureCount.length; i < len; ++i) {
            const tiles = tilesToRenderByTextureCount[i];
            if (defined(tiles)) {
                tiles.length = 0;
            }
        }
        // update clipping planes
        // const clippingPlanes = this._clippingPlanes;
        // if (defined(clippingPlanes) && clippingPlanes.enabled) {
        //     clippingPlanes.update(frameState);
        // }
        this._usedDrawCommands = 0;

        this._hasLoadedTilesThisFrame = false;
        this._hasFillTilesThisFrame = false;
    }

    /**
   * Called at the end of the update cycle for each render frame, after {@link QuadtreeTileProvider#showTileThisFrame}
   * and any other functions.
   *
   * @param {FrameState} frameState The frame state.
   */
    endUpdate (frameState: FrameState) {
        // if (!defined(this._renderState)) {
        //     this._renderState = RenderState.fromCache({
        //         // Write color and depth
        //         cull: {
        //             enabled: true
        //         },
        //         depthTest: {
        //             enabled: true,
        //             func: DepthFunction.LESS
        //         }
        //     });

        //     this._blendRenderState = RenderState.fromCache({
        //         // Write color and depth
        //         cull: {
        //             enabled: true
        //         },
        //         depthTest: {
        //             enabled: true,
        //             func: DepthFunction.LESS_OR_EQUAL
        //         },
        //         blending: BlendingState.ALPHA_BLEND
        //     });

        //     let rs = clone(this._renderState, true);
        //     rs.cull.enabled = false;
        //     this._disableCullingRenderState = RenderState.fromCache(rs);

        //     rs = clone(this._blendRenderState, true);
        //     rs.cull.enabled = false;
        //     this._disableCullingBlendRenderState = RenderState.fromCache(rs);
        // }

        // If this frame has a mix of loaded and fill tiles, we need to propagate
        // loaded heights to the fill tiles.
        // if (this._hasFillTilesThisFrame && this._hasLoadedTilesThisFrame) {
        //     TerrainFillMesh.updateFillTiles(
        //         this,
        //         this._quadtree._tilesToRender,
        //         frameState,
        //         this._vertexArraysToDestroy
        //     );
        // }

        // When terrain exaggeration changes, all of the loaded tiles need to generate
        // geodetic surface normals so they can scale properly when rendered.
        // When exaggeration is reset, geodetic surface normals are removed to decrease
        // memory usage. Some tiles might have been constructed with the correct
        // exaggeration already, so skip over them.

        // If the geodetic surface normals can't be created because the tile doesn't
        // have a mesh, keep checking until the tile does have a mesh. This can happen
        // if the tile's mesh starts construction in a worker thread right before the
        // exaggeration changes.

        //     const quadtree = this.quadtree;
        //     const exaggeration = frameState.terrainExaggeration;
        //     const exaggerationRelativeHeight = frameState.terrainExaggerationRelativeHeight;
        //     const hasExaggerationScale = exaggeration !== 1.0;
        //     const exaggerationChanged =
        //   this._oldTerrainExaggeration !== exaggeration ||
        //   this._oldTerrainExaggerationRelativeHeight !== exaggerationRelativeHeight;

        //     // Keep track of the next time there is a change in exaggeration
        //     this._oldTerrainExaggeration = exaggeration;
        //     this._oldTerrainExaggerationRelativeHeight = exaggerationRelativeHeight;

        //     const processingChange =
        //   exaggerationChanged || this._processingTerrainExaggerationChange;
        //     let continueProcessing = false;

        //     if (processingChange) {
        //         quadtree.forEachRenderedTile(function (tile) {
        //             const surfaceTile = tile.data;
        //             const mesh = surfaceTile.renderedMesh;
        //             if (mesh !== undefined) {
        //                 // Check the tile's terrain encoding to see if it has been exaggerated yet
        //                 const encoding = mesh.encoding;
        //                 const encodingExaggerationScaleChanged =
        //         encoding.exaggeration !== exaggeration;
        //                 const encodingRelativeHeightChanged =
        //         encoding.exaggerationRelativeHeight !== exaggerationRelativeHeight;

        //                 if (encodingExaggerationScaleChanged || encodingRelativeHeightChanged) {
        //                     // Turning exaggeration scale on/off requires adding or removing geodetic surface normals
        //                     // Relative height only translates, so it has no effect on normals
        //                     if (encodingExaggerationScaleChanged) {
        //                         if (hasExaggerationScale && !encoding.hasGeodeticSurfaceNormals) {
        //                             const ellipsoid = tile.tilingScheme.ellipsoid;
        //                             surfaceTile.addGeodeticSurfaceNormals(ellipsoid, frameState);
        //                         } else if (
        //                             !hasExaggerationScale &&
        //             encoding.hasGeodeticSurfaceNormals
        //                         ) {
        //                             surfaceTile.removeGeodeticSurfaceNormals(frameState);
        //                         }
        //                     }

        //                     encoding.exaggeration = exaggeration;
        //                     encoding.exaggerationRelativeHeight = exaggerationRelativeHeight;

        //                     // Notify the quadtree that this tile's height has changed
        //                     quadtree._tileToUpdateHeights.push(tile);
        //                     const customData = tile.customData;
        //                     const customDataLength = customData.length;
        //                     for (let i = 0; i < customDataLength; i++) {
        //                         // Restart the level so that a height update is triggered
        //                         const data = customData[i];
        //                         data.level = -1;
        //                     }
        //                 }
        //             } else {
        //                 // this tile may come into view at a later time so keep the loop active
        //                 continueProcessing = true;
        //             }
        //         });
        //     }

        //     this._processingTerrainExaggerationChange = continueProcessing;

        // Add the tile render commands to the command list, sorted by texture count.
        const tilesToRenderByTextureCount = this._tilesToRenderByTextureCount;
        for (
            let textureCountIndex = 0,
                textureCountLength = tilesToRenderByTextureCount.length;
            textureCountIndex < textureCountLength;
            ++textureCountIndex
        ) {
            const tilesToRender = tilesToRenderByTextureCount[textureCountIndex];
            if (!defined(tilesToRender)) {
                continue;
            }

            for (
                let tileIndex = 0, tileLength = tilesToRender.length;
                tileIndex < tileLength;
                ++tileIndex
            ) {
                const tile = tilesToRender[tileIndex];
                const tileBoundingRegion = tile.data.tileBoundingRegion;
                addDrawCommandsForTile(this, tile, frameState);
                frameState.minimumTerrainHeight = Math.min(
                    frameState.minimumTerrainHeight,
                    tileBoundingRegion.minimumHeight
                );
            }
        }
    }

    _onLayerAdded (layer:ImageryLayer, index: number): void {
        if (layer.show) {
            const terrainProvider = this._terrainProvider;

            const that = this;
            const imageryProvider = layer.imageryProvider;
            const tileImageryUpdatedEvent = this._imageryLayersUpdatedEvent;
            imageryProvider._reload = function () {
            // Clear the layer's cache
                layer._imageryCache = {};

                (that._quadtree as QuadtreePrimitive).forEachLoadedTile(function (tile: any) {
                    // If this layer is still waiting to for the loaded callback, just return
                    if (defined(tile._loadedCallbacks[layer._layerIndex])) {
                        return;
                    }

                    let i;

                    // Figure out how many TileImageries we will need to remove and where to insert new ones
                    const tileImageryCollection = tile.data.imagery;
                    const length = tileImageryCollection.length;
                    let startIndex = -1;
                    let tileImageriesToFree = 0;
                    for (i = 0; i < length; ++i) {
                        const tileImagery = tileImageryCollection[i];
                        const imagery = defaultValue(
                            tileImagery.readyImagery,
                            tileImagery.loadingImagery
                        );
                        if (imagery.imageryLayer === layer) {
                            if (startIndex === -1) {
                                startIndex = i;
                            }

                            ++tileImageriesToFree;
                        } else if (startIndex !== -1) {
                            // iterated past the section of TileImageries belonging to this layer, no need to continue.
                            break;
                        }
                    }

                    if (startIndex === -1) {
                        return;
                    }

                    // Insert immediately after existing TileImageries
                    const insertionPoint = startIndex + tileImageriesToFree;

                    // Create new TileImageries for all loaded tiles
                    // if (
                    //     layer._createTileImagerySkeletons(
                    //         tile,
                    //         terrainProvider,
                    //         insertionPoint
                    //     )
                    // ) {
                    //     // Add callback to remove old TileImageries when the new TileImageries are ready
                    //     tile._loadedCallbacks[layer._layerIndex] = getTileReadyCallback(
                    //         tileImageriesToFree,
                    //         layer,
                    //         terrainProvider
                    //     );

                    //     tile.state = QuadtreeTileLoadState.LOADING;
                    // }
                });
            };

            // create TileImageries for this layer for all previously loaded tiles
            (this._quadtree as QuadtreePrimitive).forEachLoadedTile(function (tile: any) {
                if ((layer as ImageryLayer)._createTileImagerySkeletons(tile, (terrainProvider as EllipsoidTerrainProvider))) {
                    tile.state = QuadtreeTileLoadState.LOADING;

                    // Tiles that are not currently being rendered need to load the new layer before they're renderable.
                    // We don't mark the rendered tiles non-renderable, though, because that would make the globe disappear.
                    if (
                        tile.level !== 0 &&
                (tile._lastSelectionResultFrame !==
                  (that.quadtree as QuadtreePrimitive)._lastSelectionFrameNumber ||
                  tile._lastSelectionResult !== TileSelectionResult.RENDERED)
                    ) {
                        tile.renderable = false;
                    }
                }
            });

            this._layerOrderChanged = true;
            tileImageryUpdatedEvent.raiseEvent();
        }
    }

    _onLayerRemoved (layer: ImageryLayer, index?: number): void {
        // destroy TileImagerys for this layer for all previously loaded tiles
        (this._quadtree as QuadtreePrimitive).forEachLoadedTile(function (tile: any) {
            const tileImageryCollection = tile.data.imagery;

            let startIndex = -1;
            let numDestroyed = 0;
            for (let i = 0, len = tileImageryCollection.length; i < len; ++i) {
                const tileImagery = tileImageryCollection[i];
                let imagery = tileImagery.loadingImagery;
                if (!defined(imagery)) {
                    imagery = tileImagery.readyImagery;
                }
                if (imagery.imageryLayer === layer) {
                    if (startIndex === -1) {
                        startIndex = i;
                    }

                    tileImagery.freeResources();
                    ++numDestroyed;
                } else if (startIndex !== -1) {
                    // iterated past the section of TileImagerys belonging to this layer, no need to continue.
                    break;
                }
            }

            if (startIndex !== -1) {
                tileImageryCollection.splice(startIndex, numDestroyed);
            }
        });

        if (defined(layer.imageryProvider)) {
            layer.imageryProvider._reload = undefined;
        }

        this._imageryLayersUpdatedEvent.raiseEvent();
    }

    _onLayerMoved (
        layer?:any,
        newIndex?:number,
        oldIndex?: number
    ): void {
        this._layerOrderChanged = true;
        this._imageryLayersUpdatedEvent.raiseEvent();
    }

    _onLayerShownOrHidden (
        layer: ImageryLayer,
        index: number,
        show: boolean
    ): void {
        if (show) {
            this._onLayerAdded(layer, index);
        } else {
            this._onLayerRemoved(layer, index);
        }
    }

    /**
     * Make updates to the tile provider that are not involved in rendering. Called before the render update cycle.
     */
    update (frameState: FrameState) {
    // update collection: imagery indices, base layers, raise layer show/hide event
        this._imageryLayers._update();
    }

    /**
     * Called at the beginning of each render frame, before {@link QuadtreeTileProvider#showTileThisFrame}
     * @param {FrameState} frameState The frame state.
     */
    initialize (frameState: FrameState): void {
        // update each layer for texture reprojection.
        this._imageryLayers.queueReprojectionCommands(frameState);

        if (this._layerOrderChanged) {
            this._layerOrderChanged = false;

            // Sort the TileImagery instances in each tile by the layer index.
            (this._quadtree as QuadtreePrimitive).forEachLoadedTile(function (tile: any) {
                tile.data.imagery.sort(sortTileImageryByLayerIndex);
            });
        }

        // Add credits for terrain and imagery providers.
        // updateCredits(this, frameState);

        const vertexArraysToDestroy = this._vertexArraysToDestroy;
        const length = vertexArraysToDestroy.length;
        for (let j = 0; j < length; ++j) {
            GlobeSurfaceTile._freeVertexArray(vertexArraysToDestroy[j]);
        }
        vertexArraysToDestroy.length = 0;
    }

    /**
     * Cancels any imagery re-projections in the queue.
     */
    cancelReprojections (): void {
        this._imageryLayers.cancelReprojections();
    }

    /**
     * Gets the distance from the camera to the closest point on the tile.  This is used for level-of-detail selection.
     *
     * @param {QuadtreeTile} tile The tile instance.
     * @param {FrameState} frameState The state information of the current rendering frame.
     *
     * @returns {Number} The distance from the camera to the closest point on the tile, in meters.
     */
    computeDistanceToTile (
        tile:QuadtreeTile,
        frameState:FrameState
    ): number {
    // The distance should be:
    // 1. the actual distance to the tight-fitting bounding volume, or
    // 2. a distance that is equal to or greater than the actual distance to the tight-fitting bounding volume.
    //
    // When we don't know the min/max heights for a tile, but we do know the min/max of an ancestor tile, we can
    // build a tight-fitting bounding volume horizontally, but not vertically. The min/max heights from the
    // ancestor will likely form a volume that is much bigger than it needs to be. This means that the volume may
    // be deemed to be much closer to the camera than it really is, causing us to select tiles that are too detailed.
    // Loading too-detailed tiles is super expensive, so we don't want to do that. We don't know where the child
    // tile really lies within the parent range of heights, but we _do_ know the child tile can't be any closer than
    // the ancestor height surface (min or max) that is _farthest away_ from the camera. So if we compute distance
    // based on that conservative metric, we may end up loading tiles that are not detailed enough, but that's much
    // better (faster) than loading tiles that are too detailed.

        updateTileBoundingRegion(tile, this, frameState);

        const surfaceTile = tile.data as GlobeSurfaceTile;
        const boundingVolumeSourceTile = surfaceTile.boundingVolumeSourceTile;
        if (boundingVolumeSourceTile === undefined) {
            // Can't find any min/max heights anywhere? Ok, let's just say the
            // tile is really far away so we'll load and render it rather than
            // refining.
            return 9999999999.0;
        }

        const tileBoundingRegion = surfaceTile.tileBoundingRegion as TileBoundingRegion;
        const min = tileBoundingRegion.minimumHeight;
        const max = tileBoundingRegion.maximumHeight;

        if (surfaceTile.boundingVolumeSourceTile !== tile) {
            const cameraHeight = frameState.camera.positionCartographic.height;
            const distanceToMin = Math.abs(cameraHeight - min);
            const distanceToMax = Math.abs(cameraHeight - max);
            if (distanceToMin > distanceToMax) {
                tileBoundingRegion.minimumHeight = min;
                tileBoundingRegion.maximumHeight = min;
            } else {
                tileBoundingRegion.minimumHeight = max;
                tileBoundingRegion.maximumHeight = max;
            }
        }

        const result = tileBoundingRegion.distanceToCamera(frameState);

        tileBoundingRegion.minimumHeight = min;
        tileBoundingRegion.maximumHeight = max;

        return result;
    }

    /**
     * Determines the visibility of a given tile.  The tile may be fully visible, partially visible, or not
     * visible at all.  Tiles that are renderable and are at least partially visible will be shown by a call
     * to {@link GlobeSurfaceTileProvider#showTileThisFrame}.
     *
     * @param {QuadtreeTile} tile The tile instance.
     * @param {FrameState} frameState The state information about the current frame.
     * @param {QuadtreeOccluders} occluders The objects that may occlude this tile.
     *
     * @returns {Visibility} Visibility.NONE if the tile is not visible,
     *                       Visibility.PARTIAL if the tile is partially visible, or
     *                       Visibility.FULL if the tile is fully visible.
     */
    computeTileVisibility (
        tile:QuadtreeTile,
        frameState:FrameState,
        occluders?: QuadtreeOccluders
    ):Visibility {
        const distance = this.computeDistanceToTile(tile, frameState);
        tile._distance = distance;

        const undergroundVisible = isUndergroundVisible(this, frameState);

        // if (frameState.fog.enabled && !undergroundVisible) {
        //     if (CesiumMath.fog(distance, frameState.fog.density) >= 1.0) {
        //         // Tile is completely in fog so return that it is not visible.
        //         return Visibility.NONE;
        //     }
        // }

        const surfaceTile = tile.data as GlobeSurfaceTile;
        const tileBoundingRegion = surfaceTile.tileBoundingRegion as TileBoundingRegion;

        if (surfaceTile.boundingVolumeSourceTile === undefined) {
            // We have no idea where this tile is, so let's just call it partially visible.
            return Visibility.PARTIAL;
        }

        const cullingVolume = frameState.cullingVolume;
        let boundingVolume: OrientedBoundingBox | BoundingSphere = tileBoundingRegion.boundingVolume;

        if (!defined(boundingVolume)) {
            boundingVolume = tileBoundingRegion.boundingSphere;
        }

        // Check if the tile is outside the limit area in cartographic space
        surfaceTile.clippedByBoundaries = false;
        const clippedCartographicLimitRectangle = clipRectangleAntimeridian(
            tile.rectangle,
            this.cartographicLimitRectangle
        );
        const areaLimitIntersection = Rectangle.simpleIntersection(
            clippedCartographicLimitRectangle,
            tile.rectangle,
            rectangleIntersectionScratch
        );
        if (!defined(areaLimitIntersection)) {
            return Visibility.NONE;
        }
        if (!Rectangle.equals(areaLimitIntersection, tile.rectangle)) {
            surfaceTile.clippedByBoundaries = true;
        }

        if (frameState.mode !== SceneMode.SCENE3D) {
            boundingVolume = boundingSphereScratch;
            BoundingSphere.fromRectangleWithHeights2D(
                tile.rectangle,
                frameState.mapProjection,
                tileBoundingRegion.minimumHeight,
                tileBoundingRegion.maximumHeight,
                boundingVolume
            );
            Cartesian3.fromElements(
                boundingVolume.center.z,
                boundingVolume.center.x,
                boundingVolume.center.y,
                boundingVolume.center
            );

            if (
                frameState.mode === SceneMode.MORPHING &&
        defined(surfaceTile.renderedMesh)
            ) {
                boundingVolume = BoundingSphere.union(
                    tileBoundingRegion.boundingSphere,
                    boundingVolume,
                    boundingVolume
                );
            }
        }

        if (!defined(boundingVolume)) {
            return Visibility.PARTIAL;
        }

        // const clippingPlanes = this._clippingPlanes;
        // if (defined(clippingPlanes) && clippingPlanes.enabled) {
        //     const planeIntersection = clippingPlanes.computeIntersectionWithBoundingVolume(
        //         boundingVolume
        //     );
        //     tile.isClipped = planeIntersection !== Intersect.INSIDE;
        //     if (planeIntersection === Intersect.OUTSIDE) {
        //         return Visibility.NONE;
        //     }
        // }

        let visibility;
        const intersection = cullingVolume.computeVisibility(boundingVolume);

        if (intersection === Intersect.OUTSIDE) {
            visibility = Visibility.NONE;
        } else if (intersection === Intersect.INTERSECTING) {
            visibility = Visibility.PARTIAL;
        } else if (intersection === Intersect.INSIDE) {
            visibility = Visibility.FULL;
        }

        if (visibility === Visibility.NONE) {
            return visibility;
        }

        //     const ortho3D =
        //   frameState.mode === SceneMode.SCENE3D &&
        //   frameState.camera.frustum instanceof OrthographicFrustum;
        const ortho3D = false;
        if (frameState.mode === SceneMode.SCENE3D &&
            !ortho3D &&
            defined(occluders) &&
            !undergroundVisible
        ) {
            const occludeePointInScaledSpace = surfaceTile.occludeePointInScaledSpace;
            if (!defined(occludeePointInScaledSpace)) {
                return visibility as Visibility;
            }

            if (
                (occluders as QuadtreeOccluders).ellipsoid.isScaledSpacePointVisiblePossiblyUnderEllipsoid(
                    occludeePointInScaledSpace,
                    tileBoundingRegion.minimumHeight
                )
            ) {
                return visibility as Visibility;
            }

            return Visibility.NONE;
        }

        return visibility as Visibility;
    }

    /**
 * Determines the priority for loading this tile. Lower priority values load sooner.
 * @param {QuadtreeTile} tile The tile.
 * @param {FrameState} frameState The frame state.
 * @returns {Number} The load priority value.
 */
    computeTileLoadPriority (
        tile: QuadtreeTile,
        frameState: FrameState
    ): number {
        const surfaceTile = tile.data as any;
        if (surfaceTile === undefined) {
            return 0.0;
        }

        const obb = (surfaceTile.tileBoundingRegion as TileBoundingRegion).boundingVolume;
        if (obb === undefined) {
            return 0.0;
        }

        const cameraPosition = frameState.camera.positionWC;
        const cameraDirection = frameState.camera.directionWC;
        const tileDirection = Cartesian3.subtract(
            obb.center,
            cameraPosition,
            tileDirectionScratch
        );
        const magnitude = Cartesian3.magnitude(tileDirection);
        if (magnitude < CesiumMath.EPSILON5) {
            return 0.0;
        }
        Cartesian3.divideByScalar(tileDirection, magnitude, tileDirection);
        return (
            (1.0 - Cartesian3.dot(tileDirection, cameraDirection)) * tile._distance
        );
    }

    /**
     * Determines if the given tile can be refined
     * @param {QuadtreeTile} tile The tile to check.
     * @returns {boolean} True if the tile can be refined, false if it cannot.
     */
    canRefine (tile: QuadtreeTile): boolean {
        // Only allow refinement it we know whether or not the children of this tile exist.
        // For a tileset with `availability`, we'll always be able to refine.
        // We can ask for availability of _any_ child tile because we only need to confirm
        // that we get a yes or no answer, it doesn't matter what the answer is.
        if (defined((tile.data as GlobeSurfaceTile).terrainData)) {
            return true;
        }
        const childAvailable = this.terrainProvider.getTileDataAvailable(
            tile.x * 2,
            tile.y * 2,
            tile.level + 1
        );
        return childAvailable !== undefined;
    }

    /**
 * Determines if the given not-fully-loaded tile can be rendered without losing detail that
 * was present last frame as a result of rendering descendant tiles. This method will only be
 * called if this tile's descendants were rendered last frame. If the tile is fully loaded,
 * it is assumed that this method will return true and it will not be called.
 * @param {QuadtreeTile} tile The tile to check.
 * @returns {boolean} True if the tile can be rendered without losing detail.
 */
    canRenderWithoutLosingDetail (
        tile: QuadtreeTile
    ): boolean {
        const surfaceTile = tile.data as GlobeSurfaceTile;

        const readyImagery = readyImageryScratch;
        readyImagery.length = this._imageryLayers.length;

        let terrainReady = false;
        let initialImageryState = false;
        let imagery: TileImagery[] | undefined;

        if (defined(surfaceTile)) {
            // We can render even with non-ready terrain as long as all our rendered descendants
            // are missing terrain geometry too. i.e. if we rendered fills for more detailed tiles
            // last frame, it's ok to render a fill for this tile this frame.
            terrainReady = surfaceTile.terrainState === TerrainState.READY;

            // Initially assume all imagery layers are ready, unless imagery hasn't been initialized at all.
            initialImageryState = true;

            imagery = surfaceTile.imagery;
        }

        let i;
        let len: number;

        for (i = 0, len = readyImagery.length; i < len; ++i) {
            readyImagery[i] = initialImageryState;
        }

        if (defined(imagery)) {
            for (i = 0, len = (imagery as TileImagery[]).length; i < len; ++i) {
                const tileImagery = (imagery as TileImagery[])[i] as any;
                const loadingImagery = tileImagery.loadingImagery;
                const isReady =
          !defined(loadingImagery) ||
          (loadingImagery as Imagery).state === ImageryState.FAILED ||
          (loadingImagery as Imagery).state === ImageryState.INVALID;
                const layerIndex = (tileImagery.loadingImagery || tileImagery.readyImagery)
                    .imageryLayer._layerIndex;

                // For a layer to be ready, all tiles belonging to that layer must be ready.
                readyImagery[layerIndex] = isReady && readyImagery[layerIndex];
            }
        }

        const lastFrame = this.quadtree._lastSelectionFrameNumber;

        // Traverse the descendants looking for one with terrain or imagery that is not loaded on this tile.
        const stack = canRenderTraversalStack;
        stack.length = 0;
        stack.push(
            tile.southwestChild,
            tile.southeastChild,
            tile.northwestChild,
            tile.northeastChild
        );

        while (stack.length > 0) {
            const descendant = stack.pop();
            const lastFrameSelectionResult =
        descendant._lastSelectionResultFrame === lastFrame
            ? descendant._lastSelectionResult
            : TileSelectionResult.NONE;

            if (lastFrameSelectionResult === TileSelectionResult.RENDERED) {
                const descendantSurface = descendant.data;

                if (!defined(descendantSurface)) {
                    // Descendant has no data, so it can't block rendering.
                    continue;
                }

                if (
                    !terrainReady &&
          descendant.data.terrainState === TerrainState.READY
                ) {
                    // Rendered descendant has real terrain, but we don't. Rendering is blocked.
                    return false;
                }

                const descendantImagery = descendant.data.imagery;
                for (i = 0, len = descendantImagery.length; i < len; ++i) {
                    const descendantTileImagery = descendantImagery[i];
                    const descendantLoadingImagery = descendantTileImagery.loadingImagery;
                    const descendantIsReady =
            !defined(descendantLoadingImagery) ||
            descendantLoadingImagery.state === ImageryState.FAILED ||
            descendantLoadingImagery.state === ImageryState.INVALID;
                    const descendantLayerIndex = (
                        descendantTileImagery.loadingImagery ||
            descendantTileImagery.readyImagery
                    ).imageryLayer._layerIndex;

                    // If this imagery tile of a descendant is ready but the layer isn't ready in this tile,
                    // then rendering is blocked.
                    if (descendantIsReady && !readyImagery[descendantLayerIndex]) {
                        return false;
                    }
                }
            } else if (lastFrameSelectionResult === TileSelectionResult.REFINED) {
                stack.push(
                    descendant.southwestChild,
                    descendant.southeastChild,
                    descendant.northwestChild,
                    descendant.northeastChild
                );
            }
        }

        return true;
    }

    /**
     * Shows a specified tile in this frame.  The provider can cause the tile to be shown by adding
     * render commands to the commandList, or use any other method as appropriate.  The tile is not
     * expected to be visible next frame as well, unless this method is called next frame, too.
     *
     * @param {QuadtreeTile} tile The tile instance.
     * @param {FrameState} frameState The state information of the current rendering frame.
     */
    showTileThisFrame (
        tile: QuadtreeTile,
        frameState?: FrameState
    ): void {
        let readyTextureCount = 0;
        const tileImageryCollection = (tile.data as GlobeSurfaceTile).imagery;
        for (let i = 0, len = tileImageryCollection.length; i < len; ++i) {
            const tileImagery = tileImageryCollection[i];
            if (
                defined(tileImagery.readyImagery) &&
        tileImagery.readyImagery.imageryLayer.alpha !== 0.0
            ) {
                ++readyTextureCount;
            }
        }

        let tileSet = this._tilesToRenderByTextureCount[readyTextureCount];
        if (!defined(tileSet)) {
            tileSet = [];
            this._tilesToRenderByTextureCount[readyTextureCount] = tileSet;
        }

        tileSet.push(tile);

        const surfaceTile = tile.data as GlobeSurfaceTile;
        if (!defined(surfaceTile.vertexArray)) {
            this._hasFillTilesThisFrame = true;
        } else {
            this._hasLoadedTilesThisFrame = true;
        }

        const debug = this._debug;
        ++debug.tilesRendered;
        debug.texturesRendered += readyTextureCount;
    }

    /**
     * Loads, or continues loading, a given tile.  This function will continue to be called
     * until {@link QuadtreeTile#state} is no longer {@link QuadtreeTileLoadState#LOADING}.  This function should
     * not be called before {@link GlobeSurfaceTileProvider#ready} returns true.
     *
     * @param {FrameState} frameState The frame state.
     * @param {QuadtreeTile} tile The tile to load.
     *
     * @exception {DeveloperError} <code>loadTile</code> must not be called before the tile provider is ready.
     */
    loadTile (frameState: FrameState, tile: QuadtreeTile) {
        // We don't want to load imagery until we're certain that the terrain tiles are actually visible.
        // So if our bounding volume isn't accurate because it came from another tile, load terrain only
        // initially. If we load some terrain and suddenly have a more accurate bounding volume and the
        // tile is _still_ visible, give the tile a chance to load imagery immediately rather than
        // waiting for next frame.

        let surfaceTile = tile.data as any;
        let terrainOnly = true;
        let terrainStateBefore;
        if (defined(surfaceTile)) {
            terrainOnly =
      surfaceTile.boundingVolumeSourceTile !== tile ||
      tile._lastSelectionResult === TileSelectionResult.CULLED_BUT_NEEDED;
            terrainStateBefore = surfaceTile.terrainState;
        }

        GlobeSurfaceTile.processStateMachine(
            tile,
            frameState,
            this.terrainProvider as EllipsoidTerrainProvider,
            this._imageryLayers,
            this._vertexArraysToDestroy,
            terrainOnly
        );

        surfaceTile = tile.data;
        if (terrainOnly && terrainStateBefore !== surfaceTile.terrainState) {
            // Terrain state changed. If:
            // a) The tile is visible, and
            // b) The bounding volume is accurate (updated as a side effect of computing visibility)
            // Then we'll load imagery, too.
            if (
                this.computeTileVisibility(tile, frameState, this.quadtree.occluders) !==
                Visibility.NONE &&
                surfaceTile.boundingVolumeSourceTile === tile
            ) {
                terrainOnly = false;
                GlobeSurfaceTile.processStateMachine(
                    tile,
                    frameState,
                    this.terrainProvider as EllipsoidTerrainProvider,
                    this._imageryLayers,
                    this._vertexArraysToDestroy,
                    terrainOnly
                );
            }
        }
    }

    /**
 * Gets the maximum geometric error allowed in a tile at a given level, in meters.  This function should not be
 * called before {@link GlobeSurfaceTileProvider#ready} returns true.
 *
 * @param {Number} level The tile level for which to get the maximum geometric error.
 * @returns {Number} The maximum geometric error in meters.
 */
    getLevelMaximumGeometricError (level: number): number {
        return this._terrainProvider.getLevelMaximumGeometricError(level) as number;
    }
}
export { GlobeSurfaceTileProvider };
