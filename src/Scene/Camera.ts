import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { CesiumMath } from '@/Core/CesiumMath';
import { CesiumMatrix4 } from '@/Core/CesiumMatrix4';
import { defined } from '@/Core/defined';
import { EllipsoidGeodesic } from '@/Core/EllipsoidGeodesic';
import { Event } from '@/Core/Event';
import { GeographicProjection } from '@/Core/GeographicProjection';
import { HeadingPitchRange } from '@/Core/HeadingPitchRange';
import { Rectangle } from '@/Core/Rectangle';
import { SceneMode } from '@/Core/SceneMode';
import { OrthographicFrustumCamera } from './OrthographicFrustumCamera';
import { PerspectiveFrustumCamera, PerspectiveFrustumCameraParameters } from './PerspectiveFrustumCamera';
import { Scene } from './Scene';

function updateViewMatrix (camera: Camera) {
    CesiumMatrix4.computeView(
        camera._position,
        camera._direction,
        camera._up,
        camera._right,
        camera._viewMatrix
    );
    CesiumMatrix4.multiply(
        camera._viewMatrix,
        camera._actualInvTransform,
        camera._viewMatrix
    );
    CesiumMatrix4.inverseTransformation(camera._viewMatrix, camera._invViewMatrix);
}

class Camera {
    _scene: Scene;

    _transform: CesiumMatrix4;
    _invTransform: CesiumMatrix4;
    _actualTransform: CesiumMatrix4;
    _actualInvTransform: CesiumMatrix4;
    _transformChanged: boolean;

    position: Cartesian3;
    _position: Cartesian3;
    _positionWC: Cartesian3;
    _positionCartographic: Cartographic;
    _oldPositionWC?: Cartesian3;

    positionWCDeltaMagnitude: number;
    positionWCDeltaMagnitudeLastFrame: number;
    timeSinceMoved: number;
    _lastMovedTimestamp: number;

    direction: Cartesian3;
    _direction: Cartesian3;
    _directionWC: Cartesian3;

    up: Cartesian3;
    _up: Cartesian3;
    _upWC: Cartesian3;

    right: Cartesian3;
    _right: Cartesian3;
    _rightWC: Cartesian3;

    frustum: PerspectiveFrustumCamera;

    defaultMoveAmount: number;
    defaultLookAmount: number;
    defaultRotateAmount: number;
    defaultZoomAmount: number;
    constrainedAxis?: Cartesian3;

    maximumZoomFactor: number;

    _moveStart: Event;
    _moveEnd: Event;
    _changed: Event;

    _changedPosition: any;
    _changedDirection: any;
    _changedFrustum: any;

    percentageChanged: number;
    _viewMatrix: CesiumMatrix4;
    _invViewMatrix: CesiumMatrix4;

    _mode: SceneMode;
    _modeChanged: boolean;
    _projection: GeographicProjection;
    _maxCoord: Cartesian3;

