/* eslint-disable no-useless-constructor */
import { CesiumMath } from './CesiumMath';
import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';

class Cartesian3 {
    x: number;
    y: number;
    z: number;
    constructor (x = 0.0, y = 0.0, z = 0.0) {
        /**
         * The X component.
         * @type {Number}
         * @default 0.0
         */
        this.x = x;

        /**
         * The Y component.
         * @type {Number}
         * @default 0.0
         */
        this.y = y;

        /**
         * The Z component.
         * @type {Number}
         * @default 0.0
         */
        this.z = z;
    }

    static packedLength = 3;

    /**
     * Stores the provided instance into the provided array.
     *
     * @param {Cartesian3} value The value to pack.
     * @param {Number[]} array The array to pack into.
     * @param {Number} [startingIndex=0] The index into the array at which to start packing the elements.
     *
     * @returns {Number[]} The array that was packed into
     */
    static pack (value:Cartesian3, array:number[], startingIndex = 0.0): number[] {
        startingIndex = defaultValue(startingIndex, 0);

        array[startingIndex++] = value.x;
        array[startingIndex++] = value.y;
        array[startingIndex] = value.z;

        return array;
    }

    /**
     * Retrieves an instance from a packed array.
     *
     * @param {Number[]} array The packed array.
     * @param {Number} [startingIndex=0] The starting index of the element to be unpacked.
     * @param {Cartesian3} [result] The object into which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided.
     */
    static unpack (array: number[], startingIndex = 0, result?: Cartesian3):Cartesian3 {
        startingIndex = defaultValue(startingIndex, 0);

        if (!defined(result)) {
            result = new Cartesian3();
        }
        (result as Cartesian3).x = array[startingIndex++];
        (result as Cartesian3).y = array[startingIndex++];
        (result as Cartesian3).z = array[startingIndex];
        return (result as Cartesian3);
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

    /**
     * Computes the componentwise product of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static multiplyComponents (left:Cartesian3, right:Cartesian3, result:Cartesian3):Cartesian3 {
        result.x = left.x * right.x;
        result.y = left.y * right.y;
        result.z = left.z * right.z;
        return result;
    }

    /**
     * Compares the provided Cartesians componentwise and returns
     * <code>true</code> if they pass an absolute or relative tolerance test,
     * <code>false</code> otherwise.
     *
     * @param {Cartesian3} [left] The first Cartesian.
     * @param {Cartesian3} [right] The second Cartesian.
     * @param {Number} [relativeEpsilon=0] The relative epsilon tolerance to use for equality testing.
     * @param {Number} [absoluteEpsilon=relativeEpsilon] The absolute epsilon tolerance to use for equality testing.
     * @returns {Boolean} <code>true</code> if left and right are within the provided epsilon, <code>false</code> otherwise.
     */
    static equalsEpsilon (left?:Cartesian3, right?:Cartesian3, relativeEpsilon?:number, absoluteEpsilon?: number):boolean {
        return (
            left === right ||
            (defined(left) &&
            defined(right) &&
        CesiumMath.equalsEpsilon((left as Cartesian3).x, (right as Cartesian3).x, relativeEpsilon, absoluteEpsilon) &&
        CesiumMath.equalsEpsilon((left as Cartesian3).y, (right as Cartesian3).y, relativeEpsilon, absoluteEpsilon) &&
        CesiumMath.equalsEpsilon((left as Cartesian3).z, (right as Cartesian3).z, relativeEpsilon, absoluteEpsilon))
        );
    }

    /**
     * Computes the dot (scalar) product of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @returns {Number} The dot product.
     */
    static dot (left:Cartesian3, right:Cartesian3):number {
        return left.x * right.x + left.y * right.y + left.z * right.z;
    }

    /**
     * Divides the provided Cartesian componentwise by the provided scalar.
     *
     * @param {Cartesian3} cartesian The Cartesian to be divided.
     * @param {Number} scalar The scalar to divide by.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static divideByScalar (cartesian:Cartesian3, scalar: number, result:Cartesian3):Cartesian3 {
        result.x = cartesian.x / scalar;
        result.y = cartesian.y / scalar;
        result.z = cartesian.z / scalar;
        return result;
    }

    /**
     * Multiplies the provided Cartesian componentwise by the provided scalar.
     *
     * @param {Cartesian3} cartesian The Cartesian to be scaled.
     * @param {Number} scalar The scalar to multiply with.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static multiplyByScalar (cartesian:Cartesian3, scalar: number, result: Cartesian3):Cartesian3 {
        result.x = cartesian.x * scalar;
        result.y = cartesian.y * scalar;
        result.z = cartesian.z * scalar;
        return result;
    }

    /**
     * Computes the componentwise sum of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static add (left: Cartesian3, right: Cartesian3, result: Cartesian3): Cartesian3 {
        result.x = left.x + right.x;
        result.y = left.y + right.y;
        result.z = left.z + right.z;
        return result;
    }

    /**
     * Computes the componentwise difference of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static subtract (left:Cartesian3, right:Cartesian3, result:Cartesian3):Cartesian3 {
        result.x = left.x - right.x;
        result.y = left.y - right.y;
        result.z = left.z - right.z;
        return result;
    }
}

export { Cartesian3 };
