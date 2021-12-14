
import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';
import { CesiumMath } from './CesiumMath';
import { Ellipsoid } from './Ellipsoid';
import { Cartesian3 } from './Cartesian3';
import { CesiumMatrix4 } from './CesiumMatrix4';

/**
     * Contains functions for transforming positions to various reference frames.
     *
     * @exports Transforms
     */
const Transforms: {
    [name: string]: any
} = {};

const vectorProductLocalFrame = {
    up: {
        south: 'east',
        north: 'west',
        west: 'south',
        east: 'north'
    },
    down: {
        south: 'west',
        north: 'east',
        west: 'north',
        east: 'south'
    },
    south: {
        up: 'west',
        down: 'east',
        west: 'down',
        east: 'up'
    },
    north: {
        up: 'east',
        down: 'west',
        west: 'up',
        east: 'down'
    },
    west: {
        up: 'north',
        down: 'south',
        north: 'down',
        south: 'up'
    },
    east: {
        up: 'south',
        down: 'north',
        north: 'up',
        south: 'down'
    }
};

const degeneratePositionLocalFrame = {
    north: [
        -1,
        0,
        0
    ],
    east: [
        0,
        1,
        0
    ],
    up: [
        0,
        0,
        1
    ],
    south: [
        1,
        0,
        0
    ],
    west: [
        0,
        -1,
        0
    ],
    down: [
        0,
        0,
        -1
    ]
};

const localFrameToFixedFrameCache = {};

const scratchCalculateCartesian = {
    east: new Cartesian3(),
    north: new Cartesian3(),
    up: new Cartesian3(),
    west: new Cartesian3(),
    south: new Cartesian3(),
    down: new Cartesian3()
};
let scratchFirstCartesian = new Cartesian3();
let scratchSecondCartesian = new Cartesian3();
let scratchThirdCartesian = new Cartesian3();
/**
 * Generates a function that computes a 4x4 transformation matrix from a reference frame
 * centered at the provided origin to the provided ellipsoid's fixed reference frame.
 * @param  {String} firstAxis  name of the first axis of the local reference frame. Must be
 *  'east', 'north', 'up', 'west', 'south' or 'down'.
 * @param  {String} secondAxis  name of the second axis of the local reference frame. Must be
 *  'east', 'north', 'up', 'west', 'south' or 'down'.
 * @return {localFrameToFixedFrameGenerator~resultat} The function that will computes a
 * 4x4 transformation matrix from a reference frame, with first axis and second axis compliant with the parameters,
 */
