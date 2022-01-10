
import { incrementWrap } from '../Core/CesiumMath';
import { defaultValue } from '../Core/defaultValue';
import { Event } from '../Core/Event';
import { SceneMode } from '../Core/SceneMode';
import * as THREE from 'three';
import { GLSL3, Mesh, Raycaster, ShaderMaterial, SphereBufferGeometry, Vector2, WebGLRenderer, WebGLRendererParameters } from 'three';
import { Camera } from './Camera';
// import { Camera } from './CameraCopy';
import { Context } from './Context';
import { FrameState, PassesInterface } from './FrameState';
import { MapRenderer, RenderStateParameters } from './MapRenderer';
import { Pass } from './../Renderer/Pass';
import { PerspectiveFrustumCamera } from './PerspectiveFrustumCamera';
import { CesiumColor } from '../Core/CesiumColor';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GeographicProjection } from '../Core/GeographicProjection';
import { Globe } from './Globe';
import { ComputeEngine } from '../Renderer/ComputeEngine';
import { ComputeCommand } from '../Renderer/ComputeCommand';
import { PrimitiveCollection } from './PrimitiveCollection';
import { defined } from '@/Core/defined';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { RenderCollection } from './RenderCollection';
import { RequestScheduler } from '@/Core/RequestScheduler';
import { ScreenSpaceCameraController } from './ScreenSpaceCameraController';
import { TweenCollection } from '@/Core/TweenCollection';
import { Cartesian2 } from '@/Core/Cartesian2';
import { Cartesian3 } from '@/Core/Cartesian3';
import { EffectComposerCollection } from './EffectComposerCollection';
import { PickDepth } from './PickDepth';
import { Picking } from './Picking';
import { SkyBox } from './SkyBox';

const raycaster = new Raycaster();
const mouse = new Vector2();

const pickEarth = new Mesh(new SphereBufferGeometry(6378137, 32, 32));

interface SceneOptions {
    renderState?: RenderStateParameters;
    enabledEffect?: false;
    requestRenderMode?: false;
    [name: string]: any
}

const requestRenderAfterFrame = function (scene: Scene) {
    return function () {
        scene.frameState.afterRender.push(function () {
            scene.requestRender();
        });
    };
};

function updateGlobeListeners (scene: Scene, globe: Globe) {
    for (let i = 0; i < scene._removeGlobeCallbacks.length; ++i) {
        scene._removeGlobeCallbacks[i]();
    }
    scene._removeGlobeCallbacks.length = 0;

    const removeGlobeCallbacks = [];
    if (defined(globe)) {
        removeGlobeCallbacks.push(
            globe.imageryLayersUpdatedEvent.addEventListener(
                requestRenderAfterFrame(scene)
            )
        );
        removeGlobeCallbacks.push(
            globe.terrainProviderChanged.addEventListener(
                requestRenderAfterFrame(scene)
            )
        );
    }
    scene._removeGlobeCallbacks = removeGlobeCallbacks;
}

function updateFrameNumber (scene: Scene, frameNumber: number) {
    const frameState = scene._frameState;
    frameState.frameNumber = frameNumber;
}

function tryAndCatchError (scene:Scene, functionToExecute: any) {
    try {
        functionToExecute(scene);
    } catch (error) {
        console.log(error);
        scene.renderError.raiseEvent(scene, error);

        if (scene.rethrowRenderErrors) {
            throw error;
        }
    }
}

function prePassesUpdate (scene:Scene) {
    // scene._jobScheduler.resetBudgets();

    const frameState = scene._frameState;
    // const primitives = scene.primitives;
    // primitives.prePassesUpdate(frameState);

    if (defined(scene.globe)) {
        scene.globe.update(frameState);
    }

    // scene._picking.update();
    // frameState.creditDisplay.update();
}

function postPassesUpdate (scene: Scene) {
    const frameState = scene._frameState;
    // const primitives = scene.primitives;
    // primitives.postPassesUpdate(frameState);

    RequestScheduler.update();
}

function render (scene:Scene) {
    const frameState = scene._frameState;

    const context = scene.context;

    scene.updateFrameState();

    frameState.passes.render = true;

    if (defined(scene.globe)) {
        scene.globe.beginFrame(frameState);

        if (!scene.globe.tilesLoaded) {
            scene._renderRequested = true;
        }
    }

    scene.updateAndExecuteCommands(scene.backgroundColor);

    if (defined(scene.globe)) {
        scene.globe.endFrame(frameState);

        if (!scene.globe.tilesLoaded) {
            scene._renderRequested = true;
        }
    }
}

