import { ShaderLib } from 'three';
import { fragmentIn, varyingExp, vertexOut } from './ShaderReplace';

const cube = ShaderLib.cube;

const fragmentShader = `
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gDepth;
layout(location = 2) out vec4 gNormal;

#include <envmap_common_pars_fragment>
uniform float opacity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>

void main() {
    vec3 vReflect = vWorldDirection;
    #include <envmap_fragment>
    gColor = envColor;
    gColor.a *= opacity;
    gNormal = vec4( 1.0);
    gDepth = vec4(1.0);
}`;
cube.vertexShader = cube.vertexShader.replace(varyingExp, vertexOut);
cube.fragmentShader = fragmentShader.replace(varyingExp, fragmentIn);

export { cube };
