import { Cartesian3 } from './Cartesian3';
import { CesiumMath } from './CesiumMath';
import { defaultValue } from './defaultValue';
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

const scratchEdge0 = new Cartesian3();
const scratchEdge1 = new Cartesian3();
const scratchPVec = new Cartesian3();
const scratchTVec = new Cartesian3();
const scratchQVec = new Cartesian3();

/**
 * Computes the intersection of a ray and a triangle as a parametric distance along the input ray. The result is negative when the triangle is behind the ray.
 *
 * Implements {@link https://cadxfem.org/inf/Fast%20MinimumStorage%20RayTriangle%20Intersection.pdf|
 * Fast Minimum Storage Ray/Triangle Intersection} by Tomas Moller and Ben Trumbore.
 *
 * @memberof IntersectionTests
 *
 * @param {Ray} ray The ray.
 * @param {Cartesian3} p0 The first vertex of the triangle.
 * @param {Cartesian3} p1 The second vertex of the triangle.
 * @param {Cartesian3} p2 The third vertex of the triangle.
 * @param {Boolean} [cullBackFaces=false] If <code>true</code>, will only compute an intersection with the front face of the triangle
 *                  and return undefined for intersections with the back face.
 * @returns {Number} The intersection as a parametric distance along the ray, or undefined if there is no intersection.
 */
IntersectionTests.rayTriangleParametric = function (
    ray: any,
    p0: any,
    p1: any,
    p2: any,
    cullBackFaces = false
) {
    // >>includeStart('debug', pragmas.debug);
    if (!defined(ray)) {
        throw new DeveloperError('ray is required.');
    }
    if (!defined(p0)) {
        throw new DeveloperError('p0 is required.');
    }
    if (!defined(p1)) {
        throw new DeveloperError('p1 is required.');
    }
    if (!defined(p2)) {
        throw new DeveloperError('p2 is required.');
    }
    // >>includeEnd('debug');

    cullBackFaces = defaultValue(cullBackFaces, false);

    const origin = ray.origin;
    const direction = ray.direction;

    const edge0 = Cartesian3.subtract(p1, p0, scratchEdge0);
    const edge1 = Cartesian3.subtract(p2, p0, scratchEdge1);

    const p = Cartesian3.cross(direction, edge1, scratchPVec);
    const det = Cartesian3.dot(edge0, p);

    let tvec;
    let q;

    let u;
    let v;
    let t;

    if (cullBackFaces) {
        if (det < CesiumMath.EPSILON6) {
            return undefined;
        }

        tvec = Cartesian3.subtract(origin, p0, scratchTVec);
        u = Cartesian3.dot(tvec, p);
        if (u < 0.0 || u > det) {
            return undefined;
        }

        q = Cartesian3.cross(tvec, edge0, scratchQVec);

        v = Cartesian3.dot(direction, q);
        if (v < 0.0 || u + v > det) {
            return undefined;
        }

        t = Cartesian3.dot(edge1, q) / det;
    } else {
        if (Math.abs(det) < CesiumMath.EPSILON6) {
            return undefined;
        }
        const invDet = 1.0 / det;

        tvec = Cartesian3.subtract(origin, p0, scratchTVec);
        u = Cartesian3.dot(tvec, p) * invDet;
        if (u < 0.0 || u > 1.0) {
            return undefined;
        }

        q = Cartesian3.cross(tvec, edge0, scratchQVec);

        v = Cartesian3.dot(direction, q) * invDet;
        if (v < 0.0 || u + v > 1.0) {
            return undefined;
        }

        t = Cartesian3.dot(edge1, q) * invDet;
    }

    return t;
};

export { IntersectionTests };
