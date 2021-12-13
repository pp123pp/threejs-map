
/**
 * Represents a ray that extends infinitely from the provided origin in the provided direction.
 * @alias Ray
 * @constructor
 *
 * @param {Cartesian3} [origin=Cartesian3.ZERO] The origin of the ray.
 * @param {Cartesian3} [direction=Cartesian3.ZERO] The direction of the ray.
 */

import { Cartesian3 } from './Cartesian3';
import { defaultValue } from './defaultValue';

class Ray {
    origin: Cartesian3;
    direction: Cartesian3;
    constructor (origin?: Cartesian3, direction?: Cartesian3) {
        direction = Cartesian3.clone(defaultValue(direction, Cartesian3.ZERO) as Cartesian3);
        if (!Cartesian3.equals(direction, Cartesian3.ZERO)) {
            Cartesian3.normalize(direction, direction);
        }

        /**
         * The origin of the ray.
         * @type {Cartesian3}
         * @default {@link Cartesian3.ZERO}
         */
        this.origin = Cartesian3.clone(defaultValue(origin, Cartesian3.ZERO) as Cartesian3);

        /**
         * The direction of the ray.
         * @type {Cartesian3}
         */
        this.direction = direction;
    }
}

export { Ray };
