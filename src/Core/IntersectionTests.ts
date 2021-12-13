import { Cartesian3 } from './Cartesian3';
import { CesiumMath } from './CesiumMath';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';
import { Plane } from './Plane';
import { Ray } from './Ray';

/**
 * Functions for computing the intersection between geometries such as rays, planes, triangles, and ellipsoids.
 *
 * @namespace IntersectionTests
 */
const IntersectionTests: {
    [name: string]: any
} = {};

/**
 * Computes the intersection of a ray and a plane.
 *
 * @param {Ray} ray The ray.
 * @param {Plane} plane The plane.
 * @param {Cartesian3} [result] The object onto which to store the result.
 * @returns {Cartesian3} The intersection point or undefined if there is no intersections.
 */
IntersectionTests.rayPlane = function (ray:Ray, plane:Plane, result?:Cartesian3):Cartesian3 |undefined {
    // >>includeStart('debug', pragmas.debug);
    if (!defined(ray)) {
        throw new DeveloperError('ray is required.');
    }
    if (!defined(plane)) {
        throw new DeveloperError('plane is required.');
    }
    // >>includeEnd('debug');

    if (!defined(result)) {
        result = new Cartesian3();
    }

    const origin = ray.origin;
    const direction = ray.direction;
    const normal = plane.normal;
    const denominator = Cartesian3.dot(normal, direction);

    if (Math.abs(denominator) < CesiumMath.EPSILON15) {
        // Ray is parallel to plane.  The ray may be in the polygon's plane.
        return undefined;
    }

    const t = (-plane.distance - Cartesian3.dot(normal, origin)) / denominator;

    if (t < 0) {
        return undefined;
    }

    result = Cartesian3.multiplyByScalar(direction, t, result as Cartesian3);
    return Cartesian3.add(origin, result, result);
};
export { IntersectionTests };
