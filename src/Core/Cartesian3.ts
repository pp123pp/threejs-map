/* eslint-disable no-useless-constructor */
import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';

class Cartesian3 {
    x: number;
    y: number;
    z: number;
    constructor (x?: number, y?: number, z?: number) {
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
    }

    /**
     * An immutable Cartesian3 instance initialized to (0.0, 0.0, 0.0).
     *
     * @type {Cartesian3}
     * @constant
     */
    static ZERO = Object.freeze(new Cartesian3(0.0, 0.0, 0.0));

    /**
     * An immutable Cartesian3 instance initialized to (1.0, 0.0, 0.0).
     *
     * @type {Cartesian3}
     * @constant
     */
    static UNIT_X = Object.freeze(new Cartesian3(1.0, 0.0, 0.0));

    /**
     * An immutable Cartesian3 instance initialized to (0.0, 1.0, 0.0).
     *
     * @type {Cartesian3}
     * @constant
     */
    static UNIT_Y = Object.freeze(new Cartesian3(0.0, 1.0, 0.0));

    /**
     * An immutable Cartesian3 instance initialized to (0.0, 0.0, 1.0).
     *
     * @type {Cartesian3}
     * @constant
     */
    static UNIT_Z = Object.freeze(new Cartesian3(0.0, 0.0, 1.0));

    /**
     * Duplicates this Cartesian3 instance.
     *
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided.
     */
    clone (result: Cartesian3): Cartesian3 | undefined {
        return Cartesian3.clone(this, result);
    }

    /**
     * Duplicates a Cartesian3 instance.
     *
     * @param {Cartesian3} cartesian The Cartesian to duplicate.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided. (Returns undefined if cartesian is undefined)
     */
    static clone (cartesian: Cartesian3, result?: Cartesian3): Cartesian3 {
        if (!defined(result)) {
            return new Cartesian3(cartesian.x, cartesian.y, cartesian.z);
        }

        (result as Cartesian3).x = cartesian.x;
        (result as Cartesian3).y = cartesian.y;
        (result as Cartesian3).z = cartesian.z;
        return (result as Cartesian3);
    }

    /**
     * Computes the provided Cartesian's squared magnitude.
     *
     * @param {Cartesian3} cartesian The Cartesian instance whose squared magnitude is to be computed.
     * @returns {Number} The squared magnitude.
     */
    static magnitudeSquared (cartesian: Cartesian3) : number {
        return (
            cartesian.x * cartesian.x +
            cartesian.y * cartesian.y +
            cartesian.z * cartesian.z
        );
    }

    /**
   * Computes the Cartesian's magnitude (length).
   *
   * @param {Cartesian3} cartesian The Cartesian instance whose magnitude is to be computed.
   * @returns {Number} The magnitude.
   */
    static magnitude (cartesian: Cartesian3): number {
        return Math.sqrt(Cartesian3.magnitudeSquared(cartesian));
    }

    /**
     * Computes the normalized form of the supplied Cartesian.
     *
     * @param {Cartesian3} cartesian The Cartesian to be normalized.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static normalize (cartesian:Cartesian3, result:Cartesian3):Cartesian3 {
        const magnitude = Cartesian3.magnitude(cartesian);

        result.x = cartesian.x / magnitude;
        result.y = cartesian.y / magnitude;
        result.z = cartesian.z / magnitude;

        // >>includeStart('debug', pragmas.debug);
        if (isNaN(result.x) || isNaN(result.y) || isNaN(result.z)) {
            throw new DeveloperError('normalized result is not a number');
        }
        // >>includeEnd('debug');

        return result;
    }
}

export { Cartesian3 };
