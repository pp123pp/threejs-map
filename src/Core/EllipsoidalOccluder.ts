/* eslint-disable no-self-compare */

import { Cartesian3 } from './Cartesian3';
import { defined } from './defined';
import { Ellipsoid } from './Ellipsoid';
/**
 * Determine whether or not other objects are visible or hidden behind the visible horizon defined by
 * an {@link Ellipsoid} and a camera position.  The ellipsoid is assumed to be located at the
 * origin of the coordinate system.  This class uses the algorithm described in the
 * {@link https://cesium.com/blog/2013/04/25/Horizon-culling/|Horizon Culling} blog post.
 *
 * @alias EllipsoidalOccluder
 *
 * @param {Ellipsoid} ellipsoid The ellipsoid to use as an occluder.
 * @param {Cartesian3} [cameraPosition] The coordinate of the viewer/camera.  If this parameter is not
 *        specified, {@link EllipsoidalOccluder#cameraPosition} must be called before
 *        testing visibility.
 *
 * @constructor
 *
 * @example
 * // Construct an ellipsoidal occluder with radii 1.0, 1.1, and 0.9.
 * var cameraPosition = new Cesium.Cartesian3(5.0, 6.0, 7.0);
 * var occluderEllipsoid = new Cesium.Ellipsoid(1.0, 1.1, 0.9);
 * var occluder = new Cesium.EllipsoidalOccluder(occluderEllipsoid, cameraPosition);
 *
 * @private
 */

const scratchEllipsoidShrunkRadii = new Cartesian3();

const scratchEllipsoidShrunk = Ellipsoid.clone(Ellipsoid.UNIT_SPHERE);

function getPossiblyShrunkEllipsoid (ellipsoid: any, minimumHeight: any, result: any) {
    if (
        defined(minimumHeight) &&
    minimumHeight < 0.0 &&
    ellipsoid.minimumRadius > -minimumHeight
    ) {
        const ellipsoidShrunkRadii = Cartesian3.fromElements(
            ellipsoid.radii.x + minimumHeight,
            ellipsoid.radii.y + minimumHeight,
            ellipsoid.radii.z + minimumHeight,
            scratchEllipsoidShrunkRadii
        );
        ellipsoid = Ellipsoid.fromCartesian3(ellipsoidShrunkRadii, result);
    }
    return ellipsoid;
}

const scaledSpaceScratch = new Cartesian3();
const directionScratch = new Cartesian3();

function computeMagnitude (ellipsoid: any, position: any, scaledSpaceDirectionToPoint: any) {
    const scaledSpacePosition = ellipsoid.transformPositionToScaledSpace(
        position,
        scaledSpaceScratch
    );
    let magnitudeSquared = Cartesian3.magnitudeSquared(scaledSpacePosition);
    let magnitude = Math.sqrt(magnitudeSquared);
    const direction = Cartesian3.divideByScalar(
        scaledSpacePosition,
        magnitude,
        directionScratch
    );

    // For the purpose of this computation, points below the ellipsoid are consider to be on it instead.
    magnitudeSquared = Math.max(1.0, magnitudeSquared);
    magnitude = Math.max(1.0, magnitude);

    const cosAlpha = Cartesian3.dot(direction, scaledSpaceDirectionToPoint);
    const sinAlpha = Cartesian3.magnitude(
        Cartesian3.cross(direction, scaledSpaceDirectionToPoint, direction)
    );
    const cosBeta = 1.0 / magnitude;
    const sinBeta = Math.sqrt(magnitudeSquared - 1.0) * cosBeta;

    return 1.0 / (cosAlpha * cosBeta - sinAlpha * sinBeta);
}

function computeHorizonCullingPointFromPositions (
    ellipsoid: any,
    directionToPoint: any,
    positions: any,
    result?: any
) {
    if (!defined(result)) {
        result = new Cartesian3();
    }

    const scaledSpaceDirectionToPoint = computeScaledSpaceDirectionToPoint(
        ellipsoid,
        directionToPoint
    );
    let resultMagnitude = 0.0;

    for (let i = 0, len = positions.length; i < len; ++i) {
        const position = positions[i];
        const candidateMagnitude = computeMagnitude(
            ellipsoid,
            position,
            scaledSpaceDirectionToPoint
        );
        if (candidateMagnitude < 0.0) {
            // all points should face the same direction, but this one doesn't, so return undefined
            return undefined;
        }
        resultMagnitude = Math.max(resultMagnitude, candidateMagnitude);
    }

    return magnitudeToPoint(scaledSpaceDirectionToPoint, resultMagnitude, result);
}

