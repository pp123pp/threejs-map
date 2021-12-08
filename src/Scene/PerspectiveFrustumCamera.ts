import { Frustum, Matrix4, PerspectiveCamera } from 'three';
import { Scene } from './Scene';

export interface PerspectiveFrustumCameraParameters {
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
}

class PerspectiveFrustumCamera extends PerspectiveCamera {
    protected scene: Scene;
    private _frustum;
    private _projScreenMatrix: Matrix4;
    public containerWidth: number;
    public containerHeight: number
    constructor (scene: Scene, options: PerspectiveFrustumCameraParameters) {
        super(options.fov, options.aspect, options.near, options.far);
        this.scene = scene;

        this._frustum = new Frustum();
        this._projScreenMatrix = new Matrix4();

        this.containerWidth = 0;
        this.containerHeight = 0;
    }

    get frustum (): Frustum {
        this.updateProjectionMatrix();
        this._projScreenMatrix.multiplyMatrices(this.projectionMatrix, this.matrixWorldInverse);
        this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

        return this._frustum;
    }

    resize (container: Element): void {
        const { clientWidth, clientHeight } = container;

        this.aspect = clientWidth / clientHeight;

        this.updateProjectionMatrix();

        this.containerWidth = clientWidth;
        this.containerHeight = clientHeight;
    }
}

export { PerspectiveFrustumCamera };
