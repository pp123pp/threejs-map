import { defaultValue } from './defaultValue';
import { defined } from './defined';

class Cartographic {
    longitude: number;
    latitude: number;
    height: number;
    constructor (longitude = 0.0, latitude = 0.0, height = 0.0) {
        /**
         * The longitude, in radians.
         * @type {Number}
         * @default 0.0
         */
        this.longitude = defaultValue(longitude, 0.0);

        /**
        * The latitude, in radians.
        * @type {Number}
        * @default 0.0
        */
        this.latitude = defaultValue(latitude, 0.0);

        /**
        * The height, in meters, above the ellipsoid.
        * @type {Number}
        * @default 0.0
        */
        this.height = defaultValue(height, 0.0);
    }

    /**
     * Duplicates a Cartographic instance.
     *
     * @param {Cartographic} cartographic The cartographic to duplicate.
     * @param {Cartographic} [result] The object onto which to store the result.
     * @returns {Cartographic} The modified result parameter or a new Cartographic instance if one was not provided. (Returns undefined if cartographic is undefined)
     */
    static clone (cartographic:Cartographic, result?:Cartographic):Cartographic | undefined {
        if (!defined(cartographic)) {
            return undefined;
        }
        if (!defined(result)) {
            return new Cartographic(
                cartographic.longitude,
                cartographic.latitude,
                cartographic.height
            );
        }
        (result as Cartographic).longitude = cartographic.longitude;
        (result as Cartographic).latitude = cartographic.latitude;
        (result as Cartographic).height = cartographic.height;
        return result;
    }
}
export { Cartographic };
