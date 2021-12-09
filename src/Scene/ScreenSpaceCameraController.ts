import { CameraEventType } from '@/Core/CameraEventType';
import { Cartesian2 } from '@/Core/Cartesian2';
import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { CesiumMath } from '@/Core/CesiumMath';
import { defined } from '@/Core/defined';
import { DeveloperError } from '@/Core/DeveloperError';
import { KeyboardEventModifier } from '@/Core/KeyboardEventModifier';
import { TweenCollection } from '@/Core/TweenCollection';
import CameraEventAggregator from './CameraEventAggregator';
import { Scene } from './Scene';

class ScreenSpaceCameraController {
    enableInputs: boolean;
    enableTranslate: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
    enableTilt: boolean;
    enableLook: boolean;

    inertiaSpin: number;
    inertiaTranslate: number;
    inertiaZoom: number;
    maximumMovementRatio: number;
    bounceAnimationTime: number;
    minimumZoomDistance: number;
    maximumZoomDistance: number;
    translateEventTypes: number;
    zoomEventTypes: [number, number, number];
    rotateEventTypes: number;
    tiltEventTypes: any[];
    lookEventTypes: {
        eventType: number,
        modifier: number
    };

    minimumPickingTerrainHeight: number;
    _minimumPickingTerrainHeight: number

    minimumCollisionTerrainHeight: number;
    _minimumCollisionTerrainHeight: number;

    minimumTrackBallHeight: number;
    _minimumTrackBallHeight: number;

    enableCollisionDetection: boolean;

    _scene: Scene;
    _globe: undefined;
    _ellipsoid: undefined;
    _aggregator: CameraEventAggregator;

    _tiltCenterMousePosition: Cartesian2;
    _tiltCenter: Cartesian3;
    _rotateMousePosition: Cartesian2;
    _rotateStartPosition: Cartesian3;
    _strafeStartPosition: Cartesian3;
    _strafeMousePosition: Cartesian2;
    _strafeEndMousePosition: Cartesian2;
    _zoomMouseStart: Cartesian2;
    _zoomWorldPosition: Cartesian3;
    _useZoomWorldPosition: boolean;
    _tiltCVOffMap: boolean;
    _looking: boolean;
    _rotating: boolean;
    _strafing: boolean;
    _zoomingOnVector: boolean;
    _zoomingUnderground: boolean;
    _rotatingZoom: boolean;
    _adjustedHeightForTerrain: boolean;
    _cameraUnderground: boolean;
    _tweens: TweenCollection;

    _zoomFactor: number;
    _rotateFactor: number | undefined;
    _rotateRateRangeAdjustment: any;
   _maximumRotateRate : number;
   _minimumRotateRate : number;
   _minimumZoomRate: number;
   _maximumZoomRate: number; // distance from the Sun to Pluto in meters.
   _minimumUndergroundPickDistance : number;
   _maximumUndergroundPickDistance : number;

