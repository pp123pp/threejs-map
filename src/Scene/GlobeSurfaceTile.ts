/* eslint-disable no-prototype-builtins */
import { BoundingSphere } from '@/Core/BoundingSphere';
import { Cartesian3 } from '@/Core/Cartesian3';
import { defined } from '@/Core/defined';
import { EllipsoidTerrainProvider } from '@/Core/EllipsoidTerrainProvider';
import { TerrainEncoding } from '@/Core/TerrainEncoding';
import { TerrainMesh } from '@/Core/TerrainMesh';
import { TerrainQuantization } from '@/Core/TerrainQuantization';
import { BufferGeometry, Float32BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, StaticDrawUsage, Uint16BufferAttribute } from 'three';
import { Context } from './Context';
import { FrameState } from './FrameState';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { QuadtreeTile } from './QuadtreeTile';
import { QuadtreeTileLoadState } from './QuadtreeTileLoadState';
import { TerrainState } from './TerrainState';
import when from 'when';
import { TerrainProvider } from '@/Core/TerrainProvider';
import { RequestState } from '@/Core/RequestState';
import { TileProviderError } from '@/Core/TileProviderError';
import { RequestType } from '@/Core/RequestType';
import { Request } from '@/Core/Request';
function disposeArray () {

    // this.array = null;

}

function createResources (
    surfaceTile: GlobeSurfaceTile,
    context: Context,
    terrainProvider: EllipsoidTerrainProvider,
    x: number,
    y: number,
    level: number,
    vertexArraysToDestroy: any[]
) {
    surfaceTile.vertexArray = GlobeSurfaceTile._createVertexArrayForMesh(
        context,
        surfaceTile.mesh
    );
    surfaceTile.terrainState = TerrainState.READY;
    surfaceTile.fill =
      surfaceTile.fill && surfaceTile.fill.destroy(vertexArraysToDestroy);
}

function processTerrainStateMachine (
    tile: QuadtreeTile,
    frameState: FrameState,
    terrainProvider: EllipsoidTerrainProvider,
    imageryLayerCollection: ImageryLayerCollection,
    vertexArraysToDestroy: any[]
) {
    const surfaceTile = tile.data;

    // If this tile is FAILED, we'll need to upsample from the parent. If the parent isn't
    // ready for that, let's push it along.
    const parent = tile.parent;
    if (
        surfaceTile.terrainState === TerrainState.FAILED &&
      parent !== undefined
    ) {
        const parentReady =
        parent.data !== undefined &&
        parent.data.terrainData !== undefined &&
        parent.data.terrainData.canUpsample !== false;
        if (!parentReady) {
            GlobeSurfaceTile.processStateMachine(
                parent,
                frameState,
                terrainProvider,
                imageryLayerCollection,
                vertexArraysToDestroy,
                true
            );
        }
    }

    if (surfaceTile.terrainState === TerrainState.FAILED) {
        upsample(
            surfaceTile,
            tile,
            frameState,
            terrainProvider,
            tile.x,
            tile.y,
            tile.level
        );
    }

    if (surfaceTile.terrainState === TerrainState.UNLOADED) {
        requestTileGeometry(
            surfaceTile,
            terrainProvider,
            tile.x,
            tile.y,
            tile.level
        );
    }

    if (surfaceTile.terrainState === TerrainState.RECEIVED) {
        transform(
            surfaceTile,
            frameState,
            terrainProvider,
            tile.x,
            tile.y,
            tile.level
        );
    }

    if (surfaceTile.terrainState === TerrainState.TRANSFORMED) {
        createResources(
            surfaceTile,
            frameState.context,
            terrainProvider,
            tile.x,
            tile.y,
            tile.level,
            vertexArraysToDestroy
        );
    }

    if (
        surfaceTile.terrainState >= TerrainState.RECEIVED &&
      surfaceTile.waterMaskTexture === undefined &&
      terrainProvider.hasWaterMask
    ) {
        const terrainData = surfaceTile.terrainData;
        if (terrainData.waterMask !== undefined) {
            // createWaterMaskTextureIfNeeded(frameState.context, surfaceTile);
        } else {
            const sourceTile = surfaceTile._findAncestorTileWithTerrainData(tile);
            if (defined(sourceTile) && defined(sourceTile.data.waterMaskTexture)) {
                surfaceTile.waterMaskTexture = sourceTile.data.waterMaskTexture;
                ++surfaceTile.waterMaskTexture.referenceCount;
                surfaceTile._computeWaterMaskTranslationAndScale(
                    tile,
                    sourceTile,
                    surfaceTile.waterMaskTranslationAndScale
                );
            }
        }
    }
}