    _max2Dfrustum: any;
    constructor (scene: Scene, options: PerspectiveFrustumCameraParameters) {
        this._scene = scene;

        this._transform = CesiumMatrix4.clone(CesiumMatrix4.IDENTITY);
        this._invTransform = CesiumMatrix4.clone(CesiumMatrix4.IDENTITY);
        this._actualTransform = CesiumMatrix4.clone(CesiumMatrix4.IDENTITY);
        this._actualInvTransform = CesiumMatrix4.clone(CesiumMatrix4.IDENTITY);
        this._transformChanged = false;

        /**
         * The position of the camera.
         *
         * @type {Cartesian3}
         */
        this.position = new Cartesian3();
        this._position = new Cartesian3();
        this._positionWC = new Cartesian3();
        this._positionCartographic = new Cartographic();
        this._oldPositionWC = undefined;

        /**
         * The position delta magnitude.
         *
         * @private
         */
        this.positionWCDeltaMagnitude = 0.0;

        /**
         * The position delta magnitude last frame.
         *
         * @private
         */
        this.positionWCDeltaMagnitudeLastFrame = 0.0;

        /**
         * How long in seconds since the camera has stopped moving
         *
         * @private
         */
        this.timeSinceMoved = 0.0;
        this._lastMovedTimestamp = 0.0;

        /**
         * The view direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.direction = new Cartesian3();
        this._direction = new Cartesian3();
        this._directionWC = new Cartesian3();

        /**
         * The up direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.up = new Cartesian3();
        this._up = new Cartesian3();
        this._upWC = new Cartesian3();

        /**
         * The right direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.right = new Cartesian3();
        this._right = new Cartesian3();
        this._rightWC = new Cartesian3();

        /**
         * The region of space in view.
         *
         * @type {PerspectiveFrustum|PerspectiveOffCenterFrustum|OrthographicFrustum}
         * @default PerspectiveFrustum()
         *
         * @see PerspectiveFrustum
         * @see PerspectiveOffCenterFrustum
         * @see OrthographicFrustum
         */
        this.frustum = new PerspectiveFrustumCamera(scene, options);
        this.frustum.aspectRatio =
          scene.drawingBufferWidth / scene.drawingBufferHeight;
        this.frustum.fov = CesiumMath.toRadians(60.0);

        /**
         * The default amount to move the camera when an argument is not
         * provided to the move methods.
         * @type {Number}
         * @default 100000.0;
         */
        this.defaultMoveAmount = 100000.0;
        /**
         * The default amount to rotate the camera when an argument is not
         * provided to the look methods.
         * @type {Number}
         * @default Math.PI / 60.0
         */
        this.defaultLookAmount = Math.PI / 60.0;
        /**
         * The default amount to rotate the camera when an argument is not
         * provided to the rotate methods.
         * @type {Number}
         * @default Math.PI / 3600.0
         */
        this.defaultRotateAmount = Math.PI / 3600.0;
        /**
         * The default amount to move the camera when an argument is not
         * provided to the zoom methods.
         * @type {Number}
         * @default 100000.0;
         */
        this.defaultZoomAmount = 100000.0;
        /**
         * If set, the camera will not be able to rotate past this axis in either direction.
         * @type {Cartesian3}
         * @default undefined
         */
        this.constrainedAxis = undefined;
        /**
         * The factor multiplied by the the map size used to determine where to clamp the camera position
         * when zooming out from the surface. The default is 1.5. Only valid for 2D and the map is rotatable.
         * @type {Number}
         * @default 1.5
         */
        this.maximumZoomFactor = 1.5;

        this._moveStart = new Event();
        this._moveEnd = new Event();

        this._changed = new Event();
        this._changedPosition = undefined;
        this._changedDirection = undefined;
        this._changedFrustum = undefined;

        /**
         * The amount the camera has to change before the <code>changed</code> event is raised. The value is a percentage in the [0, 1] range.
         * @type {number}
         * @default 0.5
         */
        this.percentageChanged = 0.5;

        this._viewMatrix = new CesiumMatrix4();
        this._invViewMatrix = new CesiumMatrix4();
        updateViewMatrix(this);

        this._mode = SceneMode.SCENE3D;
        this._modeChanged = true;
        const projection = scene.mapProjection;
        this._projection = projection;
        this._maxCoord = projection.project(
            new Cartographic(Math.PI, CesiumMath.PI_OVER_TWO)
        );
        this._max2Dfrustum = undefined;

        // set default view
        rectangleCameraPosition3D(
            this,
            Camera.DEFAULT_VIEW_RECTANGLE,
            this.position,
            true
        );

        let mag = Cartesian3.magnitude(this.position);
        mag += mag * Camera.DEFAULT_VIEW_FACTOR;
        Cartesian3.normalize(this.position, this.position);
        Cartesian3.multiplyByScalar(this.position, mag, this.position);
    }

    /**
     * @private
     */
    static TRANSFORM_2D = new CesiumMatrix4(
        0.0,
        0.0,
        1.0,
        0.0,
        1.0,
        0.0,
        0.0,
        0.0,
        0.0,
        1.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        1.0
    );

    /**
     * @private
     */
    static TRANSFORM_2D_INVERSE = CesiumMatrix4.inverseTransformation(
        Camera.TRANSFORM_2D,
        new CesiumMatrix4()
    );

    /**
     * The default rectangle the camera will view on creation.
     * @type Rectangle
     */
    static DEFAULT_VIEW_RECTANGLE = Rectangle.fromDegrees(
        -95.0,
        -20.0,
        -70.0,
        90.0
    );

    /**
     * A scalar to multiply to the camera position and add it back after setting the camera to view the rectangle.
     * A value of zero means the camera will view the entire {@link Camera#DEFAULT_VIEW_RECTANGLE}, a value greater than zero
     * will move it further away from the extent, and a value less than zero will move it close to the extent.
     * @type Number
     */
    static DEFAULT_VIEW_FACTOR = 0.5;

