import { Cartesian2 } from '@/Core/Cartesian2';
import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { CesiumMatrix4 } from '@/Core/CesiumMatrix4';
import { CullingVolume } from '@/Core/CullingVolume';
import { defaultValue } from '@/Core/defaultValue';
import { defined } from '@/Core/defined';
import { DeveloperError } from '@/Core/DeveloperError';
import { GeographicProjection } from '@/Core/GeographicProjection';
import { PerspectiveOffCenterFrustum } from '@/Core/PerspectiveOffCenterFrustum';
import { Ray } from '@/Core/Ray';
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
    xOffset?: number;
    yOffset?: number;
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

    let right = camera._right;
    const rightChanged = !Cartesian3.equals(right, camera.right);
    if (rightChanged) {
        Cartesian3.normalize(camera.right, camera.right);
        right = Cartesian3.clone(camera.right, camera._right);
    }

    // const transformChanged = camera._transformChanged || camera._modeChanged;
    // camera._transformChanged = false;

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
        camera._fovRadius = camera.fovRadius;
        camera._fovy = MathUtils.degToRad(camera.fov);
        camera._near = camera.near;
        camera._far = camera.far;
        // camera._sseDenominator = 2.0 * Math.tan(0.5 * camera._fovy);

        if (camera.aspect <= 1) {
            camera._sseDenominator = 2.0 * Math.tan(0.5 * camera.fovRadius);
        } else {
            // const hFOV = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 180 / 2) * camera.aspect);
            camera._sseDenominator = 2.0 * Math.tan(0.5 * camera.fovRadius);
        }
    }
};

const scratchCartesian = new Vector3();
class PerspectiveFrustumCamera extends PerspectiveCamera {
    scene: Scene;
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
    _fovy?: number;
    _fovRadius?: number;
    transform: CesiumMatrix4;
    cesiumUp: Cartesian3;
    _cesiumUp: Cartesian3;
    _cesiumUpWC: Cartesian3;

    right: Cartesian3;
    _right: Cartesian3;
    _rightWC: Cartesian3;
    _offCenterFrustum: PerspectiveOffCenterFrustum;

    xOffset: number;
    _xOffset: number;

    yOffset: number;
    _yOffset: number;

    _aspectRatio?: number;

    constructor (scene: Scene, options: PerspectiveFrustumCameraParameters) {
        super(options.fov, options.aspect, options.near, options.far);
        this.scene = scene;

        this._offCenterFrustum = new PerspectiveOffCenterFrustum();

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

        this._aspectRatio = undefined;

        this._sseDenominator = 0.0;
        this._projection = scene.mapProjection;

        this.transform = CesiumMatrix4.clone(CesiumMatrix4.IDENTITY);

        /**
         * The up direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.cesiumUp = new Cartesian3();
        this._cesiumUp = new Cartesian3();
        this._cesiumUpWC = new Cartesian3();

        /**
         * The right direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.right = new Cartesian3();
        this._right = new Cartesian3();
        this._rightWC = new Cartesian3();

        /**
         * Offsets the frustum in the x direction.
         * @type {Number}
         * @default 0.0
         */
        this.xOffset = defaultValue(options.xOffset, 0.0) as number;
        this._xOffset = this.xOffset;

        /**
         * Offsets the frustum in the y direction.
         * @type {Number}
         * @default 0.0
         */
        this.yOffset = defaultValue(options.yOffset, 0.0) as number;
        this._yOffset = this.yOffset;
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

    get fovy (): number {
        update(this);
        return this._fovy as number;
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

    get aspectRatio (): number {
        return this.aspect;
    }

    set aspectRatio (value: number) {
        this.aspect = value;
    }

    resize (container: Element): void {
        const { clientWidth, clientHeight } = container;

        this.aspect = clientWidth / clientHeight;

        this.updateProjectionMatrix();

        this.containerWidth = clientWidth;
        this.containerHeight = clientHeight;
    }

    /**
     * Creates a culling volume for this frustum.
     *
     * @param {Cartesian3} position The eye position.
     * @param {Cartesian3} direction The view direction.
     * @param {Cartesian3} up The up direction.
     * @returns {CullingVolume} A culling volume at the given position and orientation.
     *
     * @example
     * // Check if a bounding volume intersects the frustum.
     * var cullingVolume = frustum.computeCullingVolume(cameraPosition, cameraDirection, cameraUp);
     * var intersect = cullingVolume.computeVisibility(boundingVolume);
     */
    computeCullingVolume (
        position: Cartesian3,
        direction: Cartesian3,
        up: Cartesian3
    ): CullingVolume {
        update(this);
        return this._offCenterFrustum.computeCullingVolume(position, direction, up);
    }
}

function update (frustum: PerspectiveFrustumCamera) {
    // >>includeStart('debug', pragmas.debug);
    if (
        !defined(frustum.fov) ||
      !defined(frustum.aspectRatio) ||
      !defined(frustum.near) ||
      !defined(frustum.far)
    ) {
        throw new DeveloperError(
            'fov, aspectRatio, near, or far parameters are not set.'
        );
    }
    // >>includeEnd('debug');

    const f = frustum._offCenterFrustum;

    if (
        frustum.fov !== frustum._fov ||
        frustum.aspectRatio !== frustum._aspectRatio ||
        frustum.near !== frustum._near ||
        frustum.far !== frustum._far
    ) {
        frustum._aspectRatio = frustum.aspectRatio;
        frustum._fov = frustum.fov;
        frustum._fovy = MathUtils.degToRad(frustum.fov);
        frustum.aspectRatio = frustum.aspect;

        frustum._near = frustum.near;
        frustum._far = frustum.far;
        frustum._sseDenominator = 2.0 * Math.tan(0.5 * frustum.fovRadius);

        frustum._xOffset = frustum.xOffset;
        frustum._yOffset = frustum.yOffset;

        f.top = frustum.near * Math.tan(0.5 * frustum._fovy);
        f.bottom = -f.top;
        f.right = frustum.aspectRatio * f.top;
        f.left = -f.right;
        f.near = frustum.near;
        f.far = frustum.far;

        f.right += frustum.xOffset;
        f.left += frustum.xOffset;
        f.top += frustum.yOffset;
        f.bottom += frustum.yOffset;
    }
}

export { PerspectiveFrustumCamera };