const scratchCreateMeshOptions = {
    tilingScheme: undefined,
    x: 0,
    y: 0,
    level: 0,
    exaggeration: 1.0,
    exaggerationRelativeHeight: 0.0,
    throttle: true
};

function transform (surfaceTile:any, frameState: FrameState, terrainProvider: any, x: number, y: number, level: number) {
    const tilingScheme = terrainProvider.tilingScheme;

    const createMeshOptions = scratchCreateMeshOptions;
    createMeshOptions.tilingScheme = tilingScheme;
    createMeshOptions.x = x;
    createMeshOptions.y = y;
    createMeshOptions.level = level;
    createMeshOptions.exaggeration = frameState.terrainExaggeration;
    createMeshOptions.exaggerationRelativeHeight =
      frameState.terrainExaggerationRelativeHeight;
    createMeshOptions.throttle = true;

    const terrainData = surfaceTile.terrainData;
    const meshPromise = terrainData.createMesh(createMeshOptions);

    if (!defined(meshPromise)) {
        // Postponed.
        return;
    }

    surfaceTile.terrainState = TerrainState.TRANSFORMING;

    (when as any)(
        meshPromise,
        function (mesh: any) {
            surfaceTile.mesh = mesh;
            surfaceTile.terrainState = TerrainState.TRANSFORMED;
        },
        function () {
            surfaceTile.terrainState = TerrainState.FAILED;
        }
    );
}

function upsample (surfaceTile: any, tile: any, frameState: any, terrainProvider: any, x: any, y: any, level: any) {
    const parent = tile.parent;
    if (!parent) {
        // Trying to upsample from a root tile. No can do. This tile is a failure.
        tile.state = QuadtreeTileLoadState.FAILED;
        return;
    }

    const sourceData = parent.data.terrainData;
    const sourceX = parent.x;
    const sourceY = parent.y;
    const sourceLevel = parent.level;

    if (!defined(sourceData)) {
        // Parent is not available, so we can't upsample this tile yet.
        return;
    }

    const terrainDataPromise = sourceData.upsample(
        terrainProvider.tilingScheme,
        sourceX,
        sourceY,
        sourceLevel,
        x,
        y,
        level
    );
    if (!defined(terrainDataPromise)) {
        // The upsample request has been deferred - try again later.
        return;
    }

    surfaceTile.terrainState = TerrainState.RECEIVING;

    when(
        terrainDataPromise,
        function (terrainData) {
            surfaceTile.terrainData = terrainData;
            surfaceTile.terrainState = TerrainState.RECEIVED;
        }
        // function () {
        //     surfaceTile.terrainState = TerrainState.FAILED;
        // }
    );
}

function requestTileGeometry (surfaceTile: any, terrainProvider: any, x: any, y: any, level: any) {
    function success (terrainData: any) {
        surfaceTile.terrainData = terrainData;
        surfaceTile.terrainState = TerrainState.RECEIVED;
        surfaceTile.request = undefined;
    }

    function failure (error: any) {
        if (surfaceTile.request.state === RequestState.CANCELLED) {
        // Cancelled due to low priority - try again later.
            surfaceTile.terrainData = undefined;
            surfaceTile.terrainState = TerrainState.UNLOADED;
            surfaceTile.request = undefined;
            return;
        }

        // Initially assume failure.  handleError may retry, in which case the state will
        // change to RECEIVING or UNLOADED.
        surfaceTile.terrainState = TerrainState.FAILED;
        surfaceTile.request = undefined;

        const message =
        'Failed to obtain terrain tile X: ' +
        x +
        ' Y: ' +
        y +
        ' Level: ' +
        level +
        '. Error message: "' +
        error +
        '"';
        terrainProvider._requestError = TileProviderError.handleError(
            terrainProvider._requestError,
            terrainProvider,
            terrainProvider.errorEvent,
            message,
            x,
            y,
            level,
            doRequest
        );
    }

    function doRequest () {
        // Request the terrain from the terrain provider.
        const request = new Request({
            throttle: false,
            throttleByServer: true,
            type: RequestType.TERRAIN
        });
        surfaceTile.request = request;

        const requestPromise = terrainProvider.requestTileGeometry(
            x,
            y,
            level,
            request
        );

        // If the request method returns undefined (instead of a promise), the request
        // has been deferred.
        if (defined(requestPromise)) {
            surfaceTile.terrainState = TerrainState.RECEIVING;
            (when as any)(requestPromise, success, failure);
        } else {
        // Deferred - try again later.
            surfaceTile.terrainState = TerrainState.UNLOADED;
            surfaceTile.request = undefined;
        }
    }

    doRequest();
}

