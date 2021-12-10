import { Cartesian2 } from './Cartesian2';
import { Cartesian3 } from './Cartesian3';
import { Cartographic } from './Cartographic';
import { CesiumMatrix3, CesiumMatrix3 as Matrix3 } from './CesiumMatrix3';
import { Check } from './Check';
import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';
import { Plane } from './Plane';

const scratchCartesian1 = new Cartesian3();
const scratchCartesian2 = new Cartesian3();
const scratchCartesian3 = new Cartesian3();
const scratchCartesian4 = new Cartesian3();
const scratchCartesian5 = new Cartesian3();
const scratchCartesian6 = new Cartesian3();
const scratchCovarianceResult = new Matrix3();
const scratchEigenResult = {
    unitary: new Matrix3(),
    diagonal: new Matrix3()
};

const scratchOffset = new Cartesian3();
const scratchScale = new Cartesian3();
function fromPlaneExtents (
    planeOrigin: Cartesian3,
    planeXAxis:Cartesian3,
    planeYAxis:Cartesian3,
    planeZAxis:Cartesian3,
    minimumX: number,
    maximumX: number,
    minimumY: number,
    maximumY: number,
    minimumZ: number,
    maximumZ: number,
    result = new OrientedBoundingBox()
) {
    // >>includeStart('debug', pragmas.debug);
    if (
        !defined(minimumX) ||
      !defined(maximumX) ||
      !defined(minimumY) ||
      !defined(maximumY) ||
      !defined(minimumZ) ||
      !defined(maximumZ)
    ) {
        throw new DeveloperError(
            'all extents (minimum/maximum X/Y/Z) are required.'
        );
    }
    // >>includeEnd('debug');

    if (!defined(result)) {
        result = new OrientedBoundingBox();
    }

    const halfAxes = result.halfAxes;
    Matrix3.setColumn(halfAxes, 0, planeXAxis, halfAxes);
    Matrix3.setColumn(halfAxes, 1, planeYAxis, halfAxes);
    Matrix3.setColumn(halfAxes, 2, planeZAxis, halfAxes);

    let centerOffset = scratchOffset;
    centerOffset.x = (minimumX + maximumX) / 2.0;
    centerOffset.y = (minimumY + maximumY) / 2.0;
    centerOffset.z = (minimumZ + maximumZ) / 2.0;

    const scale = scratchScale;
    scale.x = (maximumX - minimumX) / 2.0;
    scale.y = (maximumY - minimumY) / 2.0;
    scale.z = (maximumZ - minimumZ) / 2.0;

    const center = result.center;
    centerOffset = Matrix3.multiplyByVector(halfAxes, centerOffset, centerOffset);
    Cartesian3.add(planeOrigin, centerOffset, center);
    Matrix3.multiplyByScale(halfAxes, scale, halfAxes);

    return result;
}

const scratchRectangleCenterCartographic = new Cartographic();
const scratchRectangleCenter = new Cartesian3();
const scratchPerimeterCartographicNC = new Cartographic();
const scratchPerimeterCartographicNW = new Cartographic();
const scratchPerimeterCartographicCW = new Cartographic();
const scratchPerimeterCartographicSW = new Cartographic();
const scratchPerimeterCartographicSC = new Cartographic();
const scratchPerimeterCartesianNC = new Cartesian3();
const scratchPerimeterCartesianNW = new Cartesian3();
const scratchPerimeterCartesianCW = new Cartesian3();
const scratchPerimeterCartesianSW = new Cartesian3();
const scratchPerimeterCartesianSC = new Cartesian3();
const scratchPerimeterProjectedNC = new Cartesian2();
const scratchPerimeterProjectedNW = new Cartesian2();
const scratchPerimeterProjectedCW = new Cartesian2();
const scratchPerimeterProjectedSW = new Cartesian2();
const scratchPerimeterProjectedSC = new Cartesian2();

