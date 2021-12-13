import { Cartesian3 } from './Cartesian3';
import { Cartesian4 } from './Cartesian4';
import { CesiumMatrix3 } from './CesiumMatrix3';
import { Check } from './Check';
import { defaultValue } from './defaultValue';
import { defined } from './defined';

class CesiumMatrix4 {
    constructor (
        column0Row0 = 0.0,
        column1Row0 = 0.0,
        column2Row0 = 0.0,
        column3Row0 = 0.0,
        column0Row1 = 0.0,
        column1Row1 = 0.0,
        column2Row1 = 0.0,
        column3Row1 = 0.0,
        column0Row2 = 0.0,
        column1Row2 = 0.0,
        column2Row2 = 0.0,
        column3Row2 = 0.0,
        column0Row3 = 0.0,
        column1Row3 = 0.0,
        column2Row3 = 0.0,
        column3Row3 = 0.0
    ) {
        this[0] = defaultValue(column0Row0, 0.0);
        this[1] = defaultValue(column0Row1, 0.0);
        this[2] = defaultValue(column0Row2, 0.0);
        this[3] = defaultValue(column0Row3, 0.0);
        this[4] = defaultValue(column1Row0, 0.0);
        this[5] = defaultValue(column1Row1, 0.0);
        this[6] = defaultValue(column1Row2, 0.0);
        this[7] = defaultValue(column1Row3, 0.0);
        this[8] = defaultValue(column2Row0, 0.0);
        this[9] = defaultValue(column2Row1, 0.0);
        this[10] = defaultValue(column2Row2, 0.0);
        this[11] = defaultValue(column2Row3, 0.0);
        this[12] = defaultValue(column3Row0, 0.0);
        this[13] = defaultValue(column3Row1, 0.0);
        this[14] = defaultValue(column3Row2, 0.0);
        this[15] = defaultValue(column3Row3, 0.0);
    }

    /**
     * Computes the inverse of the provided matrix assuming it is a proper rigid matrix,
     * where the upper left 3x3 elements are a rotation matrix,
     * and the upper three elements in the fourth column are the translation.
     * The bottom row is assumed to be [0, 0, 0, 1].
     * The matrix is not verified to be in the proper form.
     * This method is faster than computing the inverse for a general 4x4
     * matrix using {@link Matrix4.inverse}.
     *
     * @param {Matrix4} matrix The matrix to invert.
     * @param {Matrix4} result The object onto which to store the result.
     * @returns {Matrix4} The modified result parameter.
     */
    static inverseTransformation (matrix:CesiumMatrix4, result:CesiumMatrix4):CesiumMatrix4 {
        // This function is an optimized version of the below 4 lines.
        // var rT = Matrix3.transpose(Matrix4.getMatrix3(matrix));
        // var rTN = Matrix3.negate(rT);
        // var rTT = Matrix3.multiplyByVector(rTN, Matrix4.getTranslation(matrix));
        // return Matrix4.fromRotationTranslation(rT, rTT, result);

        const matrix0 = matrix[0];
        const matrix1 = matrix[1];
        const matrix2 = matrix[2];
        const matrix4 = matrix[4];
        const matrix5 = matrix[5];
        const matrix6 = matrix[6];
        const matrix8 = matrix[8];
        const matrix9 = matrix[9];
        const matrix10 = matrix[10];

        const vX = matrix[12];
        const vY = matrix[13];
        const vZ = matrix[14];

        const x = -matrix0 * vX - matrix1 * vY - matrix2 * vZ;
        const y = -matrix4 * vX - matrix5 * vY - matrix6 * vZ;
        const z = -matrix8 * vX - matrix9 * vY - matrix10 * vZ;

        result[0] = matrix0;
        result[1] = matrix4;
        result[2] = matrix8;
        result[3] = 0.0;
        result[4] = matrix1;
        result[5] = matrix5;
        result[6] = matrix9;
        result[7] = 0.0;
        result[8] = matrix2;
        result[9] = matrix6;
        result[10] = matrix10;
        result[11] = 0.0;
        result[12] = x;
        result[13] = y;
        result[14] = z;
        result[15] = 1.0;
        return result;
    }

