import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { Frustum, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { Scene } from './Scene';

const worldDirectionCartesian = new Cartesian3();

const worldDirection = new Vector3();

export interface PerspectiveFrustumCameraParameters {
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
}

const scratchCartesian = new Vector3();
class PerspectiveFrustumCamera extends PerspectiveCamera {
    protected scene: Scene;
    private _frustum;
    private _projScreenMatrix: Matrix4;
    public containerWidth: number;
    public containerHeight: number
    sseDenominator: number;
    _positionWC: Vector3;
    _positionCartographic: Cartographic;
    constructor (scene: Scene, options: PerspectiveFrustumCameraParameters) {
        super(options.fov, options.aspect, options.near, options.far);
        this.scene = scene;

        this._frustum = new Frustum();
        this._projScreenMatrix = new Matrix4();

        this.containerWidth = 0;
        this.containerHeight = 0;

        this.up.set(0, 0, 1);

        // 使用经纬度表示的坐标
        this._positionCartographic = new Cartographic();

        this._positionWC = new Vector3();
        this.sseDenominator = 0;
    }

    get directionWC (): Cartesian3 {
        this.getWorldDirection(worldDirection);
        worldDirectionCartesian.x = worldDirection.x;
        worldDirectionCartesian.y = worldDirection.y;
        worldDirectionCartesian.z = worldDirection.z;
        return worldDirectionCartesian;
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

    get positionWC () {
        this._positionWC.x = this.position.z;
        this._positionWC.y = this.position.x;
        this._positionWC.z = this.position.y;

        // this._positionWC.x = this.position.x;
        // this._positionWC.y = this.position.y;
        // this._positionWC.z = this.position.z;

        return this._positionWC;
    }

    get positionCartographic () {
        const positionENU = scratchCartesian;
        // positionENU.x = this.positionWC.y;
        // positionENU.y = this.positionWC.z;
        // positionENU.z = this.positionWC.x;

        positionENU.x = this.position.x;
        positionENU.y = this.position.y;
        positionENU.z = this.position.z;

        return this.scene.mapProjection.unproject(positionENU, this._positionCartographic);
    }
}

export { PerspectiveFrustumCamera };
