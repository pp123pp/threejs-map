import { defaultValue } from './defaultValue';

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
}
export { Cartographic };
