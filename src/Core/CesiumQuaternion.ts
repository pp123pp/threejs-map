import { Cartesian3 } from './Cartesian3';
import { defined } from './defined';

let fromAxisAngleScratch = new Cartesian3();

class CesiumQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor (x = 0.0, y = 0.0, z = 0.0, w = 0.0) {
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

        /**
        * The W component.
        * @type {Number}
        * @default 0.0
        */
        this.w = w;
    }

    /**
     * Computes a quaternion representing a rotation around an axis.
     *
     * @param {Cartesian3} axis The axis of rotation.
     * @param {Number} angle The angle in radians to rotate around the axis.
     * @param {Quaternion} [result] The object onto which to store the result.
     * @returns {Quaternion} The modified result parameter or a new Quaternion instance if one was not provided.
     */
    static fromAxisAngle (axis: Cartesian3, angle: number, result?: CesiumQuaternion): CesiumQuaternion {
        const halfAngle = angle / 2.0;
        const s = Math.sin(halfAngle);
        fromAxisAngleScratch = Cartesian3.normalize(axis, fromAxisAngleScratch);

        const x = fromAxisAngleScratch.x * s;
        const y = fromAxisAngleScratch.y * s;
        const z = fromAxisAngleScratch.z * s;
        const w = Math.cos(halfAngle);
        if (!defined(result)) {
            return new CesiumQuaternion(x, y, z, w);
        }
        (result as CesiumQuaternion).x = x;
        (result as CesiumQuaternion).y = y;
        (result as CesiumQuaternion).z = z;
        (result as CesiumQuaternion).w = w;
        return (result as CesiumQuaternion);
    }
}

export { CesiumQuaternion };
