import { BoundingSphere } from './BoundingSphere';
import { Cartesian3 } from './Cartesian3';
import { CesiumMath } from './CesiumMath';
import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';
import { Ellipsoid } from './Ellipsoid';
import { Interval } from './Interval';
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
const raySphereRoots = {
    root0: 0.0,
    root1: 0.0
};

function solveQuadratic (a: number, b: number, c: number, result: any) {
    const det = b * b - 4.0 * a * c;
    if (det < 0.0) {
        return undefined;
    } else if (det > 0.0) {
        const denom = 1.0 / (2.0 * a);
        const disc = Math.sqrt(det);
        const root0 = (-b + disc) * denom;
        const root1 = (-b - disc) * denom;

        if (root0 < root1) {
            result.root0 = root0;
            result.root1 = root1;
        } else {
            result.root0 = root1;
            result.root1 = root0;
        }

        return result;
    }

    const root = -b / (2.0 * a);
    if (root === 0.0) {
        return undefined;
    }

    result.root0 = result.root1 = root;
    return result;
}

function raySphere (ray: Ray, sphere: BoundingSphere, result?: Interval): Interval | undefined {
    if (!defined(result)) {
        result = new Interval();
    }

    const origin = ray.origin;
    const direction = ray.direction;

    const center = sphere.center;
    const radiusSquared = sphere.radius * sphere.radius;

    const diff = Cartesian3.subtract(origin, center, scratchPVec);

    const a = Cartesian3.dot(direction, direction);
    const b = 2.0 * Cartesian3.dot(direction, diff);
    const c = Cartesian3.magnitudeSquared(diff) - radiusSquared;

    const roots = solveQuadratic(a, b, c, raySphereRoots);
    if (!defined(roots)) {
        return undefined;
    }

    (result as Interval).start = roots.root0;
    (result as Interval).stop = roots.root1;
    return result;
}

/**
 * Computes the intersection points of a ray with a sphere.
 * @memberof IntersectionTests
 *
 * @param {Ray} ray The ray.
 * @param {BoundingSphere} sphere The sphere.
 * @param {Interval} [result] The result onto which to store the result.
 * @returns {Interval} The interval containing scalar points along the ray or undefined if there are no intersections.
 */
IntersectionTests.raySphere = function (ray: Ray, sphere: BoundingSphere, result?: Interval): Interval | undefined {
    // >>includeStart('debug', pragmas.debug);
    if (!defined(ray)) {
        throw new DeveloperError('ray is required.');
    }
    if (!defined(sphere)) {
        throw new DeveloperError('sphere is required.');
    }
    // >>includeEnd('debug');

    result = raySphere(ray, sphere, result);
    if (!defined(result) || (result as Interval).stop < 0.0) {
        return undefined;
    }

    (result as Interval).start = Math.max((result as Interval).start, 0.0);
    return (result as Interval);
};

const scratchQ = new Cartesian3();
const scratchW = new Cartesian3();

/**
 * Computes the intersection points of a ray with an ellipsoid.
 *
 * @param {Ray} ray The ray.
 * @param {Ellipsoid} ellipsoid The ellipsoid.
 * @returns {Interval} The interval containing scalar points along the ray or undefined if there are no intersections.
 */
IntersectionTests.rayEllipsoid = function (ray: Ray, ellipsoid: Ellipsoid): Interval | undefined {
    // >>includeStart('debug', pragmas.debug);
    if (!defined(ray)) {
        throw new DeveloperError('ray is required.');
    }
    if (!defined(ellipsoid)) {
        throw new DeveloperError('ellipsoid is required.');
    }
    // >>includeEnd('debug');

    const inverseRadii = ellipsoid.oneOverRadii as Cartesian3;
    const q = Cartesian3.multiplyComponents(inverseRadii, ray.origin, scratchQ);
    const w = Cartesian3.multiplyComponents(inverseRadii, ray.direction, scratchW);

    const q2 = Cartesian3.magnitudeSquared(q);
    const qw = Cartesian3.dot(q, w);

    let difference, w2, product, discriminant, temp;

    if (q2 > 1.0) {
    // Outside ellipsoid.
        if (qw >= 0.0) {
            // Looking outward or tangent (0 intersections).
            return undefined;
        }

        // qw < 0.0.
        const qw2 = qw * qw;
        difference = q2 - 1.0; // Positively valued.
        w2 = Cartesian3.magnitudeSquared(w);
        product = w2 * difference;

        if (qw2 < product) {
            // Imaginary roots (0 intersections).
            return undefined;
        } else if (qw2 > product) {
            // Distinct roots (2 intersections).
            discriminant = qw * qw - product;
            temp = -qw + Math.sqrt(discriminant); // Avoid cancellation.
            const root0 = temp / w2;
            const root1 = difference / temp;
            if (root0 < root1) {
                return new Interval(root0, root1);
            }

            return {
                start: root1,
                stop: root0
            };
        }
        // qw2 == product.  Repeated roots (2 intersections).
        const root = Math.sqrt(difference / w2);
        return new Interval(root, root);
    } else if (q2 < 1.0) {
    // Inside ellipsoid (2 intersections).
        difference = q2 - 1.0; // Negatively valued.
        w2 = Cartesian3.magnitudeSquared(w);
        product = w2 * difference; // Negatively valued.

        discriminant = qw * qw - product;
        temp = -qw + Math.sqrt(discriminant); // Positively valued.
        return new Interval(0.0, temp / w2);
    }
    // q2 == 1.0. On ellipsoid.
    if (qw < 0.0) {
    // Looking inward.
        w2 = Cartesian3.magnitudeSquared(w);
        return new Interval(0.0, -qw / w2);
    }

    // qw >= 0.0.  Looking outward or tangent.
    return undefined;
};

export { IntersectionTests };