function getGlobeHeight (scene: Scene) {
    const globe = scene._globe;
    const camera = scene.activeCamera;
    const cartographic = camera.positionCartographic;
    if (defined(globe) && globe?.visible && defined(cartographic)) {
        return globe.getHeight(cartographic);
    }
    return undefined;
}

function isCameraUnderground (scene: Scene) {
    const camera = scene.activeCamera;
    const mode = scene.mode;
    const globe = scene.globe;
    const cameraController = scene.screenSpaceCameraController;
    const cartographic = camera.positionCartographic;

    if (!defined(cartographic)) {
        return false;
    }

    if (!cameraController.onMap() && cartographic.height < 0.0) {
        // The camera can go off the map while in Columbus View.
        // Make a best guess as to whether it's underground by checking if its height is less than zero.
        return true;
    }

    if (
        !defined(globe) ||
      !globe.visible ||
      mode === SceneMode.SCENE2D ||
      mode === SceneMode.MORPHING
    ) {
        return false;
    }

    const globeHeight = scene._globeHeight as number;
    return defined(globeHeight) && cartographic.height < globeHeight;
}

function updateAndRenderPrimitives (scene: Scene) {
    const frameState = scene._frameState;

    // scene._groundPrimitives.update(frameState);
    scene._primitives.update(frameState);

    // updateDebugFrustumPlanes(scene);
    // updateShadowMaps(scene);

    if (scene._globe) {
        scene._globe.render(frameState);
    }

    for (const command of frameState.commandList) {
        scene._renderCollection.add(command);
    }
}

const executeComputeCommands = (scene: Scene) => {
    const commandList = scene.frameState.computeCommandList;
    const length = commandList.length;
    for (let i = 0; i < length; ++i) {
        commandList[i].execute(scene._computeEngine);
    }
};

/**
 * 执行渲染
 * @param firstViewport
 * @param scene
 * @param backgroundColor
 */
function executeCommandsInViewport (firstViewport: boolean, scene:Scene, backgroundColor: CesiumColor) {
    // const environmentState = scene._environmentState;
    // const view = scene._view;
    // const renderTranslucentDepthForPick =
    //   environmentState.renderTranslucentDepthForPick;

    // if (!firstViewport && !renderTranslucentDepthForPick) {
    //     scene.frameState.commandList.length = 0;
    // }

    // if (!renderTranslucentDepthForPick) {
    //     updateAndRenderPrimitives(scene);
    // }

    // view.createPotentiallyVisibleSet(scene);

    // if (firstViewport) {
    //     if (defined(backgroundColor)) {
    //         updateAndClearFramebuffers(scene, passState, backgroundColor);
    //     }
    //     if (!renderTranslucentDepthForPick) {
    //         executeComputeCommands(scene);
    //         executeShadowMapCastCommands(scene);
    //     }
    // }

    if (firstViewport) {
        executeComputeCommands(scene);
    }

    if (!firstViewport) {
        scene.frameState.commandList.length = 0;
    }

    updateAndRenderPrimitives(scene);

    // executeCommands(scene, passState);
    // scene.renderer.clear();
    // scene.renderer.render(scene, scene.activeCamera);
    scene.renderer.autoClear = false;
    scene.renderer.clear();
    scene.skyBox.render();
    scene.effectComposerCollection.render();
}

