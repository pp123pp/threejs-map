import { Scene } from './Scene';
import { SceneMode } from '@/Core/SceneMode';
import { Camera } from './Camera';
import { CullingVolume } from '@/Core/CullingVolume';
import { Frustum } from 'three';

export interface PassesInterface{
    render: boolean,
    pick: boolean,
    depth: boolean,
    postProcess: boolean,
    offscreen: boolean
}

class FrameState {
    protected scene: Scene;
    pixelRatio: number;
    frameNumber: number;
    mode: number
    newFrame: boolean;
    passes: PassesInterface;
    readonly commandList: any[];
    readonly shadowMaps: any[];
    camera: Camera;
    cullingVolume: CullingVolume;
    maximumScreenSpaceError: number
    constructor (scene: Scene) {
        this.scene = scene;

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
        this.camera = scene.camera;

        this.cullingVolume = new CullingVolume();

        this.maximumScreenSpaceError = 2.0;
    }
}

export { FrameState };