function prepareNewTile (tile: QuadtreeTile, terrainProvider: EllipsoidTerrainProvider, imageryLayerCollection: ImageryLayerCollection) {
    let available = terrainProvider.getTileDataAvailable(
        tile.x,
        tile.y,
        tile.level
    );

    if (!defined(available) && defined(tile.parent)) {
        // Provider doesn't know if this tile is available. Does the parent tile know?
        const parent = tile.parent;
        const parentSurfaceTile = parent.data;
        if (defined(parentSurfaceTile) && defined(parentSurfaceTile.terrainData)) {
            available = parentSurfaceTile.terrainData.isChildAvailable(
                parent.x,
                parent.y,
                tile.x,
                tile.y
            );
        }
    }

    if (available === false) {
        // This tile is not available, so mark it failed so we start upsampling right away.
        tile.data.terrainState = TerrainState.FAILED;
    }

    // Map imagery tiles to this terrain tile
    for (let i = 0, len = imageryLayerCollection.length; i < len; ++i) {
        const layer = imageryLayerCollection.get(i);
        if (layer.show) {
            layer._createTileImagerySkeletons(tile, terrainProvider);
        }
    }
}

class GlobeSurfaceTile {
    imagery: any[];
    terrainData?: any;
    vertexArray?: any;
    tileBoundingRegion?: undefined;
    occludeePointInScaledSpace: Cartesian3;
    boundingVolumeSourceTile?: any;
    boundingVolumeIsFromMesh: boolean;
    terrainState: TerrainState;
    mesh?: any;
    fill?: any;
    pickBoundingSphere: BoundingSphere;
    surfaceShader?: any;
    isClipped: boolean;
    clippedByBoundaries: boolean;
    wireframeVertexArray?: any
    constructor () {
        /**
         * The {@link TileImagery} attached to this tile.
         * @type {TileImagery[]}
         * @default []
         */
        this.imagery = [];

        // this.waterMaskTexture = undefined;
        // this.waterMaskTranslationAndScale = new Cartesian4(0.0, 0.0, 1.0, 1.0);

        this.terrainData = undefined;
        this.vertexArray = undefined;

        /**
         * A bounding region used to estimate distance to the tile. The horizontal bounds are always tight-fitting,
         * but the `minimumHeight` and `maximumHeight` properties may be derived from the min/max of an ancestor tile
         * and be quite loose-fitting and thus very poor for estimating distance.
         * @type {TileBoundingRegion}
         */
        this.tileBoundingRegion = undefined;
        this.occludeePointInScaledSpace = new Cartesian3();
        this.boundingVolumeSourceTile = undefined;
        this.boundingVolumeIsFromMesh = false;

        this.terrainState = TerrainState.UNLOADED;
        this.mesh = undefined;
        this.fill = undefined;

        this.pickBoundingSphere = new BoundingSphere();

        this.surfaceShader = undefined;
        this.isClipped = true;

        this.clippedByBoundaries = false;
    }

    freeVertexArray (): void {
        GlobeSurfaceTile._freeVertexArray(this.vertexArray);
        this.vertexArray = undefined;
        GlobeSurfaceTile._freeVertexArray(this.wireframeVertexArray);
        this.wireframeVertexArray = undefined;
    }

    static _freeVertexArray (vertexArray: any): void {
        if (defined(vertexArray)) {
            const indexBuffer = vertexArray.indexBuffer;

            if (!vertexArray.isDestroyed()) {
                vertexArray.destroy();
            }

            if (
                defined(indexBuffer) &&
            !indexBuffer.isDestroyed() &&
            defined(indexBuffer.referenceCount)
            ) {
                --indexBuffer.referenceCount;
                if (indexBuffer.referenceCount === 0) {
                    indexBuffer.destroy();
                }
            }
        }
    }

    static initialize (
        tile: QuadtreeTile,
        terrainProvider: EllipsoidTerrainProvider,
        imageryLayerCollection: ImageryLayerCollection
    ): void {
        let surfaceTile = tile.data;
        if (!defined(surfaceTile)) {
            surfaceTile = tile.data = new GlobeSurfaceTile();
        }

        if (tile.state === QuadtreeTileLoadState.START) {
            prepareNewTile(tile, terrainProvider, imageryLayerCollection);
            tile.state = QuadtreeTileLoadState.LOADING;
        }
    }

