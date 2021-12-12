import { Scene } from './Scene';
import { SceneMode } from '@/Core/SceneMode';
import { Camera } from './Camera';
import { CullingVolume } from '@/Core/CullingVolume';
import { Frustum } from 'three';
import { Context } from './Context';
import { PerspectiveFrustumCamera } from './PerspectiveFrustumCamera';

export interface PassesInterface{
    render: boolean,
    pick: boolean,
    depth: boolean,
    postProcess: boolean,
    offscreen: boolean
}

class FrameState {
    scene: Scene;
    context: Context;
    pixelRatio: number;
    frameNumber: number;
    mode: number
    newFrame: boolean;
    passes: PassesInterface;
    readonly commandList: any[];
    readonly shadowMaps: any[];
    cullingVolume: CullingVolume;
    maximumScreenSpaceError: number;
    afterRender: Array<() => void>;
    mapProjection: any;
    terrainExaggerationRelativeHeight: number
    terrainExaggeration: number;
    minimumTerrainHeight: number;
    constructor (scene: Scene) {
        this.scene = scene;

        this.context = scene.context;

        /**
         * <code>true</code> if a new frame has been issued and the frame number has been updated.
         *
         * @type {Boolean}
         * @default false
         */
        this.newFrame = false;

        /**
         * The current frame number.
         *
         * @type {Number}
         * @default 0
         */
        this.frameNumber = 0.0;

        this.pixelRatio = 1.0;

        /**
         * The current mode of the scene.
         *
         * @type {SceneMode}
         * @default {@link SceneMode.SCENE3D}
         */
        this.mode = SceneMode.SCENE3D;

        /**
         * @typedef FrameState.Passes
         * @type {Object}
         * @property {Boolean} render <code>true</code> if the primitive should update for a render pass, <code>false</code> otherwise.
         * @property {Boolean} pick <code>true</code> if the primitive should update for a picking pass, <code>false</code> otherwise.
         * @property {Boolean} depth <code>true</code> if the primitive should update for a depth only pass, <code>false</code> otherwise.
         * @property {Boolean} postProcess <code>true</code> if the primitive should update for a per-feature post-process pass, <code>false</code> otherwise.
         * @property {Boolean} offscreen <code>true</code> if the primitive should update for an offscreen pass, <code>false</code> otherwise.
         */

        /**
         * @type {FrameState.Passes}
         */
        this.passes = {
            /**
             * @default false
             */
            render: false,
            /**
             * @default false
             */
            pick: false,
            /**
             * @default false
             */
            depth: false,
            /**
             * @default false
             */
            postProcess: false,
            /**
             * @default false
             */
            offscreen: false
        };

        this.commandList = [];
        this.shadowMaps = [];
        // this.camera = scene.camera;

        this.cullingVolume = new CullingVolume();

        this.maximumScreenSpaceError = 2.0;

        this.mapProjection = undefined;

        /**
         * An array of functions to be called at the end of the frame.  This array
         * will be cleared after each frame.
         * <p>
         * This allows queueing up events in <code>update</code> functions and
         * firing them at a time when the subscribers are free to change the
         * scene state, e.g., manipulate the camera, instead of firing events
         * directly in <code>update</code> functions.
         * </p>
         *
         * @type {FrameState.AfterRenderCallback[]}
         *
         * @example
         * frameState.afterRender.push(function() {
         *   // take some action, raise an event, etc.
         * });
         */
        this.afterRender = [];

        /**
         * A scalar used to exaggerate the terrain.
         * @type {Number}
         * @default 1.0
         */
        this.terrainExaggeration = 1.0;

        /**
         * The height relative to which terrain is exaggerated.
         * @type {Number}
         * @default 0.0
         */
        this.terrainExaggerationRelativeHeight = 0.0;

        /**
         * The minimum terrain height out of all rendered terrain tiles. Used to improve culling for objects underneath the ellipsoid but above terrain.
         *
         * @type {Number}
         * @default 0.0
         */
        this.minimumTerrainHeight = 0.0;
    }

    get camera (): PerspectiveFrustumCamera {
        return this.scene.activeCamera;
    }
}

export { FrameState };