Transforms.localFrameToFixedFrameGenerator = function (firstAxis: string, secondAxis: string): any {
    // if (!vectorProductLocalFrame.hasOwnProperty(firstAxis) || !vectorProductLocalFrame[firstAxis].hasOwnProperty(secondAxis)) {

    if (!Object.prototype.hasOwnProperty.call(vectorProductLocalFrame, firstAxis) || !Object.prototype.hasOwnProperty.call(vectorProductLocalFrame[firstAxis], secondAxis)) {
        throw new DeveloperError('firstAxis and secondAxis must be east, north, up, west, south or down.');
    }
    const thirdAxis = vectorProductLocalFrame[firstAxis][secondAxis];

    /**
    * Computes a 4x4 transformation matrix from a reference frame
    * centered at the provided origin to the provided ellipsoid's fixed reference frame.
    * @callback Transforms~LocalFrameToFixedFrame
    * @param {Cartesian3} origin The center point of the local reference frame.
    * @param {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] The ellipsoid whose fixed frame is used in the transformation.
    * @param {CesiumMatrix4} [result] The object onto which to store the result.
    * @returns {CesiumMatrix4} The modified result parameter or a new CesiumCesiumMatrix4 instance if none was provided.
    */
    let resultat;
    const hashAxis = firstAxis + secondAxis;
    if (defined(localFrameToFixedFrameCache[hashAxis])) {
        resultat = localFrameToFixedFrameCache[hashAxis];
    } else {
        resultat = function (origin:any, ellipsoid:any, result:any) {
            // >>includeStart('debug', pragmas.debug);
            if (!defined(origin)) {
                throw new DeveloperError('origin is required.');
            }
            // >>includeEnd('debug');
            if (!defined(result)) {
                result = new CesiumMatrix4();
            }
            // If x and y are zero, assume origin is at a pole, which is a special case.
            if (CesiumMath.equalsEpsilon(origin.x, 0.0, CesiumMath.EPSILON14) && CesiumMath.equalsEpsilon(origin.y, 0.0, CesiumMath.EPSILON14)) {
                const sign = CesiumMath.sign(origin.z);

                Cartesian3.unpack(degeneratePositionLocalFrame[firstAxis], 0, scratchFirstCartesian);
                if (firstAxis !== 'east' && firstAxis !== 'west') {
                    Cartesian3.multiplyByScalar(scratchFirstCartesian, sign, scratchFirstCartesian);
                }

                Cartesian3.unpack(degeneratePositionLocalFrame[secondAxis], 0, scratchSecondCartesian);
                if (secondAxis !== 'east' && secondAxis !== 'west') {
                    Cartesian3.multiplyByScalar(scratchSecondCartesian, sign, scratchSecondCartesian);
                }

                Cartesian3.unpack(degeneratePositionLocalFrame[thirdAxis], 0, scratchThirdCartesian);
                if (thirdAxis !== 'east' && thirdAxis !== 'west') {
                    Cartesian3.multiplyByScalar(scratchThirdCartesian, sign, scratchThirdCartesian);
                }
            } else {
                ellipsoid = defaultValue(ellipsoid, Ellipsoid.WGS84);
                ellipsoid.geodeticSurfaceNormal(origin, scratchCalculateCartesian.up);

                const up = scratchCalculateCartesian.up;
                const east = scratchCalculateCartesian.east;
                east.x = -origin.y;
                east.y = origin.x;
                east.z = 0.0;
                Cartesian3.normalize(east, scratchCalculateCartesian.east);
                Cartesian3.cross(up, east, scratchCalculateCartesian.north);

                Cartesian3.multiplyByScalar(scratchCalculateCartesian.up, -1, scratchCalculateCartesian.down);
                Cartesian3.multiplyByScalar(scratchCalculateCartesian.east, -1, scratchCalculateCartesian.west);
                Cartesian3.multiplyByScalar(scratchCalculateCartesian.north, -1, scratchCalculateCartesian.south);

                scratchFirstCartesian = scratchCalculateCartesian[firstAxis];
                scratchSecondCartesian = scratchCalculateCartesian[secondAxis];
                scratchThirdCartesian = scratchCalculateCartesian[thirdAxis];
            }
            result.elements[0] = scratchFirstCartesian.x;
            result.elements[1] = scratchFirstCartesian.y;
            result.elements[2] = scratchFirstCartesian.z;
            result.elements[3] = 0.0;
            result.elements[4] = scratchSecondCartesian.x;
            result.elements[5] = scratchSecondCartesian.y;
            result.elements[6] = scratchSecondCartesian.z;
            result.elements[7] = 0.0;
            result.elements[8] = scratchThirdCartesian.x;
            result.elements[9] = scratchThirdCartesian.y;
            result.elements[10] = scratchThirdCartesian.z;
            result.elements[11] = 0.0;
            result.elements[12] = origin.x;
            result.elements[13] = origin.y;
            result.elements[14] = origin.z;
            result.elements[15] = 1.0;
            return result;
        };
        localFrameToFixedFrameCache[hashAxis] = resultat;
    }
    return resultat;
};

/**
  * Computes a 4x4 transformation matrix from a reference frame with an east-north-up axes
  * centered at the provided origin to the provided ellipsoid's fixed reference frame.
  * The local axes are defined as:
  * <ul>
  * <li>The <code>x</code> axis points in the local east direction.</li>
  * <li>The <code>y</code> axis points in the local north direction.</li>
  * <li>The <code>z</code> axis points in the direction of the ellipsoid surface normal which passes through the position.</li>
  * </ul>
  *
  * @function
  * @param {Cartesian3} origin The center point of the local reference frame.
  * @param {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] The ellipsoid whose fixed frame is used in the transformation.
  * @param {CesiumMatrix4} [result] The object onto which to store the result.
  * @returns {CesiumMatrix4} The modified result parameter or a new CesiumCesiumMatrix4 instance if none was provided.
  *
  * @example
  * // Get the transform from local east-north-up at cartographic (0.0, 0.0) to Earth's fixed frame.
  * var center = Cesium.Cartesian3.fromDegrees(0.0, 0.0);
  * var transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
  */
Transforms.eastNorthUpToFixedFrame = Transforms.localFrameToFixedFrameGenerator('east', 'north');

export { Transforms };
