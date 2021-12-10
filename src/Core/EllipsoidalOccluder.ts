
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

import { Cartesian3 } from './Cartesian3';
import { defined } from './defined';
import { Ellipsoid } from './Ellipsoid';

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
}

export { EllipsoidalOccluder };
