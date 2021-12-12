
import { BoundingSphere } from '@/Core/BoundingSphere';
import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartesian4 } from '@/Core/Cartesian4';
import { CesiumColor } from '@/Core/CesiumColor';
import { defaultValue } from '@/Core/defaultValue';
import { defined } from '@/Core/defined';
import { DeveloperError } from '@/Core/DeveloperError';
import { EllipsoidTerrainProvider } from '@/Core/EllipsoidTerrainProvider';
import { Event } from '@/Core/Event';
import { GeographicTilingScheme } from '@/Core/GeographicTilingScheme';
import { OrientedBoundingBox } from '@/Core/OrientedBoundingBox';
import { Rectangle } from '@/Core/Rectangle';
import { SceneMode } from '@/Core/SceneMode';
import { Vector4, Vector3 } from 'three';
import { TerrainProvider } from './../Core/TerrainProvider';
import { FrameState } from './FrameState';
import { ImageryLayer } from './ImageryLayer';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { QuadtreePrimitive } from './QuadtreePrimitive';
import { QuadtreeTileLoadState } from './QuadtreeTileLoadState';
import TileSelectionResult from './TileSelectionResult';

// function getTileReadyCallback (tileImageriesToFree, layer, terrainProvider) {
//     return function (tile) {
//         let tileImagery;
//         let imagery;
//         let startIndex = -1;
//         const tileImageryCollection = tile.data.imagery;
//         const length = tileImageryCollection.length;
//         let i;
//         for (i = 0; i < length; ++i) {
//             tileImagery = tileImageryCollection[i];
//             imagery = defaultValue(
//                 tileImagery.readyImagery,
//                 tileImagery.loadingImagery
//             );
//             if (imagery.imageryLayer === layer) {
//                 startIndex = i;
//                 break;
//             }
//         }

//         if (startIndex !== -1) {
//             const endIndex = startIndex + tileImageriesToFree;
//             tileImagery = tileImageryCollection[endIndex];
//             imagery = defined(tileImagery)
//                 ? defaultValue(tileImagery.readyImagery, tileImagery.loadingImagery)
//                 : undefined;
//             if (!defined(imagery) || imagery.imageryLayer !== layer) {
//                 // Return false to keep the callback if we have to wait on the skeletons
//                 // Return true to remove the callback if something went wrong
//                 return !layer._createTileImagerySkeletons(
//                     tile,
//                     terrainProvider,
//                     endIndex
//                 );
//             }

//             for (i = startIndex; i < endIndex; ++i) {
//                 tileImageryCollection[i].freeResources();
//             }

//             tileImageryCollection.splice(startIndex, tileImageriesToFree);
//         }

//         return true; // Everything is done, so remove the callback
//     };
// }

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
} = {

};

const addDrawCommandsForTile = (tileProvider: any, tile: any, frameState: FrameState) => {
    const surfaceTile = tile.data;

    let rtc = surfaceTile.center;
    const encoding = surfaceTile.pickTerrain.mesh.encoding;

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

    const quantization = surfaceTile.pickTerrain.mesh.encoding.quantization;
    surfaceShaderSetOptions.enableLighting = tileProvider.enableLighting;
    surfaceShaderSetOptions.useWebMercatorProjection = useWebMercatorProjection;

    const tileImageryCollection = surfaceTile.imagery;
    let imageryIndex = 0;
    const imageryLen = tileImageryCollection.length;

    let initialColor = tileProvider._firstPassInitialColor;

    do {
        let numberOfDayTextures = 0;

        var command;
        var uniformMap;

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

        Vector4.clone(initialColor, uniformMap.initialColor);

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

        uniformMap.scaleAndBias = encoding.matrix;

        command.geometry = surfaceTile.geometry;
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
    _quadtree: QuadtreePrimitive | undefined;
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
        boundingSphereTile: BoundingSphere | undefined
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

    get tilingScheme (): GeographicTilingScheme | void{
        return this._terrainProvider.tilingScheme;
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

    get ready (): boolean {
        return (
            this._terrainProvider.ready &&
            (this._imageryLayers.length === 0 ||
              this._imageryLayers.get(0).imageryProvider.ready)
        );
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

    _onLayerRemoved (layer: ImageryLayer, index?: number) {
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
}
export { GlobeSurfaceTileProvider };