    /**
     * The default heading/pitch/range that is used when the camera flies to a location that contains a bounding sphere.
     * @type HeadingPitchRange
     */
    static DEFAULT_OFFSET = new HeadingPitchRange(
        0.0,
        -CesiumMath.PI_OVER_FOUR,
        0.0
    );

    resize (container: Element): void {
        this.frustum.resize(container);
    }
}

const viewRectangle3DCartographic1 = new Cartographic();
const viewRectangle3DCartographic2 = new Cartographic();
const viewRectangle3DNorthEast = new Cartesian3();
const viewRectangle3DSouthWest = new Cartesian3();
const viewRectangle3DNorthWest = new Cartesian3();
const viewRectangle3DSouthEast = new Cartesian3();
const viewRectangle3DNorthCenter = new Cartesian3();
const viewRectangle3DSouthCenter = new Cartesian3();
const viewRectangle3DCenter = new Cartesian3();
const viewRectangle3DEquator = new Cartesian3();
const defaultRF = {
    direction: new Cartesian3(),
    right: new Cartesian3(),
    up: new Cartesian3()
};
let viewRectangle3DEllipsoidGeodesic: any;

function computeD (direction: Cartesian3, upOrRight: Cartesian3, corner: Cartesian3, tanThetaOrPhi: number) {
    const opposite = Math.abs(Cartesian3.dot(upOrRight, corner));
    return opposite / tanThetaOrPhi - Cartesian3.dot(direction, corner);
}

