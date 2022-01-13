import { Cartesian2 } from '@/Core/Cartesian2';
import { RGBFormat, Texture, WebGLMultisampleRenderTarget } from 'three';
import { generateUUID } from 'three/src/math/MathUtils';
import { ContextLimits } from './ContextLimits';
import { Scene } from './Scene';

class Context {
    scene: Scene;
    public cache: any;
    protected _id: string;
    drawingBufferHeight: Cartesian2;
    sceneFrameBuffer: WebGLMultisampleRenderTarget;
    constructor (scene: Scene) {
        this.scene = scene;

        this.cache = {};

        this._id = generateUUID();

        this.drawingBufferHeight = new Cartesian2();

        const bufferSize = scene.drawingBufferSize;

        const sceneFrameBuffer = new WebGLMultisampleRenderTarget(bufferSize.width, bufferSize.height, {
            format: RGBFormat
        });

        this.sceneFrameBuffer = sceneFrameBuffer;

        ContextLimits._maxAnisotropy = scene.renderer.capabilities.getMaxAnisotropy();
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