class Scene extends THREE.Scene {
    _primitives: PrimitiveCollection
    readonly renderer: MapRenderer;
    _frameState: FrameState;
    _renderRequested: boolean;
    protected _shaderFrameCount: number;
    protected _context: Context;
    protected _mode: SceneMode;
    readonly _camera: Camera;
    requestRenderMode: boolean;
    readonly renderError: Event;
    readonly postUpdate: Event;
    readonly preRender: Event;
    readonly rethrowRenderErrors: boolean;
    backgroundColor: CesiumColor;
    readonly _screenSpaceCameraController: any;
    _mapProjection: GeographicProjection;
    _canvas: HTMLCanvasElement;
    _globe: Globe | undefined;
    _computeEngine: ComputeEngine;
    _removeGlobeCallbacks: any[];
    _renderCollection: RenderCollection;
    maximumRenderTimeChange: number;
    _lastRenderTime: any;
    _frameRateMonitor: any;
    _removeRequestListenerCallback: any;
    _globeHeight?: number;
    _cameraUnderground: boolean;
    _tweens: TweenCollection;
    effectComposerCollection: EffectComposerCollection;
    _picking: Picking;
    useDepthPicking: boolean;
    skyBox: SkyBox
    constructor (options: SceneOptions) {
        super();

        this._mode = SceneMode.SCENE3D;

        ShaderMaterial.prototype.glslVersion = GLSL3;

        // 地图的投影方式
        this._mapProjection = defaultValue(options.mapProjection, new GeographicProjection()) as GeographicProjection;

        this._primitives = new PrimitiveCollection();

        this.renderError = new Event();
        this.postUpdate = new Event();
        this.preRender = new Event();

        this.renderer = new MapRenderer(options.renderState);

        this._camera = new Camera(this, {
            aspect: this.drawingBufferSize.width / this.drawingBufferSize.height,
            near: 0.1,
            far: 100000000
        });

        this._camera.constrainedAxis = Cartesian3.UNIT_Z;

        // this.activeCamera.position.set(10, 10, 10);
        // this.activeCamera.lookAt(0, 0, 0);

        /**
         * When <code>true</code>, rendering a frame will only occur when needed as determined by changes within the scene.
         * Enabling improves performance of the application, but requires using {@link Scene#requestRender}
         * to render a new frame explicitly in this mode. This will be necessary in many cases after making changes
         * to the scene in other parts of the API.
         *
         * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
         * @see Scene#maximumRenderTimeChange
         * @see Scene#requestRender
         *
         * @type {Boolean}
         * @default false
         */
        this.requestRenderMode = defaultValue(options.requestRenderMode, false) as boolean;
        this._renderRequested = true;
        this._shaderFrameCount = 0;

        /**
         * If {@link Scene#requestRenderMode} is <code>true</code>, this value defines the maximum change in
         * simulation time allowed before a render is requested. Lower values increase the number of frames rendered
         * and higher values decrease the number of frames rendered. If <code>undefined</code>, changes to
         * the simulation time will never request a render.
         * This value impacts the rate of rendering for changes in the scene like lighting, entity property updates,
         * and animations.
         *
         * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
         * @see Scene#requestRenderMode
         *
         * @type {Number}
         * @default 0.0
         */
        this.maximumRenderTimeChange = defaultValue(
            options.maximumRenderTimeChange,
            0.0
        );
        this._lastRenderTime = undefined;
        this._frameRateMonitor = undefined;

        this._removeRequestListenerCallback = RequestScheduler.requestCompletedEvent.addEventListener(
            requestRenderAfterFrame(this)
        );
        // this._removeTaskProcessorListenerCallback = TaskProcessor.taskCompletedEvent.addEventListener(
        //     requestRenderAfterFrame(this)
        // );
        this._removeGlobeCallbacks = [];

        this._canvas = this.renderer.domElement as HTMLCanvasElement;
        this._context = new Context(this);
        this.renderer.setRenderTarget(this._context.sceneFrameBuffer);
        this._computeEngine = new ComputeEngine(this, this._context);

        this._globeHeight = undefined;
        this._cameraUnderground = false;

        this._frameState = new FrameState(this);
        this._removeGlobeCallbacks = [];

        /**
         * Exceptions occurring in <code>render</code> are always caught in order to raise the
         * <code>renderError</code> event.  If this property is true, the error is rethrown
         * after the event is raised.  If this property is false, the <code>render</code> function
         * returns normally after raising the event.
         *
         * @type {Boolean}
         * @default false
         */
        this.rethrowRenderErrors = false;

        this.backgroundColor = new CesiumColor(1.0, 0.0, 0.0, 1.0);

        // this._computeCommandList = [];

        this._renderCollection = new RenderCollection();

        this.addObject(this._renderCollection);

        this._tweens = new TweenCollection();

        // this._screenSpaceCameraController = new OrbitControls(this.activeCamera, this.renderer.domElement);
        this._screenSpaceCameraController = new ScreenSpaceCameraController(this);

        this.effectComposerCollection = new EffectComposerCollection(this);

        this._picking = new Picking(this);

        // 是否启用深度坐标拾取
        this.useDepthPicking = true;

        this.skyBox = new SkyBox(this);
    }

    get pixelRatio (): number {
        return this._frameState.pixelRatio;
    }

    set pixelRatio (value: number) {
        this._frameState.pixelRatio = value;
    }

    get mode (): number {
        return this._mode;
    }

    get context (): Context {
        return this._context;
    }

    get camera (): Camera {
        return this._camera;
    }

    get activeCamera (): PerspectiveFrustumCamera {
        return this._camera.frustum;
        // return this.camera.activeCamera;
    }

    get frameState ():FrameState {
        return this._frameState;
    }

    get mapProjection (): GeographicProjection {
        return this._mapProjection;
    }

    get canvas (): HTMLCanvasElement {
        return this._canvas;
    }

    get globe (): Globe {
        return this._globe as Globe;
    }

    set globe (globe: Globe) {
        this._globe = globe;

        updateGlobeListeners(this, globe);
    }

    get drawingBufferSize (): Vector2 {
        return this.renderer.drawingBufferSize;
    }

    get drawingBufferWidth (): number {
        return this.drawingBufferSize.width;
    }

