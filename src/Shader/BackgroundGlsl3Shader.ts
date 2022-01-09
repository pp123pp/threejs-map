import { ShaderLib } from 'three';
import { fragmentIn, varyingExp, vertexOut } from './ShaderReplace';

const background = ShaderLib.background;

const fragmentShader = `
uniform sampler2D t2D;
varying vec2 vUv;
void main() {
    vec4 texColor = texture2D( t2D, vUv );
    gColor = mapTexelToLinear( texColor );
    #include <tonemapping_fragment>
    #include <encodings_fragment>
}`;

background.vertexShader = background.vertexShader.replace(varyingExp, vertexOut);
background.fragmentShader = fragmentShader.replace(varyingExp, fragmentIn);

export {
    background
};