    /**
 * Computes the product of two matrices.
 *
 * @param {Matrix4} left The first matrix.
 * @param {Matrix4} right The second matrix.
 * @param {Matrix4} result The object onto which to store the result.
 * @returns {Matrix4} The modified result parameter.
 */
    static multiply (left:CesiumMatrix4, right:CesiumMatrix4, result:CesiumMatrix4) :CesiumMatrix4 {
        const left0 = left[0];
        const left1 = left[1];
        const left2 = left[2];
        const left3 = left[3];
        const left4 = left[4];
        const left5 = left[5];
        const left6 = left[6];
        const left7 = left[7];
        const left8 = left[8];
        const left9 = left[9];
        const left10 = left[10];
        const left11 = left[11];
        const left12 = left[12];
        const left13 = left[13];
        const left14 = left[14];
        const left15 = left[15];

        const right0 = right[0];
        const right1 = right[1];
        const right2 = right[2];
        const right3 = right[3];
        const right4 = right[4];
        const right5 = right[5];
        const right6 = right[6];
        const right7 = right[7];
        const right8 = right[8];
        const right9 = right[9];
        const right10 = right[10];
        const right11 = right[11];
        const right12 = right[12];
        const right13 = right[13];
        const right14 = right[14];
        const right15 = right[15];

        const column0Row0 =
      left0 * right0 + left4 * right1 + left8 * right2 + left12 * right3;
        const column0Row1 =
      left1 * right0 + left5 * right1 + left9 * right2 + left13 * right3;
        const column0Row2 =
      left2 * right0 + left6 * right1 + left10 * right2 + left14 * right3;
        const column0Row3 =
      left3 * right0 + left7 * right1 + left11 * right2 + left15 * right3;

        const column1Row0 =
      left0 * right4 + left4 * right5 + left8 * right6 + left12 * right7;
        const column1Row1 =
      left1 * right4 + left5 * right5 + left9 * right6 + left13 * right7;
        const column1Row2 =
      left2 * right4 + left6 * right5 + left10 * right6 + left14 * right7;
        const column1Row3 =
      left3 * right4 + left7 * right5 + left11 * right6 + left15 * right7;

        const column2Row0 =
      left0 * right8 + left4 * right9 + left8 * right10 + left12 * right11;
        const column2Row1 =
      left1 * right8 + left5 * right9 + left9 * right10 + left13 * right11;
        const column2Row2 =
      left2 * right8 + left6 * right9 + left10 * right10 + left14 * right11;
        const column2Row3 =
      left3 * right8 + left7 * right9 + left11 * right10 + left15 * right11;

        const column3Row0 =
      left0 * right12 + left4 * right13 + left8 * right14 + left12 * right15;
        const column3Row1 =
      left1 * right12 + left5 * right13 + left9 * right14 + left13 * right15;
        const column3Row2 =
      left2 * right12 + left6 * right13 + left10 * right14 + left14 * right15;
        const column3Row3 =
      left3 * right12 + left7 * right13 + left11 * right14 + left15 * right15;

        result[0] = column0Row0;
        result[1] = column0Row1;
        result[2] = column0Row2;
        result[3] = column0Row3;
        result[4] = column1Row0;
        result[5] = column1Row1;
        result[6] = column1Row2;
        result[7] = column1Row3;
        result[8] = column2Row0;
        result[9] = column2Row1;
        result[10] = column2Row2;
        result[11] = column2Row3;
        result[12] = column3Row0;
        result[13] = column3Row1;
        result[14] = column3Row2;
        result[15] = column3Row3;
        return result;
    }

    /**
 * Computes a Matrix4 instance from a Matrix3 representing the rotation
 * and a Cartesian3 representing the translation.
 *
 * @param {Matrix3} rotation The upper left portion of the matrix representing the rotation.
 * @param {Cartesian3} [translation=Cartesian3.ZERO] The upper right portion of the matrix representing the translation.
 * @param {Matrix4} [result] The object in which the result will be stored, if undefined a new instance will be created.
 * @returns {Matrix4} The modified result parameter, or a new Matrix4 instance if one was not provided.
 */
    static fromRotationTranslation (rotation:CesiumMatrix3, translation:Cartesian3, result?:CesiumMatrix4):CesiumMatrix4 {
        translation = defaultValue(translation, Cartesian3.ZERO);

        if (!defined(result)) {
            return new CesiumMatrix4(
                rotation[0],
                rotation[3],
                rotation[6],
                translation.x,
                rotation[1],
                rotation[4],
                rotation[7],
                translation.y,
                rotation[2],
                rotation[5],
                rotation[8],
                translation.z,
                0.0,
                0.0,
                0.0,
                1.0
            );
        }

        (result as CesiumMatrix4)[0] = rotation[0];
        (result as CesiumMatrix4)[1] = rotation[1];
        (result as CesiumMatrix4)[2] = rotation[2];
        (result as CesiumMatrix4)[3] = 0.0;
        (result as CesiumMatrix4)[4] = rotation[3];
        (result as CesiumMatrix4)[5] = rotation[4];
        (result as CesiumMatrix4)[6] = rotation[5];
        (result as CesiumMatrix4)[7] = 0.0;
        (result as CesiumMatrix4)[8] = rotation[6];
        (result as CesiumMatrix4)[9] = rotation[7];
        (result as CesiumMatrix4)[10] = rotation[8];
        (result as CesiumMatrix4)[11] = 0.0;
        (result as CesiumMatrix4)[12] = translation.x;
        (result as CesiumMatrix4)[13] = translation.y;
        (result as CesiumMatrix4)[14] = translation.z;
        (result as CesiumMatrix4)[15] = 1.0;
        return (result as CesiumMatrix4);
    }

