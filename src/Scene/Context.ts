import { Cartesian2 } from '@/Core/Cartesian2';
import { FloatType, NearestFilter, Texture, WebGLMultipleRenderTargets } from 'three';
import { generateUUID } from 'three/src/math/MathUtils';
import { Scene } from './Scene';

class Context {
    scene: Scene;
    public cache: any;
    protected _id: string;
    drawingBufferHeight: Cartesian2;
    sceneFrameBuffer: WebGLMultipleRenderTargets;
    constructor (scene: Scene) {
        this.scene = scene;

        this.cache = {};

        this._id = generateUUID();

        this.drawingBufferHeight = new Cartesian2();

        // this.webglMultipleRenderTarget = new WebGLMultipleRenderTargets

        const bufferSize = scene.drawingBufferSize;

        // 保存场景的渲染结果，这里输出三和buffer，color, depth, normal
        const sceneFrameBuffer = new WebGLMultipleRenderTargets(bufferSize.width, bufferSize.height, 3);

        for (let i = 0, il = sceneFrameBuffer.texture.length; i < il; i++) {
            sceneFrameBuffer.texture[i].minFilter = NearestFilter;
            sceneFrameBuffer.texture[i].magFilter = NearestFilter;
            sceneFrameBuffer.texture[i].type = FloatType;
        }

        sceneFrameBuffer.texture[0].name = 'color';
        sceneFrameBuffer.texture[1].name = 'depth';
        sceneFrameBuffer.texture[2].name = 'normal';

        this.sceneFrameBuffer = sceneFrameBuffer;
    }

    get id (): string {
        return this._id;
    }

    get colorTexture (): Texture {
        return this.sceneFrameBuffer.texture[0];
    }

    get depthTexture (): Texture {
        return this.sceneFrameBuffer.texture[1];
    }

    get normalTexture (): Texture {
        return this.sceneFrameBuffer.texture[2];
    }
}

export { Context };
