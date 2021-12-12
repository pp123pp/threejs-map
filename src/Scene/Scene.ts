
import { incrementWrap } from '@/Core/CesiumMath';
import { defaultValue } from '@/Core/defaultValue';
import { Event } from '@/Core/Event';
import { SceneMode } from '@/Core/SceneMode';
import * as THREE from 'three';
import { Vector2, WebGLRenderer, WebGLRendererParameters } from 'three';
import { Camera } from './Camera';
import { Context } from './Context';
import { FrameState, PassesInterface } from './FrameState';
import { MapRenderer, RenderStateParameters } from './MapRenderer';
import { Pass } from './../Renderer/Pass';
import { PerspectiveFrustumCamera } from './PerspectiveFrustumCamera';
import { CesiumColor } from '@/Core/CesiumColor';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GeographicProjection } from '@/Core/GeographicProjection';
import { Globe } from './Globe';
import { ComputeEngine } from '../Renderer/ComputeEngine';
import { defined } from '@/Core/defined';
import { ComputeCommand } from '@/Renderer/ComputeCommand';
import { PrimitiveCollection } from './PrimitiveCollection';

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

function updateAndRenderPrimitives (scene: Scene) {
    const frameState = scene._frameState;

    // scene._groundPrimitives.update(frameState);
    scene._primitives.update(frameState);

    // updateDebugFrustumPlanes(scene);
    // updateShadowMaps(scene);

    if (scene._globe) {
        scene._globe.render(frameState);
    }
}

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

    if (!firstViewport) {
        scene.frameState.commandList.length = 0;
    }

    updateAndRenderPrimitives(scene);

    // executeCommands(scene, passState);
    scene.renderer.clear();
    scene.renderer.render(scene, scene.activeCamera);
}

class Scene extends THREE.Scene {
    _primitives: PrimitiveCollection
    readonly renderer: MapRenderer;
    _frameState: FrameState;
    _renderRequested: boolean;
    protected _shaderFrameCount: number;
    protected _context: Context;
    protected _mode: number;
    readonly _camera: Camera;
    requestRenderMode: boolean;
    readonly renderError: Event;
    readonly postUpdate: Event;
    readonly preRender: Event;
    readonly rethrowRenderErrors: boolean;
    backgroundColor: CesiumColor;
    readonly screenSpaceCameraController: OrbitControls;
    _mapProjection: GeographicProjection;
    _canvas: HTMLCanvasElement;
    _globe: Globe | undefined;
    _computeEngine: ComputeEngine;
    _removeGlobeCallbacks: any[];
    _computeCommandList: ComputeCommand[];
    constructor (options: SceneOptions) {
        super();

        this._primitives = new PrimitiveCollection();

        this.renderError = new Event();
        this.postUpdate = new Event();
        this.preRender = new Event();

        this._camera = new Camera(this, {
            near: 0.1,
            far: 100000000
        });

        this.activeCamera.position.set(10, 10, 10);
        this.activeCamera.lookAt(0, 0, 0);

        this.renderer = new MapRenderer(options.renderState);

        this._frameState = new FrameState(this);

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
        this._mode = SceneMode.SCENE3D;

        // 地图的投影方式
        this._mapProjection = defaultValue(options.mapProjection, new GeographicProjection()) as GeographicProjection;

        this._canvas = options.canvas as HTMLCanvasElement;
        this._context = new Context(this);
        this._computeEngine = new ComputeEngine(this, this._context);

        this.screenSpaceCameraController = new OrbitControls(this.activeCamera, this.renderer.domElement);

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

        this._computeCommandList = [];
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
        return this._camera.activeCamera;
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

    requestRender () :void{
        this._renderRequested = true;
    }

    setSize (container: Element): void {
        this.camera.resize(container);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
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
        this.camera.update(this._mode);
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
    }

    updateFrameState (): void {
        const camera = this.camera;

        const frameState = this._frameState;
        frameState.commandList.length = 0;
        frameState.shadowMaps.length = 0;

        frameState.mode = this._mode;

        // frameState.cullingVolume = camera.computeCullingVolume();

        this.clearPasses(frameState.passes);
    }

    updateAndExecuteCommands (backgroundColor:CesiumColor): void {
        const frameState = this._frameState;
        const mode = frameState.mode;

        executeCommandsInViewport(true, this, backgroundColor);
    }
}

export { Scene };
