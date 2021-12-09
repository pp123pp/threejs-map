import { defaultValue } from './defaultValue';

/**
 * A 4D Cartesian point.
 * @alias Cartesian4
 * @constructor
 *
 * @param {Number} [x=0.0] The X component.
 * @param {Number} [y=0.0] The Y component.
 * @param {Number} [z=0.0] The Z component.
 * @param {Number} [w=0.0] The W component.
 *
 * @see Cartesian2
 * @see Cartesian3
 * @see Packable
 */
class Cartesian4 {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor (x?: number, y?: number, z?: number, w?:number) {
        /**
         * The X component.
         * @type {Number}
         * @default 0.0
         */
        this.x = defaultValue(x, 0.0);

        /**
        * The Y component.
        * @type {Number}
        * @default 0.0
        */
        this.y = defaultValue(y, 0.0);

        /**
        * The Z component.
        * @type {Number}
        * @default 0.0
        */
        this.z = defaultValue(z, 0.0);

        /**
        * The W component.
        * @type {Number}
        * @default 0.0
        */
        this.w = defaultValue(w, 0.0);
    }
}

export { Cartesian4 };
