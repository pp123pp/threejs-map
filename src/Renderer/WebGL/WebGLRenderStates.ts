import { WebGLLights } from 'three';

class WebGLRenderState {
    constructor (extensions: any, capabilities: any) {
        const lights = new WebGLLights(extensions, capabilities);

        const lightsArray: any[] = [];
        const shadowsArray: any[] = [];

        function init () {
            lightsArray.length = 0;
            shadowsArray.length = 0;
        }

        function pushLight (light: any) {
            lightsArray.push(light);
        }

        function pushShadow (shadowLight: any) {
            shadowsArray.push(shadowLight);
        }

        function setupLights (physicallyCorrectLights: any) {
            lights.setup(lightsArray);
        }

        function setupLightsView (camera: any) {
            lights.setupView(lightsArray, camera);
        }

        const state = {
            lightsArray: lightsArray,
            shadowsArray: shadowsArray,

            lights: lights
        };

        return {
            init: init,
            state: state,
            setupLights: setupLights,
            setupLightsView: setupLightsView,

            pushLight: pushLight,
            pushShadow: pushShadow
        };
    }
}

class WebGLRenderStates {
    constructor (extensions: any, capabilities: any) {
        let renderStates = new WeakMap();

        function get (scene: any, renderCallDepth = 0) {
            let renderState;

            if (renderStates.has(scene) === false) {
                renderState = new WebGLRenderState(extensions, capabilities);
                renderStates.set(scene, [renderState]);
            } else {
                if (renderCallDepth >= renderStates.get(scene).length) {
                    renderState = new WebGLRenderState(extensions, capabilities);
                    renderStates.get(scene).push(renderState);
                } else {
                    renderState = renderStates.get(scene)[renderCallDepth];
                }
            }

            return renderState;
        }

        function dispose () {
            renderStates = new WeakMap();
        }

        return {
            get: get,
            dispose: dispose
        };
    }
}

export { WebGLRenderStates };
