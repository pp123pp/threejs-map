import { defaultValue } from './defaultValue';

class CesiumColor {
    red: number;
    green: number;
    blue: number;
    alpha: number;
    constructor (red?: number, green?: number, blue?: number, alpha?: number) {
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