    get drawingBufferHeight (): number {
        return this.drawingBufferSize.height;
    }

    get imageryLayers ():ImageryLayerCollection {
        return this.globe.imageryLayers;
    }

    get cameraUnderground () : boolean {
        return this._cameraUnderground;
    }

    get screenSpaceCameraController (): ScreenSpaceCameraController {
        return this._screenSpaceCameraController;
    }

    get tweens (): TweenCollection {
        return this._tweens;
    }

    get pickPositionSupported (): boolean {
        return true;
    }

    get globeHeight (): number {
        return (this._globeHeight as number);
    }

    requestRender () :void{
        this._renderRequested = true;
    }

    setSize (container: Element): void {
        this.camera.resize(container);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.effectComposerCollection.setSize(container);
    }

    clearPasses (passes: PassesInterface): void {
        passes.render = false;
        passes.pick = false;
        passes.depth = false;
        passes.postProcess = false;
        passes.offscreen = false;
    }

    initializeFrame ():void {
        if (this._shaderFrameCount++ === 120) {
            this._shaderFrameCount = 0;
        }
        this._tweens.update();

        // this.camera.update(this._mode);

        // this._globeHeight = getGlobeHeight(this);
        // this._cameraUnderground = isCameraUnderground(this);

        this._screenSpaceCameraController.update();
        this.camera.update(this._mode);
        this.camera._updateCameraChanged();
    }

    render (time: number): void{
        const frameState = this._frameState;
        frameState.newFrame = false;

        const cameraChanged = true;

        const shouldRender =
        !this.requestRenderMode ||
        this._renderRequested ||
        cameraChanged ||
        // this._logDepthBufferDirty ||
        // this._hdrDirty ||
            this.mode === SceneMode.MORPHING;

        if (shouldRender) {
            this._renderRequested = false;

            const frameNumber = incrementWrap(
                frameState.frameNumber,
                15000000.0,
                1.0
            );
            updateFrameNumber(this, frameNumber);
            frameState.newFrame = true;
        }

        tryAndCatchError(this, prePassesUpdate);

        /**
         *
         * Passes update. Add any passes here
         *
         */
        // if (this.primitives.show) {
        //     tryAndCatchError(this, updateMostDetailedRayPicks);
        //     tryAndCatchError(this, updatePreloadPass);
        //     tryAndCatchError(this, updatePreloadFlightPass);
        //     if (!shouldRender) {
        //         tryAndCatchError(this, updateRequestRenderModeDeferCheckPass);
        //     }
        // }

        this.postUpdate.raiseEvent(this, time);

        if (shouldRender) {
            this.preRender.raiseEvent(this, time);
            // frameState.creditDisplay.beginFrame();
            tryAndCatchError(this, render);
        }

        tryAndCatchError(this, postPassesUpdate);
    }

    updateFrameState (): void {
        const camera = this.camera;

        const frameState = this._frameState;
        frameState.commandList.length = 0;
        frameState.computeCommandList.length = 0;
        frameState.shadowMaps.length = 0;
        frameState.mapProjection = this.mapProjection;
        frameState.mode = this._mode;
        frameState.cameraUnderground = this._cameraUnderground;
        this._renderCollection.children = [];
        frameState.cullingVolume = camera.frustum.computeCullingVolume(
            camera.positionWC,
            camera.directionWC,
            camera.upWC
        );

        this.clearPasses(frameState.passes);
    }

    updateAndExecuteCommands (backgroundColor:CesiumColor): void {
        const frameState = this._frameState;
        const mode = frameState.mode;

        executeCommandsInViewport(true, this, backgroundColor);
    }

    /**
     * Returns the cartesian position reconstructed from the depth buffer and window position.
     * The returned position is in world coordinates. Used internally by camera functions to
     * prevent conversion to projected 2D coordinates and then back.
     * <p>
     * Set {@link Scene#pickTranslucentDepth} to <code>true</code> to include the depth of
     * translucent primitives; otherwise, this essentially picks through translucent primitives.
     * </p>
     *
     * @private
     *
     * @param {Cartesian2} windowPosition Window coordinates to perform picking on.
     * @param {Cartesian3} [result] The object on which to restore the result.
     * @returns {Cartesian3} The cartesian position in world coordinates.
     *
     * @exception {DeveloperError} Picking from the depth buffer is not supported. Check pickPositionSupported.
     */
    pickPositionWorldCoordinates (windowPosition: Cartesian2, result?: Cartesian3): Cartesian3 | undefined {
        // return this._picking.pickPositionWorldCoordinates(
        //     windowPosition,
        //     result
        // );

        return this.camera.pickEllipsoid(windowPosition, undefined, result);
    }
}

export { Scene };