const scratchPlaneOrigin = new Cartesian3();
const scratchPlaneNormal = new Cartesian3();
const scratchPlaneXAxis = new Cartesian3();
const scratchHorizonCartesian = new Cartesian3();
const scratchHorizonProjected = new Cartesian2();
const scratchMaxY = new Cartesian3();
const scratchMinY = new Cartesian3();
const scratchZ = new Cartesian3();
const scratchPlane = new Plane(Cartesian3.UNIT_X, 0.0);

class OrientedBoundingBox {
    center: Cartesian3;
    halfAxes: Matrix3;
    constructor (center = Cartesian3.ZERO, halfAxes = Matrix3.ZERO) {
        /**
         * The center of the box.
         * @type {Cartesian3}
         * @default {@link Cartesian3.ZERO}
         */
        this.center = Cartesian3.clone(defaultValue(center, Cartesian3.ZERO));
        /**
        * The transformation matrix, to rotate the box to the right position.
        * @type {Matrix3}
        * @default {@link Matrix3.ZERO}
        */
        this.halfAxes = Matrix3.clone(defaultValue(halfAxes, Matrix3.ZERO)) as CesiumMatrix3;
    }

    /**
     * The number of elements used to pack the object into an array.
     * @type {Number}
     */
    static packedLength = Cartesian3.packedLength + Matrix3.packedLength;

    /**
    * Stores the provided instance into the provided array.
    *
    * @param {OrientedBoundingBox} value The value to pack.
    * @param {Number[]} array The array to pack into.
    * @param {Number} [startingIndex=0] The index into the array at which to start packing the elements.
    *
    * @returns {Number[]} The array that was packed into
    */
    static pack (value: OrientedBoundingBox, array: number[], startingIndex = 0): number[] {
        startingIndex = defaultValue(startingIndex, 0);

        Cartesian3.pack(value.center, array, startingIndex);
        Matrix3.pack(value.halfAxes, array, startingIndex + Cartesian3.packedLength);

        return array;
    }

    /**
    * Retrieves an instance from a packed array.
    *
    * @param {Number[]} array The packed array.
    * @param {Number} [startingIndex=0] The starting index of the element to be unpacked.
    * @param {OrientedBoundingBox} [result] The object into which to store the result.
    * @returns {OrientedBoundingBox} The modified result parameter or a new OrientedBoundingBox instance if one was not provided.
    */
    static unpack (array:number[], startingIndex = 0, result = new OrientedBoundingBox()) {
        // >>includeStart('debug', pragmas.debug);
        Check.defined('array', array);
        // >>includeEnd('debug');

        startingIndex = defaultValue(startingIndex, 0);

        if (!defined(result)) {
            result = new OrientedBoundingBox();
        }

        Cartesian3.unpack(array, startingIndex, result.center);
        Matrix3.unpack(
            array,
            startingIndex + Cartesian3.packedLength,
            result.halfAxes
        );
        return result;
    }

