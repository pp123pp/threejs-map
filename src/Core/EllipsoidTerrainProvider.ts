import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { Ellipsoid } from './Ellipsoid';
import { Event } from './Event';
import { GeographicTilingScheme } from './GeographicTilingScheme';

import when from 'when';
import { TerrainProvider } from './TerrainProvider';

interface EllipsoidTerrainProviderInterFace {
    tilingScheme?: GeographicTilingScheme | undefined;
    ellipsoid: Ellipsoid;
}

/**
 * A very simple {@link TerrainProvider} that produces geometry by tessellating an ellipsoidal
 * surface.
 *
 * @alias EllipsoidTerrainProvider
 * @constructor
 *
 * @param {Object} [options] Object with the following properties:
 * @param {TilingScheme} [options.tilingScheme] The tiling scheme specifying how the ellipsoidal
 * surface is broken into tiles.  If this parameter is not provided, a {@link GeographicTilingScheme}
 * is used.
 * @param {Ellipsoid} [options.ellipsoid] The ellipsoid.  If the tilingScheme is specified,
 * this parameter is ignored and the tiling scheme's ellipsoid is used instead. If neither
 * parameter is specified, the WGS84 ellipsoid is used.
 *
 * @see TerrainProvider
 */
class EllipsoidTerrainProvider {
    _tilingScheme: GeographicTilingScheme;
    _levelZeroMaximumGeometricError: number;
    _errorEvent: Event;
    _readyPromise:When.Promise<boolean>
    constructor (options?: any) {
        (options as any) = defaultValue(options, defaultValue.EMPTY_OBJECT) as any;

        this._tilingScheme = (options.tilingScheme as GeographicTilingScheme | any);
        if (!defined(this._tilingScheme)) {
            this._tilingScheme = new GeographicTilingScheme({
                ellipsoid: defaultValue(options.ellipsoid, Ellipsoid.WGS84)
            });
        }

        // Note: the 64 below does NOT need to match the actual vertex dimensions, because
        // the ellipsoid is significantly smoother than actual terrain.
        this._levelZeroMaximumGeometricError = TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
            this._tilingScheme.ellipsoid,
            64,
            this._tilingScheme.getNumberOfXTilesAtLevel(0)
        );

        this._errorEvent = new Event();
        this._readyPromise = when.resolve(true);
    }

    get tilingScheme (): GeographicTilingScheme {
        return this._tilingScheme;
    }

    get ready (): boolean {
        return true;
    }

    /**
     * Gets the maximum geometric error allowed in a tile at a given level.
     *
     * @param {Number} level The tile level for which to get the maximum geometric error.
     * @returns {Number} The maximum geometric error.
     */
    getLevelMaximumGeometricError (level: number): number {
        return this._levelZeroMaximumGeometricError / (1 << level);
    }
}

export { EllipsoidTerrainProvider };
