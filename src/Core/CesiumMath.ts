import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';

/**
 * 0.1
 * @type {Number}
 * @constant
 */
export const EPSILON1 = 0.1;

/**
  * 0.01
  * @type {Number}
  * @constant
  */
export const EPSILON2 = 0.01;

/**
  * 0.001
  * @type {Number}
  * @constant
  */
export const EPSILON3 = 0.001;

/**
  * 0.0001
  * @type {Number}
  * @constant
  */
export const EPSILON4 = 0.0001;

/**
  * 0.00001
  * @type {Number}
  * @constant
  */
export const EPSILON5 = 0.00001;

/**
  * 0.000001
  * @type {Number}
  * @constant
  */
export const EPSILON6 = 0.000001;

/**
  * 0.0000001
  * @type {Number}
  * @constant
  */
export const EPSILON7 = 0.0000001;

/**
  * 0.00000001
  * @type {Number}
  * @constant
  */
export const EPSILON8 = 0.00000001;

/**
  * 0.000000001
  * @type {Number}
  * @constant
  */
export const EPSILON9 = 0.000000001;

/**
  * 0.0000000001
  * @type {Number}
  * @constant
  */
export const EPSILON10 = 0.0000000001;

/**
  * 0.00000000001
  * @type {Number}
  * @constant
  */
export const EPSILON11 = 0.00000000001;

/**
  * 0.000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON12 = 0.000000000001;

/**
  * 0.0000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON13 = 0.0000000000001;

/**
  * 0.00000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON14 = 0.00000000000001;

/**
  * 0.000000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON15 = 0.000000000000001;

/**
  * 0.0000000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON16 = 0.0000000000000001;

/**
  * 0.00000000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON17 = 0.00000000000000001;

/**
  * 0.000000000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON18 = 0.000000000000000001;

/**
  * 0.0000000000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON19 = 0.0000000000000000001;

/**
  * 0.00000000000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON20 = 0.00000000000000000001;

/**
  * 0.000000000000000000001
  * @type {Number}
  * @constant
  */
export const EPSILON21 = 0.000000000000000000001;

/**
  * The gravitational parameter of the Earth in meters cubed
  * per second squared as defined by the WGS84 model: 3.986004418e14
  * @type {Number}
  * @constant
  */
export const GRAVITATIONALPARAMETER = 3.986004418e14;

/**
  * Radius of the sun in meters: 6.955e8
  * @type {Number}
  * @constant
  */
export const SOLAR_RADIUS = 6.955e8;

/**
  * The mean radius of the moon, according to the "Report of the IAU/IAG Working Group on
  * Cartographic Coordinates and Rotational Elements of the Planets and satellites: 2000",
  * Celestial Mechanics 82: 83-110, 2002.
  * @type {Number}
  * @constant
  */
export const LUNAR_RADIUS = 1737400.0;

/**
  * 64 * 1024
  * @type {Number}
  * @constant
  */
export const SIXTY_FOUR_KILOBYTES = 64 * 1024;

/**
  * 4 * 1024 * 1024 * 1024
  * @type {Number}
  * @constant
  */
export const FOUR_GIGABYTES = 4 * 1024 * 1024 * 1024;

/**
 * Increments a number with a wrapping to a minimum value if the number exceeds the maximum value.
 *
 * @param {Number} [n] The number to be incremented.
 * @param {Number} [maximumValue] The maximum incremented value before rolling over to the minimum value.
 * @param {Number} [minimumValue=0.0] The number reset to after the maximum value has been exceeded.
 * @returns {Number} The incremented number.
 *
 * @exception {DeveloperError} Maximum value must be greater than minimum value.
 *
 * @example
 * var n = Cesium.Math.incrementWrap(5, 10, 0); // returns 6
 * var n = Cesium.Math.incrementWrap(10, 10, 0); // returns 0
 */
export const incrementWrap = function (n: number, maximumValue: number, minimumValue: number): number {
    minimumValue = defaultValue(minimumValue, 0.0);

    // >>includeStart('debug', pragmas.debug);
    if (!defined(n)) {
        throw new DeveloperError('n is required.');
    }
    if (maximumValue <= minimumValue) {
        throw new DeveloperError('maximumValue must be greater than minimumValue.');
    }
    // >>includeEnd('debug');

    ++n;
    if (n > maximumValue) {
        n = minimumValue;
    }
    return n;
};

/**
 * Determines if two values are equal using an absolute or relative tolerance test. This is useful
 * to avoid problems due to roundoff error when comparing floating-point values directly. The values are
 * first compared using an absolute tolerance test. If that fails, a relative tolerance test is performed.
 * Use this test if you are unsure of the magnitudes of left and right.
 *
 * @param {Number} left The first value to compare.
 * @param {Number} right The other value to compare.
 * @param {Number} [relativeEpsilon=0] The maximum inclusive delta between <code>left</code> and <code>right</code> for the relative tolerance test.
 * @param {Number} [absoluteEpsilon=relativeEpsilon] The maximum inclusive delta between <code>left</code> and <code>right</code> for the absolute tolerance test.
 * @returns {Boolean} <code>true</code> if the values are equal within the epsilon; otherwise, <code>false</code>.
 *
 * @example
 * var a = Cesium.Math.equalsEpsilon(0.0, 0.01, Cesium.Math.EPSILON2); // true
 * var b = Cesium.Math.equalsEpsilon(0.0, 0.1, Cesium.Math.EPSILON2);  // false
 * var c = Cesium.Math.equalsEpsilon(3699175.1634344, 3699175.2, Cesium.Math.EPSILON7); // true
 * var d = Cesium.Math.equalsEpsilon(3699175.1634344, 3699175.2, Cesium.Math.EPSILON9); // false
 */
export const equalsEpsilon = function (
    left: number,
    right: number,
    relativeEpsilon?: number,
    absoluteEpsilon?: number
): boolean {
    // >>includeStart('debug', pragmas.debug);
    if (!defined(left)) {
        throw new DeveloperError('left is required.');
    }
    if (!defined(right)) {
        throw new DeveloperError('right is required.');
    }
    // >>includeEnd('debug');

    relativeEpsilon = defaultValue(relativeEpsilon, 0.0);
    absoluteEpsilon = defaultValue(absoluteEpsilon, relativeEpsilon);
    const absDiff = Math.abs(left - right);
    return (
        absDiff <= (absoluteEpsilon as number) ||
      absDiff <= (absoluteEpsilon as number) * Math.max(Math.abs(left), Math.abs(right))
    );
};

const CesiumMath = {
    EPSILON1,
    EPSILON2,
    EPSILON3,
    EPSILON4,
    EPSILON5,
    EPSILON6,
    EPSILON7,
    EPSILON8,
    EPSILON9,
    EPSILON10,
    EPSILON11,
    EPSILON12,
    EPSILON13,
    EPSILON14,

    incrementWrap,
    equalsEpsilon
};

export { CesiumMath };
