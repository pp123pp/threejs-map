import { Ellipsoid } from '@/Core/Ellipsoid';
import { EllipsoidTerrainProvider } from '@/Core/EllipsoidTerrainProvider';
import { Event } from '@/Core/Event';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { QuadtreePrimitive } from './QuadtreePrimitive';

class Globe {
    _ellipsoid:Ellipsoid
    _surface: QuadtreePrimitive;
    maximumScreenSpaceError: number;
    _imageryLayerCollection: ImageryLayerCollection;
    _terrainProviderChanged: Event;
    tileCacheSize: number;
    _terrainProvider: EllipsoidTerrainProvider;
    terrainProvider: EllipsoidTerrainProvider;
    constructor (ellipsoid = Ellipsoid.WGS84) {
        const terrainProvider = new EllipsoidTerrainProvider({
            ellipsoid: ellipsoid
        });

        this._ellipsoid = ellipsoid;

        const imageryLayerCollection = new ImageryLayerCollection();

        this._imageryLayerCollection = imageryLayerCollection;

        this._surface = new QuadtreePrimitive({
            tileProvider: new GlobeSurfaceTileProvider({
                terrainProvider: terrainProvider,
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

        this.terrainProvider = new EllipsoidTerrainProvider();
    }
}

export { Globe };
