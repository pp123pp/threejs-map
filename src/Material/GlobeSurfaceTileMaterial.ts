import { CesiumColor } from '@/Core/CesiumColor';
import { Matrix4, RawShaderMaterial, Vector2, Vector3, Vector4 } from 'three';

class GlobeSurfaceTileMaterial extends RawShaderMaterial {
    lights = false;
    fog = false;
    constructor (parameters = {}) {
        super(parameters);
        this.uniforms = {
            backFaceAlphaByDistance: { value: new Vector4() },
            center3D: { value: new Vector3() },
            clippingPlanesEdgeColor: { value: new Vector4() },
            clippingPlanesEdgeWidth: { value: 0 },
            colorsToAlpha: { value: [] },
            dayIntensity: { value: 0 },
            dayTextureAlpha: { value: [] },
            dayTextureBrightness: { value: [] },
            dayTextureContrast: { value: [] },
            dayTextureCutoutRectangles: { value: [] },
            dayTextureDayAlpha: { value: [] },
            dayTextureHue: { value: [] },
            dayTextureNightAlpha: { value: [] },
            dayTextureOneOverGamma: { value: [] },
            dayTextureSaturation: { value: [] },
            dayTextureSplit: { value: [] },
            dayTextureTexCoordsRectangle: { value: [] },
            dayTextureTranslationAndScale: { value: [] },
            dayTextureUseWebMercatorT: { value: [] },
            dayTextures: { value: [] },
            fillHighlightColor: { value: new Vector4() },
            frontFaceAlphaByDistance: { value: new Vector4() },
            hsbShift: { value: new Vector3() },
            initialColor: { value: new Vector4() },
            lightingFadeDistance: { value: new Vector2() },
            localizedCartographicLimitRectangle: { value: new Vector4() },
            localizedTranslucencyRectangle: { value: new Vector4() },
            minMaxHeight: { value: new Vector4() },
            modifiedModelView: { value: new Matrix4() },
            nightFadeDistance: { value: new Vector2() },
            oceanNormalMap: { value: undefined },
            rtc: { value: new Vector3() },
            scaleAndBias: { value: new Matrix4() },
            southAndNorthLatitude: { value: new Vector2() },
            southMercatorYAndOneOverHeight: { value: new Vector2() },
            terrainExaggerationAndRelativeHeight: { value: new Vector2() },
            tileRectangle: { value: new Vector4() },
            undergroundColor: { value: new CesiumColor() },
            undergroundColorAlphaByDistance: { value: new Vector4() },
            waterMask: { value: undefined },
            waterMaskTranslationAndScale: { value: new Vector4() },
            zoomedOutOceanSpecularIntensity: { value: 0.4 }
        };
    }
}

export { GlobeSurfaceTileMaterial };
