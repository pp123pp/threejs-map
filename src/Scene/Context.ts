import { Cartesian2 } from '@/Core/Cartesian2';
import { DrawMeshCommand } from '@/Renderer/DrawMeshCommand';
import { ShaderCache } from '@/Renderer/ShaderCache';
import { ShaderProgram } from '@/Renderer/ShaderProgram';
import { UniformState } from '@/Renderer/UniformState';
import { RGBFormat, Texture, WebGLMultisampleRenderTarget } from 'three';
import { generateUUID } from 'three/src/math/MathUtils';
import { ContextLimits } from './ContextLimits';
import { Scene } from './Scene';

class Context {
    scene: Scene;
    logShaderCompilation = false
    public cache: {
        [name: string]: any
    } = {};

    protected _id = generateUUID();
    _gl: WebGLRenderingContext
    drawingBufferHeight = new Cartesian2();
    sceneFrameBuffer: WebGLMultisampleRenderTarget;
    _shaderCache = new ShaderCache(this)
    _us = new UniformState();
    constructor (scene: Scene) {
        this.scene = scene;

        const bufferSize = scene.drawingBufferSize;

        const sceneFrameBuffer = new WebGLMultisampleRenderTarget(bufferSize.width, bufferSize.height, {
            format: RGBFormat
        });

        this._gl = scene.renderer.getContext();

        this.sceneFrameBuffer = sceneFrameBuffer;

        ContextLimits._maxAnisotropy = scene.renderer.capabilities.getMaxAnisotropy();
        ContextLimits._maximumTextureImageUnits = scene.renderer.capabilities.maxTextures;
    }

    get uniformState (): UniformState {
        return this._us;
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

    get shaderCache (): ShaderCache {
        return this._shaderCache;
    }

    get webgl2 (): boolean {
        // return this.scene.renderer.capabilities.isWebGL2;
        return false;
    }

    get textureFloatLinear (): boolean {
        return true;
    }

    get floatingPointTexture (): boolean {
        return true;
    }

    get debugShaders (): any {
        return {};
    }

    draw (drawCommand: DrawMeshCommand): void {
        // beginDraw(this, drawCommand.shaderProgram as ShaderProgram);
        (drawCommand.shaderProgram as ShaderProgram)._bind();
    }
}

function beginDraw (
    context: Context,

    shaderProgram: ShaderProgram

) {
    // shaderProgram._bind();
    // context._maxFrameTextureUnitIndex = Math.max(
    //     context._maxFrameTextureUnitIndex,
    //     shaderProgram.maximumTextureUnitIndex
    // );
}
export { Context };
