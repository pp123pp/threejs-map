import { Cartesian3 } from './Cartesian3';
import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';
import { Plane } from './Plane';

const faces = [new Cartesian3(), new Cartesian3(), new Cartesian3()];
Cartesian3.clone(Cartesian3.UNIT_X, faces[0]);
Cartesian3.clone(Cartesian3.UNIT_Y, faces[1]);
Cartesian3.clone(Cartesian3.UNIT_Z, faces[2]);

const scratchPlaneCenter = new Cartesian3();
const scratchPlaneNormal = new Cartesian3();
const scratchPlane = new Plane(new Cartesian3(1.0, 0.0, 0.0), 0.0);

class CullingVolume {
    planes:Plane[]
    constructor (planes?: Plane[]) {
        /**
         * Each plane is represented by a Cartesian4 object, where the x, y, and z components
         * define the unit vector normal to the plane, and the w component is the distance of the
         * plane from the origin.
         * @type {Cartesian4[]}
         * @default []
         */
        this.planes = defaultValue(planes, []) as Plane[];
    }
}

export { CullingVolume };