function magnitudeToPoint (
    scaledSpaceDirectionToPoint: any,
    resultMagnitude: any,
    result: any
) {
    // The horizon culling point is undefined if there were no positions from which to compute it,
    // the directionToPoint is pointing opposite all of the positions,  or if we computed NaN or infinity.
    if (
        resultMagnitude <= 0.0 ||
      resultMagnitude === 1.0 / 0.0 ||
      resultMagnitude !== resultMagnitude
    ) {
        return undefined;
    }

    return Cartesian3.multiplyByScalar(
        scaledSpaceDirectionToPoint,
        resultMagnitude,
        result
    );
}

const directionToPointScratch = new Cartesian3();

function computeScaledSpaceDirectionToPoint (ellipsoid: any, directionToPoint: any) {
    if (Cartesian3.equals(directionToPoint, Cartesian3.ZERO)) {
        return directionToPoint;
    }

    ellipsoid.transformPositionToScaledSpace(
        directionToPoint,
        directionToPointScratch
    );
    return Cartesian3.normalize(directionToPointScratch, directionToPointScratch);
}

class EllipsoidalOccluder {
    _ellipsoid: Ellipsoid;
    _cameraPosition: Cartesian3;
    _cameraPositionInScaledSpace: Cartesian3;
    _distanceToLimbInScaledSpaceSquared: number;
    constructor (ellipsoid:Ellipsoid, cameraPosition?:Cartesian3) {
        this._ellipsoid = ellipsoid;
        this._cameraPosition = new Cartesian3();
        this._cameraPositionInScaledSpace = new Cartesian3();
        this._distanceToLimbInScaledSpaceSquared = 0.0;

        // cameraPosition fills in the above values
        if (defined(cameraPosition)) {
            this.cameraPosition = (cameraPosition as Cartesian3);
        }
    }

    get cameraPosition ():Cartesian3 {
        return this._cameraPosition;
    }

    set cameraPosition (cameraPosition: Cartesian3) {
        // See https://cesium.com/blog/2013/04/25/Horizon-culling/
        const ellipsoid = this._ellipsoid;
        const cv = ellipsoid.transformPositionToScaledSpace(
            cameraPosition,
            this._cameraPositionInScaledSpace
        );
        const vhMagnitudeSquared = Cartesian3.magnitudeSquared(cv) - 1.0;

        Cartesian3.clone(cameraPosition, this._cameraPosition);
        this._cameraPositionInScaledSpace = cv;
        this._distanceToLimbInScaledSpaceSquared = vhMagnitudeSquared;
    }

    /**
 * Similar to {@link EllipsoidalOccluder#computeHorizonCullingPoint} except computes the culling
 * point relative to an ellipsoid that has been shrunk by the minimum height when the minimum height is below
 * the ellipsoid. The returned point is expressed in the possibly-shrunk ellipsoid-scaled space and is suitable
 * for use with {@link EllipsoidalOccluder#isScaledSpacePointVisiblePossiblyUnderEllipsoid}.
 *
 * @param {Cartesian3} directionToPoint The direction that the computed point will lie along.
 *                     A reasonable direction to use is the direction from the center of the ellipsoid to
 *                     the center of the bounding sphere computed from the positions.  The direction need not
 *                     be normalized.
 * @param {Cartesian3[]} positions The positions from which to compute the horizon culling point.  The positions
 *                       must be expressed in a reference frame centered at the ellipsoid and aligned with the
 *                       ellipsoid's axes.
 * @param {Number} [minimumHeight] The minimum height of all positions. If this value is undefined, all positions are assumed to be above the ellipsoid.
 * @param {Cartesian3} [result] The instance on which to store the result instead of allocating a new instance.
 * @returns {Cartesian3} The computed horizon culling point, expressed in the possibly-shrunk ellipsoid-scaled space.
 */
    computeHorizonCullingPointPossiblyUnderEllipsoid (
        directionToPoint:Cartesian3,
        positions:Cartesian3[],
        minimumHeight?:number,
        result?:Cartesian3
    ):Cartesian3 | undefined {
        const possiblyShrunkEllipsoid = getPossiblyShrunkEllipsoid(
            this._ellipsoid,
            minimumHeight,
            scratchEllipsoidShrunk
        );
        return computeHorizonCullingPointFromPositions(
            possiblyShrunkEllipsoid,
            directionToPoint,
            positions,
            result
        );
    }
}

export { EllipsoidalOccluder };