function rectangleCameraPosition3D (camera: Camera, rectangle: Rectangle, result: any, updateCamera: any) {
    const ellipsoid = camera._projection.ellipsoid;
    const cameraRF = updateCamera ? camera : defaultRF;

    const north = rectangle.north;
    const south = rectangle.south;
    let east = rectangle.east;
    const west = rectangle.west;

    // If we go across the International Date Line
    if (west > east) {
        east += CesiumMath.TWO_PI;
    }

    // Find the midpoint latitude.
    //
    // EllipsoidGeodesic will fail if the north and south edges are very close to being on opposite sides of the ellipsoid.
    // Ideally we'd just call EllipsoidGeodesic.setEndPoints and let it throw when it detects this case, but sadly it doesn't
    // even look for this case in optimized builds, so we have to test for it here instead.
    //
    // Fortunately, this case can only happen (here) when north is very close to the north pole and south is very close to the south pole,
    // so handle it just by using 0 latitude as the center.  It's certainliy possible to use a smaller tolerance
    // than one degree here, but one degree is safe and putting the center at 0 latitude should be good enough for any
    // rectangle that spans 178+ of the 180 degrees of latitude.
    const longitude = (west + east) * 0.5;
    let latitude;
    if (
        south < -CesiumMath.PI_OVER_TWO + CesiumMath.RADIANS_PER_DEGREE &&
    north > CesiumMath.PI_OVER_TWO - CesiumMath.RADIANS_PER_DEGREE
    ) {
        latitude = 0.0;
    } else {
        const northCartographic = viewRectangle3DCartographic1;
        northCartographic.longitude = longitude;
        northCartographic.latitude = north;
        northCartographic.height = 0.0;

        const southCartographic = viewRectangle3DCartographic2;
        southCartographic.longitude = longitude;
        southCartographic.latitude = south;
        southCartographic.height = 0.0;

        let ellipsoidGeodesic = viewRectangle3DEllipsoidGeodesic;
        if (
            !defined(ellipsoidGeodesic) ||
      ellipsoidGeodesic.ellipsoid !== ellipsoid
        ) {
            viewRectangle3DEllipsoidGeodesic = ellipsoidGeodesic = new EllipsoidGeodesic(
                undefined,
                undefined,
                ellipsoid
            );
        }

        ellipsoidGeodesic.setEndPoints(northCartographic, southCartographic);
        latitude = ellipsoidGeodesic.interpolateUsingFraction(
            0.5,
            viewRectangle3DCartographic1
        ).latitude;
    }

    const centerCartographic = viewRectangle3DCartographic1;
    centerCartographic.longitude = longitude;
    centerCartographic.latitude = latitude;
    centerCartographic.height = 0.0;

    const center = ellipsoid.cartographicToCartesian(
        centerCartographic,
        viewRectangle3DCenter
    );

    const cart = viewRectangle3DCartographic1;
    cart.longitude = east;
    cart.latitude = north;
    const northEast = ellipsoid.cartographicToCartesian(
        cart,
        viewRectangle3DNorthEast
    );
    cart.longitude = west;
    const northWest = ellipsoid.cartographicToCartesian(
        cart,
        viewRectangle3DNorthWest
    );
    cart.longitude = longitude;
    const northCenter = ellipsoid.cartographicToCartesian(
        cart,
        viewRectangle3DNorthCenter
    );
    cart.latitude = south;
    const southCenter = ellipsoid.cartographicToCartesian(
        cart,
        viewRectangle3DSouthCenter
    );
    cart.longitude = east;
    const southEast = ellipsoid.cartographicToCartesian(
        cart,
        viewRectangle3DSouthEast
    );
    cart.longitude = west;
    const southWest = ellipsoid.cartographicToCartesian(
        cart,
        viewRectangle3DSouthWest
    );

    Cartesian3.subtract(northWest, center, northWest);
    Cartesian3.subtract(southEast, center, southEast);
    Cartesian3.subtract(northEast, center, northEast);
    Cartesian3.subtract(southWest, center, southWest);
    Cartesian3.subtract(northCenter, center, northCenter);
    Cartesian3.subtract(southCenter, center, southCenter);

    const direction = ellipsoid.geodeticSurfaceNormal(center, cameraRF.direction) as Cartesian3;
    Cartesian3.negate(direction, direction);
    const right = Cartesian3.cross(direction, Cartesian3.UNIT_Z, cameraRF.right);
    Cartesian3.normalize(right, right);
    const up = Cartesian3.cross(right, direction, cameraRF.up);

    let d;
    if (camera.frustum instanceof OrthographicFrustumCamera) {
        const width = Math.max(
            Cartesian3.distance(northEast, northWest),
            Cartesian3.distance(southEast, southWest)
        );
        const height = Math.max(
            Cartesian3.distance(northEast, southEast),
            Cartesian3.distance(northWest, southWest)
        );

        let rightScalar;
        let topScalar;
        const ratio =
      (camera.frustum as PerspectiveFrustumCamera)._offCenterFrustum.right /
      (camera.frustum as PerspectiveFrustumCamera)._offCenterFrustum.top;
        const heightRatio = height * ratio;
        if (width > heightRatio) {
            rightScalar = width;
            topScalar = rightScalar / ratio;
        } else {
            topScalar = height;
            rightScalar = heightRatio;
        }

        d = Math.max(rightScalar, topScalar);
    } else {
        const tanPhi = Math.tan(camera.frustum.fovy * 0.5);
        const tanTheta = camera.frustum.aspectRatio * tanPhi;

        d = Math.max(
            computeD(direction, up, northWest, tanPhi),
            computeD(direction, up, southEast, tanPhi),
            computeD(direction, up, northEast, tanPhi),
            computeD(direction, up, southWest, tanPhi),
            computeD(direction, up, northCenter, tanPhi),
            computeD(direction, up, southCenter, tanPhi),
            computeD(direction, right, northWest, tanTheta),
            computeD(direction, right, southEast, tanTheta),
            computeD(direction, right, northEast, tanTheta),
            computeD(direction, right, southWest, tanTheta),
            computeD(direction, right, northCenter, tanTheta),
            computeD(direction, right, southCenter, tanTheta)
        );

        // If the rectangle crosses the equator, compute D at the equator, too, because that's the
        // widest part of the rectangle when projected onto the globe.
        if (south < 0 && north > 0) {
            const equatorCartographic = viewRectangle3DCartographic1;
            equatorCartographic.longitude = west;
            equatorCartographic.latitude = 0.0;
            equatorCartographic.height = 0.0;
            let equatorPosition = ellipsoid.cartographicToCartesian(
                equatorCartographic,
                viewRectangle3DEquator
            );
            Cartesian3.subtract(equatorPosition, center, equatorPosition);
            d = Math.max(
                d,
                computeD(direction, up, equatorPosition, tanPhi),
                computeD(direction, right, equatorPosition, tanTheta)
            );

            equatorCartographic.longitude = east;
            equatorPosition = ellipsoid.cartographicToCartesian(
                equatorCartographic,
                viewRectangle3DEquator
            );
            Cartesian3.subtract(equatorPosition, center, equatorPosition);
            d = Math.max(
                d,
                computeD(direction, up, equatorPosition, tanPhi),
                computeD(direction, right, equatorPosition, tanTheta)
            );
        }
    }

    return Cartesian3.add(
        center,
        Cartesian3.multiplyByScalar(direction, -d, viewRectangle3DEquator),
        result
    );
}

export { Camera };
