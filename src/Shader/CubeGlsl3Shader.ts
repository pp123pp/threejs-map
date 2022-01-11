import { ShaderChunk, ShaderLib } from 'three';
import { envmap_fragment } from './envmap_fragment';
import { fragmentIn, varyingExp, vertexOut } from './ShaderReplace';

const cube = ShaderLib.cube;

// console.log(ShaderChunk.envmap_fragment);

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
    ${envmap_fragment}
    gColor = envColor;
    gColor.a *= opacity;
    gNormal = vec4( 1.0);
    gDepth = vec4(1.0);
    #if defined( TONE_MAPPING )
        gColor.rgb = toneMapping( gColor.rgb );
    #endif
        gColor = linearToOutputTexel( gColor );
    
}`;
cube.vertexShader = cube.vertexShader.replace(varyingExp, vertexOut);
cube.fragmentShader = fragmentShader.replace(varyingExp, fragmentIn);

export { cube };
