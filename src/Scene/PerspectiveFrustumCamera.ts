import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { GeographicProjection } from '@/Core/GeographicProjection';
import { SceneMode } from '@/Core/SceneMode';
import { Frustum, MathUtils, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { Scene } from './Scene';

const worldDirectionCartesian = new Cartesian3();

const worldDirection = new Vector3();

export interface PerspectiveFrustumCameraParameters {
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
}

const updateMembers = function (camera: PerspectiveFrustumCamera) {
    const mode = camera._mode;

    const heightChanged = false;
    const height = 0.0;
    if (mode === SceneMode.SCENE2D) {
        // height = camera.frustum.right - camera.frustum.left;
        // heightChanged = height !== camera._positionCartographic.height;
    }

    let position = camera.positionCartesian3;
    const positionChanged =
      !Cartesian3.equals(position, camera.position) || heightChanged;
    if (positionChanged) {
        position = Cartesian3.clone(camera.position, camera.positionCartesian3) as Cartesian3;
    }

    if (mode === SceneMode.SCENE3D || mode === SceneMode.MORPHING) {
        camera._positionCartographic = camera._projection.ellipsoid.cartesianToCartographic(
            camera.positionCartesian3,
            camera._positionCartographic
        ) as Cartographic;
    }

    if (
        camera.fov !== camera._fov ||
        camera.aspect !== camera._aspect ||
        camera.near !== camera._near ||
        camera.far !== camera._far
    ) {
        camera._aspect = camera.aspect;
        camera._fov = camera.fov;
        camera._fovy =
        camera.aspect <= 1
            ? camera.fov
            : Math.atan(Math.tan(camera.fov * 0.5) / camera.aspect) * 2.0;
        camera._near = camera.near;
        camera._far = camera.far;
        camera._sseDenominator = 2.0 * Math.tan(0.5 * camera._fovy);
    }
};

const scratchCartesian = new Vector3();
class PerspectiveFrustumCamera extends PerspectiveCamera {
    protected scene: Scene;
    private _frustum;
    private _projScreenMatrix: Matrix4;
    public containerWidth: number;
    public containerHeight: number
    _sseDenominator: number;
    positionCartesian3: Cartesian3;
    _positionCartographic: Cartographic;
    _mode: SceneMode;
    _fov: number;
    _aspect: number;
    _near: number;
    _far: number;
    _projection: GeographicProjection;
    _fovy?: number
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

        this.positionCartesian3 = new Cartesian3();
        this._mode = scene.mode;

        this._fov = this.fov;
        this._aspect = this.aspect;

        this._near = this.near;
        this._far = this.far;

        this._sseDenominator = 0.0;
        this._projection = scene.mapProjection;
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

    get positionWC ():Cartesian3 {
        // this._positionWC.x = this.position.z;
        // this._positionWC.y = this.position.x;
        // this._positionWC.z = this.position.y;

        this.positionCartesian3.x = this.position.x;
        this.positionCartesian3.y = this.position.y;
        this.positionCartesian3.z = this.position.z;

        return this.positionCartesian3;
    }

    get positionCartographic ():Cartographic {
        const positionENU = scratchCartesian;
        // positionENU.x = this.positionWC.y;
        // positionENU.y = this.positionWC.z;
        // positionENU.z = this.positionWC.x;

        positionENU.x = this.position.x;
        positionENU.y = this.position.y;
        positionENU.z = this.position.z;

        updateMembers(this);

        return this._positionCartographic;
    }

    get fovRadius (): number {
        return MathUtils.degToRad(this.fov);
    }

    get sseDenominator (): number {
        updateMembers(this);
        return this._sseDenominator;
        // this.updateProjectionMatrix();
        // return 2.0 * Math.tan(0.5 * this.fov * THREE.MathUtils.DEG2RAD) / this._scene.drawingBufferSize.height;
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
