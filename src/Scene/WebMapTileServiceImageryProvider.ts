import { defaultValue } from '@/Core/defaultValue';
import { defined } from '@/Core/defined';
import { DeveloperError } from '@/Core/DeveloperError';
import { GeographicTilingScheme } from '@/Core/GeographicTilingScheme';
import { Resource } from '@/Core/Resource.js';

const defaultParameters = {
    service: 'WMTS',
    version: '1.0.0',
    request: 'GetTile'
};
class WebMapTileServiceImageryProvider {
    _tilingScheme: GeographicTilingScheme;
    defaultAlpha?: number;
    defaultNightAlpha?: number;
    defaultDayAlpha?: number;
    defaultBrightness?: number;
    defaultContrast?: number;
    _useKvp: boolean;
    _resource: Resource;
    _layer: string;
    _style: string;
    _tileMatrixSetID: string;
    _tileWidth: number;
    constructor (options: {
        url: string;
        layer: string;
        style: string;
        tileMatrixSetID: string;
    }) {
        // options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        // >>includeStart('debug', pragmas.debug);
        if (!defined(options.url)) {
            throw new DeveloperError('options.url is required.');
        }
        if (!defined(options.layer)) {
            throw new DeveloperError('options.layer is required.');
        }
        if (!defined(options.style)) {
            throw new DeveloperError('options.style is required.');
        }
        if (!defined(options.tileMatrixSetID)) {
            throw new DeveloperError('options.tileMatrixSetID is required.');
        }
        // if (defined(options.times) && !defined(options.clock)) {
        //     throw new DeveloperError(
        //         'options.times was specified, so options.clock is required.'
        //     );
        // }
        // >>includeEnd('debug');

        /**
         * The default alpha blending value of this provider, with 0.0 representing fully transparent and
         * 1.0 representing fully opaque.
         *
         * @type {Number|undefined}
         * @default undefined
         */
        this.defaultAlpha = undefined;

        /**
         * The default alpha blending value on the night side of the globe of this provider, with 0.0 representing fully transparent and
         * 1.0 representing fully opaque.
         *
         * @type {Number|undefined}
         * @default undefined
         */
        this.defaultNightAlpha = undefined;

        /**
         * The default alpha blending value on the day side of the globe of this provider, with 0.0 representing fully transparent and
         * 1.0 representing fully opaque.
         *
         * @type {Number|undefined}
         * @default undefined
         */
        this.defaultDayAlpha = undefined;

        /**
         * The default brightness of this provider.  1.0 uses the unmodified imagery color.  Less than 1.0
         * makes the imagery darker while greater than 1.0 makes it brighter.
         *
         * @type {Number|undefined}
         * @default undefined
         */
        this.defaultBrightness = undefined;

        /**
         * The default contrast of this provider.  1.0 uses the unmodified imagery color.  Less than 1.0 reduces
         * the contrast while greater than 1.0 increases it.
         *
         * @type {Number|undefined}
         * @default undefined
         */
        this.defaultContrast = undefined;

        // /**
        //  * The default hue of this provider in radians. 0.0 uses the unmodified imagery color.
        //  *
        //  * @type {Number|undefined}
        //  * @default undefined
        //  */
        // this.defaultHue = undefined;

        // /**
        //  * The default saturation of this provider. 1.0 uses the unmodified imagery color. Less than 1.0 reduces the
        //  * saturation while greater than 1.0 increases it.
        //  *
        //  * @type {Number|undefined}
        //  * @default undefined
        //  */
        // this.defaultSaturation = undefined;

        // /**
        //  * The default gamma correction to apply to this provider.  1.0 uses the unmodified imagery color.
        //  *
        //  * @type {Number|undefined}
        //  * @default undefined
        //  */
        // this.defaultGamma = undefined;

        // /**
        //  * The default texture minification filter to apply to this provider.
        //  *
        //  * @type {TextureMinificationFilter}
        //  * @default undefined
        //  */
        // this.defaultMinificationFilter = undefined;

        // /**
        //  * The default texture magnification filter to apply to this provider.
        //  *
        //  * @type {TextureMagnificationFilter}
        //  * @default undefined
        //  */
        // this.defaultMagnificationFilter = undefined;

        const resource = Resource.createIfNeeded(options.url);

        const style = options.style;
        const tileMatrixSetID = options.tileMatrixSetID;
        const url = resource.url;

        const bracketMatch = url.match(/{/g);
        if (
            !defined(bracketMatch) ||
          (bracketMatch.length === 1 && /{s}/.test(url))
        ) {
            resource.setQueryParameters(defaultParameters);
            this._useKvp = true;
        } else {
            const templateValues = {
                style: style,
                Style: style,
                TileMatrixSet: tileMatrixSetID
            };

            resource.setTemplateValues(templateValues);
            this._useKvp = false;
        }

        this._resource = resource;
        this._layer = options.layer;
        this._style = style;
        this._tileMatrixSetID = tileMatrixSetID;
        this._tileMatrixLabels = options.tileMatrixLabels;
        this._format = defaultValue(options.format, 'image/jpeg');
        this._tileDiscardPolicy = options.tileDiscardPolicy;

        this._tilingScheme = defined(options.tilingScheme)
            ? options.tilingScheme
            : new WebMercatorTilingScheme({ ellipsoid: options.ellipsoid });
        this._tileWidth = defaultValue(options.tileWidth, 256);
        this._tileHeight = defaultValue(options.tileHeight, 256);

        this._minimumLevel = defaultValue(options.minimumLevel, 0);
        this._maximumLevel = options.maximumLevel;

        this._rectangle = defaultValue(
            options.rectangle,
            this._tilingScheme.rectangle
        );
        this._dimensions = options.dimensions;

        const that = this;
        this._reload = undefined;
        if (defined(options.times)) {
            this._timeDynamicImagery = new TimeDynamicImagery({
                clock: options.clock,
                times: options.times,
                requestImageFunction: function (x, y, level, request, interval) {
                    return requestImage(that, x, y, level, request, interval);
                },
                reloadFunction: function () {
                    if (defined(that._reload)) {
                        that._reload();
                    }
                }
            });
        }

        this._readyPromise = when.resolve(true);

        // Check the number of tiles at the minimum level.  If it's more than four,
        // throw an exception, because starting at the higher minimum
        // level will cause too many tiles to be downloaded and rendered.
        const swTile = this._tilingScheme.positionToTileXY(
            Rectangle.southwest(this._rectangle),
            this._minimumLevel
        );
        const neTile = this._tilingScheme.positionToTileXY(
            Rectangle.northeast(this._rectangle),
            this._minimumLevel
        );
        const tileCount =
          (Math.abs(neTile.x - swTile.x) + 1) * (Math.abs(neTile.y - swTile.y) + 1);
        // >>includeStart('debug', pragmas.debug);
        if (tileCount > 4) {
            throw new DeveloperError(
                "The imagery provider's rectangle and minimumLevel indicate that there are " +
              tileCount +
              ' tiles at the minimum level. Imagery providers with more than four tiles at the minimum level are not supported.'
            );
        }
        // >>includeEnd('debug');

        this._errorEvent = new Event();

        const credit = options.credit;
        this._credit = typeof credit === 'string' ? new Credit(credit) : credit;

        this._subdomains = options.subdomains;
        if (Array.isArray(this._subdomains)) {
            this._subdomains = this._subdomains.slice();
        } else if (defined(this._subdomains) && this._subdomains.length > 0) {
            this._subdomains = this._subdomains.split('');
        } else {
            this._subdomains = ['a', 'b', 'c'];
        }
    }
}

export { WebMapTileServiceImageryProvider };
