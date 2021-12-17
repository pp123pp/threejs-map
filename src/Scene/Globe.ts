import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { defaultValue } from '@/Core/defaultValue';
import { defined } from '@/Core/defined';
import { DeveloperError } from '@/Core/DeveloperError';
import { Ellipsoid } from '@/Core/Ellipsoid';
import { EllipsoidTerrainProvider } from '@/Core/EllipsoidTerrainProvider';
import { Event } from '@/Core/Event';
import { Object3DCollection } from '@/Core/Object3DCollection';
import { Ray } from '@/Core/Ray';
import { Rectangle } from '@/Core/Rectangle';
import { FrameState } from './FrameState';
import { GlobeSurfaceTileProvider } from './GlobeSurfaceTileProvider';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { QuadtreePrimitive } from './QuadtreePrimitive';

const scratchGetHeightCartesian = new Cartesian3();
const scratchGetHeightIntersection = new Cartesian3();
const scratchGetHeightCartographic = new Cartographic();
const scratchGetHeightRay = new Ray();

function tileIfContainsCartographic (tile: any, cartographic: any) {
    return defined(tile) && Rectangle.contains(tile.rectangle, cartographic)
        ? tile
        : undefined;
}

class Globe extends Object3DCollection {
    _ellipsoid:Ellipsoid
    _surface: QuadtreePrimitive;
    maximumScreenSpaceError: number;
    _imageryLayerCollection: ImageryLayerCollection;
    _terrainProviderChanged: Event;
    tileCacheSize: number;
    _terrainProvider: EllipsoidTerrainProvider;
    showGroundAtmosphere: true;
    _zoomedOutOceanSpecularIntensity: number;
    terrainExaggeration: number;
    terrainExaggerationRelativeHeight: number;
    constructor (ellipsoid = Ellipsoid.WGS84) {
        super();
        const terrainProvider = new EllipsoidTerrainProvider({
            ellipsoid: ellipsoid
        });

        this._ellipsoid = ellipsoid;

        const imageryLayerCollection = new ImageryLayerCollection();

        this._imageryLayerCollection = imageryLayerCollection;

        this._surface = new QuadtreePrimitive({
            tileProvider: new GlobeSurfaceTileProvider({
                terrainProvider: new EllipsoidTerrainProvider(),
                imageryLayers: imageryLayerCollection
                // surfaceShaderSet: this._surfaceShaderSet
            })
        });

        this._terrainProvider = terrainProvider;
        this._terrainProviderChanged = new Event();

        this.maximumScreenSpaceError = 2;

        /**
         * The size of the terrain tile cache, expressed as a number of tiles.  Any additional
         * tiles beyond this number will be freed, as long as they aren't needed for rendering
         * this frame.  A larger number will consume more memory but will show detail faster
         * when, for example, zooming out and then back in.
         *
         * @type {Number}
         * @default 100
         */
        this.tileCacheSize = 100;

        /**
         * Enable the ground atmosphere, which is drawn over the globe when viewed from a distance between <code>lightingFadeInDistance</code> and <code>lightingFadeOutDistance</code>.
         *
         * @demo {@link https://sandcastle.cesium.com/index.html?src=Ground%20Atmosphere.html|Ground atmosphere demo in Sandcastle}
         *
         * @type {Boolean}
         * @default true
         */
        this.showGroundAtmosphere = true;

        this._zoomedOutOceanSpecularIntensity = 0.4;

        /**
         * A scalar used to exaggerate the terrain. Defaults to <code>1.0</code> (no exaggeration).
         * A value of <code>2.0</code> scales the terrain by 2x.
         * A value of <code>0.0</code> makes the terrain completely flat.
         * Note that terrain exaggeration will not modify any other primitive as they are positioned relative to the ellipsoid.
         * @type {Number}
         * @default 1.0
         */
        this.terrainExaggeration = 1.0;

        /**
         * The height from which terrain is exaggerated. Defaults to <code>0.0</code> (scaled relative to ellipsoid surface).
         * Terrain that is above this height will scale upwards and terrain that is below this height will scale downwards.
         * Note that terrain exaggeration will not modify any other primitive as they are positioned relative to the ellipsoid.
         * If {@link Globe#terrainExaggeration} is <code>1.0</code> this value will have no effect.
         * @type {Number}
         * @default 0.0
         */
        this.terrainExaggerationRelativeHeight = 0.0;

        this.terrainProvider = new EllipsoidTerrainProvider();
    }

    get ellipsoid (): Ellipsoid {
        return this._ellipsoid;
    }

    get terrainProvider (): EllipsoidTerrainProvider {
        return this._terrainProvider;
    }

    set terrainProvider (value: EllipsoidTerrainProvider) {
        if (value !== this._terrainProvider) {
            this._terrainProvider = value;
            this._terrainProviderChanged.raiseEvent(value);
        }
    }

    get imageryLayers (): ImageryLayerCollection {
        return this._imageryLayerCollection;
    }

    get imageryLayersUpdatedEvent (): Event {
        return this._surface.tileProvider.imageryLayersUpdatedEvent;
    }

    get tilesLoaded (): boolean {
        if (!defined(this._surface)) {
            return true;
        }
        return (
            this._surface.tileProvider.ready &&
            this._surface._tileLoadQueueHigh.length === 0 &&
            this._surface._tileLoadQueueMedium.length === 0 &&
            this._surface._tileLoadQueueLow.length === 0
        );
    }

