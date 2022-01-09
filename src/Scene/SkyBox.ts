
import { cube } from '@/Shader/CubeGlsl3Shader';
import { BackSide, BoxGeometry, cloneUniforms, CubeTexture, CubeTextureLoader, GLSL3, Mesh, ShaderLib, ShaderMaterial, sRGBEncoding, TextureLoader } from 'three';
import { Scene } from './Scene';
import * as THREE from 'three';

ShaderLib.cube = cube;
class SkyBox {
    scene: Scene;
    textureCube: CubeTexture;
    renderScene: THREE.Scene
    constructor (scene: Scene) {
        const loader = new CubeTextureLoader();
        loader.setPath('./assets/Bridge2/');

        const textureCube = loader.load(['posX.jpg', 'negX.jpg', 'posY.jpg', 'negY.jpg', 'posZ.jpg', 'negZ.jpg']);
        textureCube.encoding = sRGBEncoding;

        this.scene = scene;
        this.textureCube = textureCube;

        this.renderScene = new THREE.Scene();

        // console.log(cloneUniforms(ShaderLib.cube.uniforms));
        console.log(ShaderLib.cube.fragmentShader);

        const boxMesh = new Mesh(
            new BoxGeometry(1, 1, 1),
            new ShaderMaterial({
                name: 'BackgroundCubeMaterial',
                uniforms: {
                    envMap: { value: null },
                    flipEnvMap: { value: -1 },
                    ior: { value: 1.5 },
                    opacity: { value: 1 },
                    reflectivity: { value: 1 },
                    refractionRatio: { value: 0.98 }
                },
                vertexShader: ShaderLib.cube.vertexShader,
                fragmentShader: ShaderLib.cube.fragmentShader,
                side: BackSide,
                depthTest: false,
                depthWrite: false,
                fog: false,
                glslVersion: GLSL3
            })
        );

        boxMesh.geometry.deleteAttribute('normal');
        boxMesh.geometry.deleteAttribute('uv');

        boxMesh.onBeforeRender = function (renderer, scene, camera) {
            this.matrixWorld.copyPosition(camera.matrixWorld);
        };

        // enable code injection for non-built-in material
        Object.defineProperty(boxMesh.material, 'envMap', {

            get: function () {
                return this.uniforms.envMap.value;
            }

        });

        boxMesh.material.uniforms.envMap.value = textureCube;
        boxMesh.material.uniforms.flipEnvMap.value = (textureCube.isCubeTexture && textureCube.isRenderTargetTexture === false) ? -1 : 1;

        this.renderScene.add(boxMesh);
    }

    update (): void {
        if (this.textureCube.encoding !== this.scene.renderer.outputEncoding) {
            this.textureCube.encoding = this.scene.renderer.outputEncoding;
        }
    }

    render (): void {
        const renderer = this.scene.renderer;

        renderer.render(this.renderScene, this.scene.activeCamera);
    }
}

export { SkyBox };
