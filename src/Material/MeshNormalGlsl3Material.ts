import { resolveIncludes } from '@/Core/resolveIncludes';
import { MeshNormalGlsl3Shader } from '@/Shader/MeshNormalGlsl3Shader';
import { GLSL3, ShaderLib, ShaderMaterial, UniformsUtils } from 'three';

// console.log(resolveIncludes(normal.vertexShader));

class MeshNormalGlsl3Material extends ShaderMaterial {
    constructor (parameters = {}) {
        super(parameters);

        this.fragmentShader = MeshNormalGlsl3Shader.fragmentShader;
        this.vertexShader = MeshNormalGlsl3Shader.vertexShader;
        this.uniforms = UniformsUtils.clone(MeshNormalGlsl3Shader.uniforms);

        this.glslVersion = GLSL3;
    }
}

export { MeshNormalGlsl3Material };
