import { defaultValue } from './defaultValue';

class CesiumColor {
    red: number;
    green: number;
    blue: number;
    alpha: number;
    constructor (red = 0.0, green = 0.0, blue = 0.0, alpha = 0.0) {
        /**
         * The red component.
         * @type {Number}
         * @default 1.0
         */
        this.red = defaultValue(red, 1.0);
        /**
        * The green component.
        * @type {Number}
        * @default 1.0
        */
        this.green = defaultValue(green, 1.0);
        /**
        * The blue component.
        * @type {Number}
        * @default 1.0
        */
        this.blue = defaultValue(blue, 1.0);
        /**
        * The alpha component.
        * @type {Number}
        * @default 1.0
        */
        this.alpha = defaultValue(alpha, 1.0);
    }
}
export { CesiumColor };