    get terrainProviderChanged (): Event {
        return this._terrainProviderChanged;
    }

    /**
     * Get the height of the surface at a given cartographic.
     *
     * @param {Cartographic} cartographic The cartographic for which to find the height.
     * @returns {Number|undefined} The height of the cartographic or undefined if it could not be found.
     */
    getHeight (cartographic: Cartographic): number | undefined {
    // >>includeStart('debug', pragmas.debug);
        if (!defined(cartographic)) {
            throw new DeveloperError('cartographic is required');
        }
        // >>includeEnd('debug');

        const levelZeroTiles = this._surface._levelZeroTiles;
        if (!defined(levelZeroTiles)) {
            return;
        }

        let tile;
        let i;

        const length = levelZeroTiles.length;
        for (i = 0; i < length; ++i) {
            tile = levelZeroTiles[i];
            if (Rectangle.contains(tile.rectangle, cartographic)) {
                break;
            }
        }

        if (i >= length) {
            return undefined;
        }

        let tileWithMesh = tile;

        while (defined(tile)) {
            tile =
        tileIfContainsCartographic(tile._southwestChild, cartographic) ||
        tileIfContainsCartographic(tile._southeastChild, cartographic) ||
        tileIfContainsCartographic(tile._northwestChild, cartographic) ||
        tile._northeastChild;

            if (
                defined(tile) &&
        defined(tile.data) &&
        defined(tile.data.renderedMesh)
            ) {
                tileWithMesh = tile;
            }
        }

        tile = tileWithMesh;

        // This tile was either rendered or culled.
        // It is sometimes useful to get a height from a culled tile,
        // e.g. when we're getting a height in order to place a billboard
        // on terrain, and the camera is looking at that same billboard.
        // The culled tile must have a valid mesh, though.
        if (
            !defined(tile) ||
      !defined(tile.data) ||
      !defined(tile.data.renderedMesh)
        ) {
            // Tile was not rendered (culled).
            return undefined;
        }

        const projection = this._surface._tileProvider.tilingScheme.projection;
        const ellipsoid = this._surface._tileProvider.tilingScheme.ellipsoid;

        // cartesian has to be on the ellipsoid surface for `ellipsoid.geodeticSurfaceNormal`
        const cartesian = Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            0.0,
            ellipsoid,
            scratchGetHeightCartesian
        );

        const ray = scratchGetHeightRay;
        const surfaceNormal = ellipsoid.geodeticSurfaceNormal(cartesian, ray.direction) as Cartesian3;

        // Try to find the intersection point between the surface normal and z-axis.
        // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
        const rayOrigin = ellipsoid.getSurfaceNormalIntersectionWithZAxis(
            cartesian,
            11500.0,
            ray.origin
        );

        // Theoretically, not with Earth datums, the intersection point can be outside the ellipsoid
        if (!defined(rayOrigin)) {
            // intersection point is outside the ellipsoid, try other value
            // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
            let minimumHeight;
            if (defined(tile.data.tileBoundingRegion)) {
                minimumHeight = tile.data.tileBoundingRegion.minimumHeight;
            }
            const magnitude = Math.min(defaultValue(minimumHeight, 0.0), -11500.0);

            // multiply by the *positive* value of the magnitude
            const vectorToMinimumPoint = Cartesian3.multiplyByScalar(
                surfaceNormal,
                Math.abs(magnitude) + 1,
                scratchGetHeightIntersection
            );
            Cartesian3.subtract(cartesian, vectorToMinimumPoint, ray.origin);
        }

        const intersection = tile.data.pick(
            ray,
            undefined,
            projection,
            false,
            scratchGetHeightIntersection
        );
        if (!defined(intersection)) {
            return undefined;
        }

        return (ellipsoid as any).cartesianToCartographic(
            intersection,
            scratchGetHeightCartographic
        ).height;
    }

    render (frameState: FrameState): void {
        if (!this.visible) {
            return;
        }

        const surface = this._surface;
        const pass = frameState.passes;

        if (pass.render) {
            surface.render(frameState);
        }
    }

    beginFrame (frameState: FrameState): void {
        const surface = this._surface;
        const tileProvider = surface.tileProvider;
        const terrainProvider = this.terrainProvider;

        const pass = frameState.passes;
        const mode = frameState.mode;

        if (pass.render) {
            if (this.showGroundAtmosphere) {
                this._zoomedOutOceanSpecularIntensity = 0.4;
            } else {
                this._zoomedOutOceanSpecularIntensity = 0.5;
            }

            tileProvider.terrainProvider = this.terrainProvider;

            surface.maximumScreenSpaceError = this.maximumScreenSpaceError;
            surface.tileCacheSize = this.tileCacheSize;

            tileProvider.terrainProvider = this.terrainProvider;

            surface.beginFrame(frameState);
        }
    }

    endFrame (frameState: FrameState): void {
        if (!this.visible) {
            return;
        }

        if (frameState.passes.render) {
            this._surface.endFrame(frameState);
        }
    }

    update (frameState: FrameState): void {
        if (!this.visible) {
            return;
        }

        if (frameState.passes.render) {
            this._surface.update(frameState);
        }
    }
}

export { Globe };
