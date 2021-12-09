import { CullingVolume } from '@/Core/CullingVolume';
import { Frustum } from 'three';
import { OrthographicFrustumCameraParameters } from './OrthographicFrustumCamera';
import { PerspectiveFrustumCamera, PerspectiveFrustumCameraParameters } from './PerspectiveFrustumCamera';
import { Scene } from './Scene';

class Camera {
    readonly activeCamera: PerspectiveFrustumCamera;
    constructor (scene: Scene, options: PerspectiveFrustumCameraParameters | OrthographicFrustumCameraParameters) {
        // 默认使用透视相机
        this.activeCamera = new PerspectiveFrustumCamera(scene, options);

        // this.cullingVolume = new CullingVolume();
    }

    get frustum (): Frustum {
        return this.activeCamera.frustum;
    }

    // computeCullingVolume () {

    // }

    resize (container: Element): void {
        this.activeCamera.resize(container);
    }

    update (mode: number): void {
        return undefined;
    }
}
export { Camera };