    /**
    * Computes an instance of an OrientedBoundingBox of the given positions.
    * This is an implementation of Stefan Gottschalk's Collision Queries using Oriented Bounding Boxes solution (PHD thesis).
    * Reference: http://gamma.cs.unc.edu/users/gottschalk/main.pdf
    *
    * @param {Cartesian3[]} [positions] List of {@link Cartesian3} points that the bounding box will enclose.
    * @param {OrientedBoundingBox} [result] The object onto which to store the result.
    * @returns {OrientedBoundingBox} The modified result parameter or a new OrientedBoundingBox instance if one was not provided.
    *
    * @example
    * // Compute an object oriented bounding box enclosing two points.
    * var box = Cesium.OrientedBoundingBox.fromPoints([new Cesium.Cartesian3(2, 0, 0), new Cesium.Cartesian3(-2, 0, 0)]);
    */
    static fromPoints (positions:Cartesian3[], result = new OrientedBoundingBox()) {
        if (!defined(result)) {
            result = new OrientedBoundingBox();
        }

        if (!defined(positions) || positions.length === 0) {
            result.halfAxes = Matrix3.ZERO;
            result.center = Cartesian3.ZERO;
            return result;
        }

        let i;
        const length = positions.length;

        const meanPoint = Cartesian3.clone(positions[0], scratchCartesian1);
        for (i = 1; i < length; i++) {
            Cartesian3.add(meanPoint, positions[i], meanPoint);
        }
        const invLength = 1.0 / length;
        Cartesian3.multiplyByScalar(meanPoint, invLength, meanPoint);

        let exx = 0.0;
        let exy = 0.0;
        let exz = 0.0;
        let eyy = 0.0;
        let eyz = 0.0;
        let ezz = 0.0;
        let p;

        for (i = 0; i < length; i++) {
            p = Cartesian3.subtract(positions[i], meanPoint, scratchCartesian2);
            exx += p.x * p.x;
            exy += p.x * p.y;
            exz += p.x * p.z;
            eyy += p.y * p.y;
            eyz += p.y * p.z;
            ezz += p.z * p.z;
        }

        exx *= invLength;
        exy *= invLength;
        exz *= invLength;
        eyy *= invLength;
        eyz *= invLength;
        ezz *= invLength;

        const covarianceMatrix = scratchCovarianceResult;
        covarianceMatrix[0] = exx;
        covarianceMatrix[1] = exy;
        covarianceMatrix[2] = exz;
        covarianceMatrix[3] = exy;
        covarianceMatrix[4] = eyy;
        covarianceMatrix[5] = eyz;
        covarianceMatrix[6] = exz;
        covarianceMatrix[7] = eyz;
        covarianceMatrix[8] = ezz;

        const eigenDecomposition = Matrix3.computeEigenDecomposition(
            covarianceMatrix,
            scratchEigenResult
        );
        const rotation = Matrix3.clone(eigenDecomposition.unitary, result.halfAxes) as CesiumMatrix3;

        let v1 = Matrix3.getColumn(rotation, 0, scratchCartesian4);
        let v2 = Matrix3.getColumn(rotation, 1, scratchCartesian5);
        let v3 = Matrix3.getColumn(rotation, 2, scratchCartesian6);

        let u1 = -Number.MAX_VALUE;
        let u2 = -Number.MAX_VALUE;
        let u3 = -Number.MAX_VALUE;
        let l1 = Number.MAX_VALUE;
        let l2 = Number.MAX_VALUE;
        let l3 = Number.MAX_VALUE;

        for (i = 0; i < length; i++) {
            p = positions[i];
            u1 = Math.max(Cartesian3.dot(v1, p), u1);
            u2 = Math.max(Cartesian3.dot(v2, p), u2);
            u3 = Math.max(Cartesian3.dot(v3, p), u3);

            l1 = Math.min(Cartesian3.dot(v1, p), l1);
            l2 = Math.min(Cartesian3.dot(v2, p), l2);
            l3 = Math.min(Cartesian3.dot(v3, p), l3);
        }

        v1 = Cartesian3.multiplyByScalar(v1, 0.5 * (l1 + u1), v1);
        v2 = Cartesian3.multiplyByScalar(v2, 0.5 * (l2 + u2), v2);
        v3 = Cartesian3.multiplyByScalar(v3, 0.5 * (l3 + u3), v3);

        const center = Cartesian3.add(v1, v2, result.center);
        Cartesian3.add(center, v3, center);

        const scale = scratchCartesian3;
        scale.x = u1 - l1;
        scale.y = u2 - l2;
        scale.z = u3 - l3;
        Cartesian3.multiplyByScalar(scale, 0.5, scale);
        Matrix3.multiplyByScale(result.halfAxes, scale, result.halfAxes);

        return result;
    }
}

export { OrientedBoundingBox };