    static processStateMachine (
        tile: QuadtreeTile,
        frameState: FrameState,
        terrainProvider: EllipsoidTerrainProvider,
        imageryLayerCollection: ImageryLayerCollection,
        vertexArraysToDestroy: any[],
        terrainOnly: boolean
    ): void {
        GlobeSurfaceTile.initialize(tile, (terrainProvider as EllipsoidTerrainProvider), imageryLayerCollection);

        const surfaceTile = tile.data;

        if (tile.state === QuadtreeTileLoadState.LOADING) {
            processTerrainStateMachine(
                tile,
                frameState,
                terrainProvider,
                imageryLayerCollection,
                vertexArraysToDestroy
            );
        }

        // From here down we're loading imagery, not terrain. We don't want to load imagery until
        // we're certain that the terrain tiles are actually visible, though. We'll load terrainOnly
        // in these scenarios:
        //   * our bounding volume isn't accurate so we're not certain this tile is really visible (see GlobeSurfaceTileProvider#loadTile).
        //   * we want to upsample from this tile but don't plan to render it (see processTerrainStateMachine).
        if (terrainOnly) {
            return;
        }

        const wasAlreadyRenderable = tile.renderable;

        // The terrain is renderable as soon as we have a valid vertex array.
        tile.renderable = defined(surfaceTile.vertexArray);

        // But it's not done loading until it's in the READY state.
        const isTerrainDoneLoading = surfaceTile.terrainState === TerrainState.READY;

        // If this tile's terrain and imagery are just upsampled from its parent, mark the tile as
        // upsampled only.  We won't refine a tile if its four children are upsampled only.
        tile.upsampledFromParent =
          defined(surfaceTile.terrainData) &&
          surfaceTile.terrainData.wasCreatedByUpsampling();

        const isImageryDoneLoading = surfaceTile.processImagery(
            tile,
            terrainProvider,
            frameState
        );

        if (isTerrainDoneLoading && isImageryDoneLoading) {
            const callbacks = tile._loadedCallbacks;
            const newCallbacks = {};
            for (const layerId in callbacks) {
                if (callbacks.hasOwnProperty(layerId)) {
                    if (!callbacks[layerId](tile)) {
                        newCallbacks[layerId] = callbacks[layerId];
                    }
                }
            }
            tile._loadedCallbacks = newCallbacks;

            tile.state = QuadtreeTileLoadState.DONE;
        }

        // Once a tile is renderable, it stays renderable, because doing otherwise would
        // cause detail (or maybe even the entire globe) to vanish when adding a new
        // imagery layer. `GlobeSurfaceTileProvider._onLayerAdded` sets renderable to
        // false for all affected tiles that are not currently being rendered.
        if (wasAlreadyRenderable) {
            tile.renderable = true;
        }
    }

    static _createVertexArrayForMesh (context: Context, mesh: TerrainMesh): void {
        const geometry = new BufferGeometry();

        const indexBuffers = (mesh.indices as any).indexBuffers || {};
        let indexBuffer = indexBuffers[context.id];

        if (!defined(indexBuffer)) {
            indexBuffer = new Uint16BufferAttribute(mesh.indices, 1).onUpload(disposeArray);

            indexBuffers[context.id] = indexBuffer;
            (mesh.indices as any).indexBuffers = indexBuffers;
        } else {
            ++indexBuffer.referenceCount;
        }

        geometry.setIndex(indexBuffer);

        if ((mesh.encoding as TerrainEncoding).quantization === TerrainQuantization.BITS12) {
            const vertexBuffer = new Float32BufferAttribute(mesh.vertices, 4).onUpload(disposeArray);
            geometry.setAttribute('compressed0', vertexBuffer);
        } else {
            const vertexBuffer = new InterleavedBuffer(mesh.vertices, 7);
            const position3DAndHeight = new InterleavedBufferAttribute(vertexBuffer, 4, 0, false);
            // position3DAndHeight.setUsage = StaticDrawUsage;

            const textureCoordAndEncodedNormals = new InterleavedBufferAttribute(vertexBuffer, 2, 4, false);
            // textureCoordAndEncodedNormals.setUsage = StaticDrawUsage;

            geometry.setAttribute('position3DAndHeight', position3DAndHeight);
            geometry.setAttribute('textureCoordAndEncodedNormals', textureCoordAndEncodedNormals);
        }

        // tileTerrain.vertexArray = mesh.vertices;
        (mesh as any).geometry = geometry;
    }
}

export { GlobeSurfaceTile };
