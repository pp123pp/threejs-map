import { defined } from '@/Core/defined';
import { Ellipsoid } from '@/Core/Ellipsoid';
import { EllipsoidTerrainProvider } from '@/Core/EllipsoidTerrainProvider';
import { Event } from '@/Core/Event';
import { Object3DCollection } from '@/Core/Object3DCollection';
import { FrameState } from './FrameState';
import { GlobeSurfaceTileProvider } from './GlobeSurfaceTileProvider';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { QuadtreePrimitive } from './QuadtreePrimitive';

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

        this.maximumScreenSpaceError = 4;

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

        this.terrainProvider = new EllipsoidTerrainProvider();
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
