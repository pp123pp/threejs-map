import { defaultValue } from './defaultValue';
import { defined } from './defined';

class Cartesian2 {
    x: number;
    y: number;
    constructor (x?:number, y?:number) {
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
    }

    /**
     * An immutable Cartesian2 instance initialized to (0.0, 0.0).
     *
     * @type {Cartesian2}
     * @constant
     */
    static ZERO = Object.freeze(new Cartesian2(0.0, 0.0));

    /**
     * An immutable Cartesian2 instance initialized to (1.0, 0.0).
     *
     * @type {Cartesian2}
     * @constant
     */
     static UNIT_X = Object.freeze(new Cartesian2(1.0, 0.0));

     /**
     * An immutable Cartesian2 instance initialized to (0.0, 1.0).
     *
     * @type {Cartesian2}
     * @constant
     */
     static UNIT_Y = Object.freeze(new Cartesian2(0.0, 1.0));

     /**
     * Duplicates a Cartesian2 instance.
     *
     * @param {Cartesian2} cartesian The Cartesian to duplicate.
     * @param {Cartesian2} [result] The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter or a new Cartesian2 instance if one was not provided. (Returns undefined if cartesian is undefined)
    */
     static clone (cartesian?:Cartesian2, result?:Cartesian2):Cartesian2 | undefined {
         if (!defined(cartesian)) {
             return undefined;
         }
         if (!defined(result)) {
             return new Cartesian2((cartesian as Cartesian2).x, (cartesian as Cartesian2).y);
         }

         (result as Cartesian2).x = (cartesian as Cartesian2).x;
         (result as Cartesian2).y = (cartesian as Cartesian2).y;
         return result;
     }

     /**
     * Multiplies the provided Cartesian componentwise by the provided scalar.
     *
     * @param {Cartesian2} cartesian The Cartesian to be scaled.
     * @param {Number} scalar The scalar to multiply with.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
     static multiplyByScalar (cartesian: Cartesian2, scalar: number, result: Cartesian2): Cartesian2 {
         result.x = cartesian.x * scalar;
         result.y = cartesian.y * scalar;
         return result;
     }

     /**
     * Computes the componentwise sum of two Cartesians.
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
     static add (left: Cartesian2, right: Cartesian2, result: Cartesian2) : Cartesian2 {
         result.x = left.x + right.x;
         result.y = left.y + right.y;
         return result;
     }

    static lerp: (start: Cartesian2, end: Cartesian2, t: number, result: Cartesian2)=>Cartesian2
}

const lerpScratch = new Cartesian2();
/**
 * Computes the linear interpolation or extrapolation at t using the provided cartesians.
 *
 * @param {Cartesian2} start The value corresponding to t at 0.0.
 * @param {Cartesian2} end The value corresponding to t at 1.0.
 * @param {Number} t The point along t at which to interpolate.
 * @param {Cartesian2} result The object onto which to store the result.
 * @returns {Cartesian2} The modified result parameter.
 */
Cartesian2.lerp = function (start: Cartesian2, end: Cartesian2, t: number, result: Cartesian2): Cartesian2 {
    Cartesian2.multiplyByScalar(end, t, lerpScratch);
    result = Cartesian2.multiplyByScalar(start, 1.0 - t, result);
    return Cartesian2.add(lerpScratch, result, result);
};

export { Cartesian2 };