    /**
     * Creates a Matrix4 instance from a Cartesian3 representing the translation.
     *
     * @param {Cartesian3} translation The upper right portion of the matrix representing the translation.
     * @param {Matrix4} [result] The object in which the result will be stored, if undefined a new instance will be created.
     * @returns {Matrix4} The modified result parameter, or a new Matrix4 instance if one was not provided.
     *
     * @see Matrix4.multiplyByTranslation
     */
    static fromTranslation (translation: Cartesian3, result?:CesiumMatrix4): CesiumMatrix4 {
        return CesiumMatrix4.fromRotationTranslation(CesiumMatrix3.IDENTITY, translation, result);
    }

    /**
     * Computes a new matrix that replaces the translation in the rightmost column of the provided
     * matrix with the provided translation. This assumes the matrix is an affine transformation.
     *
     * @param {Matrix4} matrix The matrix to use.
     * @param {Cartesian3} translation The translation that replaces the translation of the provided matrix.
     * @param {Matrix4} result The object onto which to store the result.
     * @returns {Matrix4} The modified result parameter.
     */
    static setTranslation (matrix:CesiumMatrix4, translation:Cartesian3, result:CesiumMatrix4):CesiumMatrix4 {
        result[0] = matrix[0];
        result[1] = matrix[1];
        result[2] = matrix[2];
        result[3] = matrix[3];

        result[4] = matrix[4];
        result[5] = matrix[5];
        result[6] = matrix[6];
        result[7] = matrix[7];

        result[8] = matrix[8];
        result[9] = matrix[9];
        result[10] = matrix[10];
        result[11] = matrix[11];

        result[12] = translation.x;
        result[13] = translation.y;
        result[14] = translation.z;
        result[15] = matrix[15];

        return result;
    }

    /**
     * Computes a Matrix4 instance representing a non-uniform scale.
     *
     * @param {Cartesian3} scale The x, y, and z scale factors.
     * @param {Matrix4} [result] The object in which the result will be stored, if undefined a new instance will be created.
     * @returns {Matrix4} The modified result parameter, or a new Matrix4 instance if one was not provided.
     *
     * @example
     * // Creates
     * //   [7.0, 0.0, 0.0, 0.0]
     * //   [0.0, 8.0, 0.0, 0.0]
     * //   [0.0, 0.0, 9.0, 0.0]
     * //   [0.0, 0.0, 0.0, 1.0]
     * var m = Cesium.Matrix4.fromScale(new Cesium.Cartesian3(7.0, 8.0, 9.0));
     */
    static fromScale (scale:Cartesian3, result?:CesiumMatrix4):CesiumMatrix4 {
        if (!defined(result)) {
            return new CesiumMatrix4(
                scale.x,
                0.0,
                0.0,
                0.0,
                0.0,
                scale.y,
                0.0,
                0.0,
                0.0,
                0.0,
                scale.z,
                0.0,
                0.0,
                0.0,
                0.0,
                1.0
            );
        }

        (result as CesiumMatrix4)[0] = scale.x;
        (result as CesiumMatrix4)[1] = 0.0;
        (result as CesiumMatrix4)[2] = 0.0;
        (result as CesiumMatrix4)[3] = 0.0;
        (result as CesiumMatrix4)[4] = 0.0;
        (result as CesiumMatrix4)[5] = scale.y;
        (result as CesiumMatrix4)[6] = 0.0;
        (result as CesiumMatrix4)[7] = 0.0;
        (result as CesiumMatrix4)[8] = 0.0;
        (result as CesiumMatrix4)[9] = 0.0;
        (result as CesiumMatrix4)[10] = scale.z;
        (result as CesiumMatrix4)[11] = 0.0;
        (result as CesiumMatrix4)[12] = 0.0;
        (result as CesiumMatrix4)[13] = 0.0;
        (result as CesiumMatrix4)[14] = 0.0;
        (result as CesiumMatrix4)[15] = 1.0;
        return (result as CesiumMatrix4);
    }