   constructor (scene: Scene) {
       // >>includeStart('debug', pragmas.debug);
       if (!defined(scene)) {
           throw new DeveloperError('scene is required.');
       }
       // >>includeEnd('debug');

       /**
         * If true, inputs are allowed conditionally with the flags enableTranslate, enableZoom,
         * enableRotate, enableTilt, and enableLook.  If false, all inputs are disabled.
         *
         * NOTE: This setting is for temporary use cases, such as camera flights and
         * drag-selection of regions (see Picking demo).  It is typically set to false at the
         * start of such events, and set true on completion.  To keep inputs disabled
         * past the end of camera flights, you must use the other booleans (enableTranslate,
         * enableZoom, enableRotate, enableTilt, and enableLook).
         * @type {Boolean}
         * @default true
         */
       this.enableInputs = true;
       /**
         * If true, allows the user to pan around the map.  If false, the camera stays locked at the current position.
         * This flag only applies in 2D and Columbus view modes.
         * @type {Boolean}
         * @default true
         */
       this.enableTranslate = true;
       /**
         * If true, allows the user to zoom in and out.  If false, the camera is locked to the current distance from the ellipsoid.
         * @type {Boolean}
         * @default true
         */
       this.enableZoom = true;
       /**
         * If true, allows the user to rotate the world which translates the user's position.
         * This flag only applies in 2D and 3D.
         * @type {Boolean}
         * @default true
         */
       this.enableRotate = true;
       /**
         * If true, allows the user to tilt the camera.  If false, the camera is locked to the current heading.
         * This flag only applies in 3D and Columbus view.
         * @type {Boolean}
         * @default true
         */
       this.enableTilt = true;
       /**
         * If true, allows the user to use free-look. If false, the camera view direction can only be changed through translating
         * or rotating. This flag only applies in 3D and Columbus view modes.
         * @type {Boolean}
         * @default true
         */
       this.enableLook = true;
       /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to spin because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.9
         */
       this.inertiaSpin = 0.9;
       /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to translate because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.9
         */
       this.inertiaTranslate = 0.9;
       /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to zoom because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.8
         */
       this.inertiaZoom = 0.8;
       /**
         * A parameter in the range <code>[0, 1)</code> used to limit the range
         * of various user inputs to a percentage of the window width/height per animation frame.
         * This helps keep the camera under control in low-frame-rate situations.
         * @type {Number}
         * @default 0.1
         */
       this.maximumMovementRatio = 0.1;
       /**
         * Sets the duration, in seconds, of the bounce back animations in 2D and Columbus view.
         * @type {Number}
         * @default 3.0
         */
       this.bounceAnimationTime = 3.0;
       /**
         * The minimum magnitude, in meters, of the camera position when zooming. Defaults to 1.0.
         * @type {Number}
         * @default 1.0
         */
       this.minimumZoomDistance = 1.0;
       /**
         * The maximum magnitude, in meters, of the camera position when zooming. Defaults to positive infinity.
         * @type {Number}
         * @default {@link Number.POSITIVE_INFINITY}
         */
       this.maximumZoomDistance = Number.POSITIVE_INFINITY;
       /**
         * The input that allows the user to pan around the map. This only applies in 2D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default {@link CameraEventType.LEFT_DRAG}
         */
       this.translateEventTypes = CameraEventType.LEFT_DRAG;
       /**
         * The input that allows the user to zoom in/out.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default [{@link CameraEventType.RIGHT_DRAG}, {@link CameraEventType.WHEEL}, {@link CameraEventType.PINCH}]
         */
       this.zoomEventTypes = [
           CameraEventType.RIGHT_DRAG,
           CameraEventType.WHEEL,
           CameraEventType.PINCH
       ];
       /**
         * The input that allows the user to rotate around the globe or another object. This only applies in 3D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default {@link CameraEventType.LEFT_DRAG}
         */
       this.rotateEventTypes = CameraEventType.LEFT_DRAG;
       /**
         * The input that allows the user to tilt in 3D and Columbus view or twist in 2D.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default [{@link CameraEventType.MIDDLE_DRAG}, {@link CameraEventType.PINCH}, {
         *     eventType : {@link CameraEventType.LEFT_DRAG},
         *     modifier : {@link KeyboardEventModifier.CTRL}
         * }, {
         *     eventType : {@link CameraEventType.RIGHT_DRAG},
         *     modifier : {@link KeyboardEventModifier.CTRL}
         * }]
         */
       this.tiltEventTypes = [
           CameraEventType.MIDDLE_DRAG,
           CameraEventType.PINCH,
           {
               eventType: CameraEventType.LEFT_DRAG,
               modifier: KeyboardEventModifier.CTRL
           },
           {
               eventType: CameraEventType.RIGHT_DRAG,
               modifier: KeyboardEventModifier.CTRL
           }
       ];
       /**
         * The input that allows the user to change the direction the camera is viewing. This only applies in 3D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default { eventType : {@link CameraEventType.LEFT_DRAG}, modifier : {@link KeyboardEventModifier.SHIFT} }
         */
       this.lookEventTypes = {
           eventType: CameraEventType.LEFT_DRAG,
           modifier: KeyboardEventModifier.SHIFT
       };
       /**
         * The minimum height the camera must be before picking the terrain instead of the ellipsoid.
         * @type {Number}
         * @default 150000.0
         */
       this.minimumPickingTerrainHeight = 150000.0;
       this._minimumPickingTerrainHeight = this.minimumPickingTerrainHeight;
       /**
         * The minimum height the camera must be before testing for collision with terrain.
         * @type {Number}
         * @default 15000.0
         */
       this.minimumCollisionTerrainHeight = 15000.0;
       this._minimumCollisionTerrainHeight = this.minimumCollisionTerrainHeight;
       /**
         * The minimum height the camera must be before switching from rotating a track ball to
         * free look when clicks originate on the sky or in space.
         * @type {Number}
         * @default 7500000.0
         */
       this.minimumTrackBallHeight = 7500000.0;
       this._minimumTrackBallHeight = this.minimumTrackBallHeight;
       /**
         * Enables or disables camera collision detection with terrain.
         * @type {Boolean}
         * @default true
         */
       this.enableCollisionDetection = true;

       this._scene = scene;
       this._globe = undefined;
       this._ellipsoid = undefined;

       this._aggregator = new CameraEventAggregator(scene.canvas);

       this._lastInertiaSpinMovement = undefined;
       this._lastInertiaZoomMovement = undefined;
       this._lastInertiaTranslateMovement = undefined;
       this._lastInertiaTiltMovement = undefined;

       // Zoom disables tilt, spin, and translate inertia
       // Tilt disables spin and translate inertia
       this._inertiaDisablers = {
           _lastInertiaZoomMovement: [
               '_lastInertiaSpinMovement',
               '_lastInertiaTranslateMovement',
               '_lastInertiaTiltMovement'
           ],
           _lastInertiaTiltMovement: [
               '_lastInertiaSpinMovement',
               '_lastInertiaTranslateMovement'
           ]
       };

       this._tweens = new TweenCollection();
       this._tween = undefined;

       this._horizontalRotationAxis = undefined;

       this._tiltCenterMousePosition = new Cartesian2(-1.0, -1.0);
       this._tiltCenter = new Cartesian3();
       this._rotateMousePosition = new Cartesian2(-1.0, -1.0);
       this._rotateStartPosition = new Cartesian3();
       this._strafeStartPosition = new Cartesian3();
       this._strafeMousePosition = new Cartesian2();
       this._strafeEndMousePosition = new Cartesian2();
       this._zoomMouseStart = new Cartesian2(-1.0, -1.0);
       this._zoomWorldPosition = new Cartesian3();
       this._useZoomWorldPosition = false;
       this._tiltCVOffMap = false;
       this._looking = false;
       this._rotating = false;
       this._strafing = false;
       this._zoomingOnVector = false;
       this._zoomingUnderground = false;
       this._rotatingZoom = false;
       this._adjustedHeightForTerrain = false;
       this._cameraUnderground = false;

       const projection = scene.mapProjection;
       this._maxCoord = projection.project(
           new Cartographic(Math.PI, CesiumMath.PI_OVER_TWO)
       );

       // Constants, Make any of these public?
       this._zoomFactor = 5.0;
       this._rotateFactor = undefined;
       this._rotateRateRangeAdjustment = undefined;
       this._maximumRotateRate = 1.77;
       this._minimumRotateRate = 1.0 / 5000.0;
       this._minimumZoomRate = 20.0;
       this._maximumZoomRate = 5906376272000.0; // distance from the Sun to Pluto in meters.
       this._minimumUndergroundPickDistance = 2000.0;
       this._maximumUndergroundPickDistance = 10000.0;
   }
}

export { ScreenSpaceCameraController };
