import { ShaderLib, UniformsUtils } from 'three';
import { fragmentIn, vertexOut, vrayingExp } from './ShaderReplace';

const normal = ShaderLib.normal;

const fragmentShader = `
#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
    varying vec3 vViewPosition;
#endif

layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gDepth;
layout(location = 2) out vec4 gNormal;

#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
    #include <clipping_planes_fragment>
    #include <logdepthbuf_fragment>
    #include <normal_fragment_begin>
    #include <normal_fragment_maps>
    gColor = vec4( packNormalToRGB( normal ), opacity );
    gNormal = vec4(normal, 1.0);
    gDepth = vec4(1.0);
}
`;

const MeshNormalGlsl3Shader = {
    vertexShader: normal.vertexShader.replace(vrayingExp, vertexOut),
    fragmentShader: fragmentShader.replace(vrayingExp, fragmentIn),
    uniforms: normal.uniforms
};

export { MeshNormalGlsl3Shader };