    /**
 * Duplicates a Matrix4 instance.
 *
 * @param {Matrix4} matrix The matrix to duplicate.
 * @param {Matrix4} [result] The object onto which to store the result.
 * @returns {Matrix4} The modified result parameter or a new Matrix4 instance if one was not provided. (Returns undefined if matrix is undefined)
 */
    static clone (matrix:CesiumMatrix4, result?:CesiumMatrix4):CesiumMatrix4 {
        // if (!defined(matrix)) {
        //     return undefined;
        // }
        if (!defined(result)) {
            return new CesiumMatrix4(
                matrix[0],
                matrix[4],
                matrix[8],
                matrix[12],
                matrix[1],
                matrix[5],
                matrix[9],
                matrix[13],
                matrix[2],
                matrix[6],
                matrix[10],
                matrix[14],
                matrix[3],
                matrix[7],
                matrix[11],
                matrix[15]
            );
        }
        (result as CesiumMatrix4)[0] = matrix[0];
        (result as CesiumMatrix4)[1] = matrix[1];
        (result as CesiumMatrix4)[2] = matrix[2];
        (result as CesiumMatrix4)[3] = matrix[3];
        (result as CesiumMatrix4)[4] = matrix[4];
        (result as CesiumMatrix4)[5] = matrix[5];
        (result as CesiumMatrix4)[6] = matrix[6];
        (result as CesiumMatrix4)[7] = matrix[7];
        (result as CesiumMatrix4)[8] = matrix[8];
        (result as CesiumMatrix4)[9] = matrix[9];
        (result as CesiumMatrix4)[10] = matrix[10];
        (result as CesiumMatrix4)[11] = matrix[11];
        (result as CesiumMatrix4)[12] = matrix[12];
        (result as CesiumMatrix4)[13] = matrix[13];
        (result as CesiumMatrix4)[14] = matrix[14];
        (result as CesiumMatrix4)[15] = matrix[15];
        return (result as CesiumMatrix4);
    }

    /**
 * Computes the product of a matrix and a {@link Cartesian3}. This is equivalent to calling {@link Matrix4.multiplyByVector}
 * with a {@link Cartesian4} with a <code>w</code> component of 1, but returns a {@link Cartesian3} instead of a {@link Cartesian4}.
 *
 * @param {Matrix4} matrix The matrix.
 * @param {Cartesian3} cartesian The point.
 * @param {Cartesian3} result The object onto which to store the result.
 * @returns {Cartesian3} The modified result parameter.
 *
 * @example
 * var p = new Cesium.Cartesian3(1.0, 2.0, 3.0);
 * var result = Cesium.Matrix4.multiplyByPoint(matrix, p, new Cesium.Cartesian3());
 */
    static multiplyByPoint (matrix:CesiumMatrix4, cartesian:Cartesian3, result:Cartesian3):Cartesian3 {
        const vX = cartesian.x;
        const vY = cartesian.y;
        const vZ = cartesian.z;

        const x = matrix[0] * vX + matrix[4] * vY + matrix[8] * vZ + matrix[12];
        const y = matrix[1] * vX + matrix[5] * vY + matrix[9] * vZ + matrix[13];
        const z = matrix[2] * vX + matrix[6] * vY + matrix[10] * vZ + matrix[14];

        result.x = x;
        result.y = y;
        result.z = z;
        return result;
    }

    /**
 * Retrieves a copy of the matrix column at the provided index as a Cartesian4 instance.
 *
 * @param {Matrix4} matrix The matrix to use.
 * @param {Number} index The zero-based index of the column to retrieve.
 * @param {Cartesian4} result The object onto which to store the result.
 * @returns {Cartesian4} The modified result parameter.
 *
 * @exception {DeveloperError} index must be 0, 1, 2, or 3.
 *
 * @example
 * //returns a Cartesian4 instance with values from the specified column
 * // m = [10.0, 11.0, 12.0, 13.0]
 * //     [14.0, 15.0, 16.0, 17.0]
 * //     [18.0, 19.0, 20.0, 21.0]
 * //     [22.0, 23.0, 24.0, 25.0]
 *
 * //Example 1: Creates an instance of Cartesian
 * var a = Cesium.Matrix4.getColumn(m, 2, new Cesium.Cartesian4());
 *
 * @example
 * //Example 2: Sets values for Cartesian instance
 * var a = new Cesium.Cartesian4();
 * Cesium.Matrix4.getColumn(m, 2, a);
 *
 * // a.x = 12.0; a.y = 16.0; a.z = 20.0; a.w = 24.0;
 */
    static getColumn (matrix: CesiumMatrix4, index: number, result: Cartesian4):Cartesian4 {
        const startIndex = index * 4;
        const x = matrix[startIndex];
        const y = matrix[startIndex + 1];
        const z = matrix[startIndex + 2];
        const w = matrix[startIndex + 3];

        result.x = x;
        result.y = y;
        result.z = z;
        result.w = w;
        return result;
    }
}

export { CesiumMatrix4 };
