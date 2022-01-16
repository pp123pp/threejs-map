import { BoundingSphere } from '@/Core/BoundingSphere';
import { Cartesian2 } from '@/Core/Cartesian2';
import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { CesiumColor } from '@/Core/CesiumColor';
import { defaultValue } from '@/Core/defaultValue';
import { defined } from '@/Core/defined';
import { DeveloperError } from '@/Core/DeveloperError';
import { Ellipsoid } from '@/Core/Ellipsoid';
import { EllipsoidTerrainProvider } from '@/Core/EllipsoidTerrainProvider';
import { Event } from '@/Core/Event';
import { IntersectionTests } from '@/Core/IntersectionTests';
import { NearFarScalar } from '@/Core/NearFarScalar';
import { Object3DCollection } from '@/Core/Object3DCollection';
import { Ray } from '@/Core/Ray';
import { Rectangle } from '@/Core/Rectangle';
import { SceneMode } from '@/Core/SceneMode';
import { ShaderSource } from '@/Renderer/ShaderSource';
import GlobeFS from '@/Shader/GlobeFS';
import GlobeVS from '@/Shader/GlobeVS';
import GroundAtmosphere from '@/Shader/GroundAtmosphere';
import { Mesh, Raycaster, SphereBufferGeometry, Vector2 } from 'three';
import { FrameState } from './FrameState';
import { GlobeSurfaceShaderSet } from './GlobeSurfaceShaderSet';
import { GlobeSurfaceTileProvider } from './GlobeSurfaceTileProvider';
import { ImageryLayerCollection } from './ImageryLayerCollection';
import { QuadtreePrimitive } from './QuadtreePrimitive';
import { Scene } from './Scene';
import { ShadowMode } from './ShadowMode';

const scratchGetHeightCartesian = new Cartesian3();
const scratchGetHeightIntersection = new Cartesian3();
const scratchGetHeightCartographic = new Cartographic();
const scratchGetHeightRay = new Ray();

const scratchArray: any = [];
const scratchSphereIntersectionResult = {
    start: 0.0,
    stop: 0.0
};

const intersectionPoint = new Cartesian3();

const raycaster = new Raycaster();
const mouse = new Vector2();

const pickEarth = new Mesh(new SphereBufferGeometry(6378137, 32, 32));

function tileIfContainsCartographic (tile: any, cartographic: any) {
    return defined(tile) && Rectangle.contains(tile.rectangle, cartographic)
        ? tile
        : undefined;
}

function createComparePickTileFunction (rayOrigin: Cartesian3) {
    return function (a:any, b:any) {
        const aDist = BoundingSphere.distanceSquaredTo(
            a.pickBoundingSphere,
            rayOrigin
        );
        const bDist = BoundingSphere.distanceSquaredTo(
            b.pickBoundingSphere,
            rayOrigin
        );

        return aDist - bDist;
    };
}

const makeShadersDirty = (globe: Globe) => {
    const defines: any[] = [];

    // const requireNormals =
    //   defined(globe._material) &&
    //   (globe._material.shaderSource.match(/slope/) ||
    //     globe._material.shaderSource.match('normalEC'));

    const requireNormals = false;

    const fragmentSources = [GroundAtmosphere];
    // if (
    //     defined(globe._material) &&
    //   (!requireNormals || globe._terrainProvider.requestVertexNormals)
    // ) {
    //     fragmentSources.push(globe._material.shaderSource);
    //     defines.push('APPLY_MATERIAL');
    //     globe._surface._tileProvider.materialUniformMap = globe._material._uniforms;
    // } else {
    //     globe._surface._tileProvider.materialUniformMap = undefined;
    // }

    globe._surface._tileProvider.materialUniformMap = undefined;

    fragmentSources.push(GlobeFS);

    globe._surfaceShaderSet.baseVertexShaderSource = new ShaderSource({
        sources: [GroundAtmosphere, GlobeVS],
        defines: defines
    });

    globe._surfaceShaderSet.baseFragmentShaderSource = new ShaderSource({
        sources: fragmentSources,
        defines: defines
    });
    // globe._surfaceShaderSet.material = globe._material;
};

class Globe extends Object3DCollection {
    _ellipsoid:Ellipsoid
    _surface: QuadtreePrimitive;
    maximumScreenSpaceError = 2;
    _imageryLayerCollection: ImageryLayerCollection;

    _terrainProviderChanged = new Event();

    /**
     * The size of the terrain tile cache, expressed as a number of tiles.  Any additional
     * tiles beyond this number will be freed, as long as they aren't needed for rendering
     * this frame.  A larger number will consume more memory but will show detail faster
     * when, for example, zooming out and then back in.
     *
     * @type {Number}
     * @default 100
     */
    tileCacheSize = 100;

    _terrainProvider: EllipsoidTerrainProvider;

    _undergroundColor = CesiumColor.clone(CesiumColor.BLACK);

    /**
     * Enable the ground atmosphere, which is drawn over the globe when viewed from a distance between <code>lightingFadeInDistance</code> and <code>lightingFadeOutDistance</code>.
     *
     * @demo {@link https://sandcastle.cesium.com/index.html?src=Ground%20Atmosphere.html|Ground atmosphere demo in Sandcastle}
     *
     * @type {Boolean}
     * @default true
     */
    showGroundAtmosphere = true;

    /**
     * Determines whether the globe casts or receives shadows from light sources. Setting the globe
     * to cast shadows may impact performance since the terrain is rendered again from the light's perspective.
     * Currently only terrain that is in view casts shadows. By default the globe does not cast shadows.
     *
     * @type {ShadowMode}
     * @default ShadowMode.RECEIVE_ONLY
     */
    shadows = ShadowMode.RECEIVE_ONLY;

    /**
     * The hue shift to apply to the atmosphere. Defaults to 0.0 (no shift).
     * A hue shift of 1.0 indicates a complete rotation of the hues available.
     * @type {Number}
     * @default 0.0
     */
    atmosphereHueShift = 0.0;

    /**
     * Whether to cull back-facing terrain. Back faces are not culled when the camera is underground or translucency is enabled.
     *
     * @type {Boolean}
     * @default true
     */
    backFaceCulling = true;

    /**
     * The saturation shift to apply to the atmosphere. Defaults to 0.0 (no shift).
     * A saturation shift of -1.0 is monochrome.
     * @type {Number}
     * @default 0.0
     */
    atmosphereSaturationShift = 0.0;

    /**
     * The brightness shift to apply to the atmosphere. Defaults to 0.0 (no shift).
     * A brightness shift of -1.0 is complete darkness, which will let space show through.
     * @type {Number}
     * @default 0.0
     */
    atmosphereBrightnessShift = 0.0;

    /**
     * The distance where everything becomes lit. This only takes effect
     * when <code>enableLighting</code> or <code>showGroundAtmosphere</code> is <code>true</code>.
     *
     * @type {Number}
     * @default 10000000.0
     */
    lightingFadeOutDistance = 1.0e7;

    /**
     * The distance where lighting resumes. This only takes effect
     * when <code>enableLighting</code> or <code>showGroundAtmosphere</code> is <code>true</code>.
     *
     * @type {Number}
     * @default 20000000.0
     */
    lightingFadeInDistance = 2.0e7;

    /**
     * The distance where the darkness of night from the ground atmosphere fades out to a lit ground atmosphere.
     * This only takes effect when <code>showGroundAtmosphere</code>, <code>enableLighting</code>, and
     * <code>dynamicAtmosphereLighting</code> are <code>true</code>.
     *
     * @type {Number}
     * @default 10000000.0
     */
    nightFadeOutDistance = 1.0e7;

    /**
     * True if primitives such as billboards, polylines, labels, etc. should be depth-tested
     * against the terrain surface, or false if such primitives should always be drawn on top
     * of terrain unless they're on the opposite side of the globe.  The disadvantage of depth
     * testing primitives against terrain is that slight numerical noise or terrain level-of-detail
     * switched can sometimes make a primitive that should be on the surface disappear underneath it.
     *
     * @type {Boolean}
     * @default false
     *
     */
    depthTestAgainstTerrain = false;

    /**
     * True if an animated wave effect should be shown in areas of the globe
     * covered by water; otherwise, false.  This property is ignored if the
     * <code>terrainProvider</code> does not provide a water mask.
     *
     * @type {Boolean}
     * @default true
     */
    showWaterEffect = true;

    /**
     * The distance where the darkness of night from the ground atmosphere fades in to an unlit ground atmosphere.
     * This only takes effect when <code>showGroundAtmosphere</code>, <code>enableLighting</code>, and
     * <code>dynamicAtmosphereLighting</code> are <code>true</code>.
     *
     * @type {Number}
     * @default 50000000.0
     */
    nightFadeInDistance = 5.0e7;

    _zoomedOutOceanSpecularIntensity = 0.4;

    /**
     * A scalar used to exaggerate the terrain. Defaults to <code>1.0</code> (no exaggeration).
     * A value of <code>2.0</code> scales the terrain by 2x.
     * A value of <code>0.0</code> makes the terrain completely flat.
     * Note that terrain exaggeration will not modify any other primitive as they are positioned relative to the ellipsoid.
     * @type {Number}
     * @default 1.0
     */
    terrainExaggeration = 1.0;

    /**
     * The height from which terrain is exaggerated. Defaults to <code>0.0</code> (scaled relative to ellipsoid surface).
     * Terrain that is above this height will scale upwards and terrain that is below this height will scale downwards.
     * Note that terrain exaggeration will not modify any other primitive as they are positioned relative to the ellipsoid.
     * If {@link Globe#terrainExaggeration} is <code>1.0</code> this value will have no effect.
     * @type {Number}
     * @default 0.0
     */
    terrainExaggerationRelativeHeight = 0.0;

    /**
     * Whether to show terrain skirts. Terrain skirts are geometry extending downwards from a tile's edges used to hide seams between neighboring tiles.
     * Skirts are always hidden when the camera is underground or translucency is enabled.
     *
     * @type {Boolean}
     * @default true
     */
    showSkirts = true;

    /**
     * Gets or sets the number of loading descendant tiles that is considered "too many".
     * If a tile has too many loading descendants, that tile will be loaded and rendered before any of
     * its descendants are loaded and rendered. This means more feedback for the user that something
     * is happening at the cost of a longer overall load time. Setting this to 0 will cause each
     * tile level to be loaded successively, significantly increasing load time. Setting it to a large
     * number (e.g. 1000) will minimize the number of tiles that are loaded but tend to make
     * detail appear all at once after a long wait.
     * @type {Number}
     * @default 20
     */
    loadingDescendantLimit = 20;

    /**
     * Gets or sets a value indicating whether the ancestors of rendered tiles should be preloaded.
     * Setting this to true optimizes the zoom-out experience and provides more detail in
     * newly-exposed areas when panning. The down side is that it requires loading more tiles.
     * @type {Boolean}
     * @default true
     */
    preloadAncestors = true;

    /**
     * Gets or sets a value indicating whether the siblings of rendered tiles should be preloaded.
     * Setting this to true causes tiles with the same parent as a rendered tile to be loaded, even
     * if they are culled. Setting this to true may provide a better panning experience at the
     * cost of loading more tiles.
     * @type {Boolean}
     * @default false
     */
    preloadSiblings = false;

    /**
     * The color to use to highlight terrain fill tiles. If undefined, fill tiles are not
     * highlighted at all. The alpha value is used to alpha blend with the tile's
     * actual color. Because terrain fill tiles do not represent the actual terrain surface,
     * it may be useful in some applications to indicate visually that they are not to be trusted.
     * @type {Color}
     * @default undefined
     */
    fillHighlightColor?: CesiumColor = undefined;
    /**
     * Enable lighting the globe with the scene's light source.
     *
     * @type {Boolean}
     * @default false
     */
    enableLighting = false;

    /**
     * Enable dynamic lighting effects on atmosphere and fog. This only takes effect
     * when <code>enableLighting</code> is <code>true</code>.
     *
     * @type {Boolean}
     * @default true
     */
    dynamicAtmosphereLighting = true;

    /**
     * Whether dynamic atmosphere lighting uses the sun direction instead of the scene's
     * light direction. This only takes effect when <code>enableLighting</code> and
     * <code>dynamicAtmosphereLighting</code> are <code>true</code>.
     *
     * @type {Boolean}
     * @default false
     */
    dynamicAtmosphereLightingFromSun = false;

    _oceanNormalMap: any;

    _undergroundColorAlphaByDistance: NearFarScalar;

    _surfaceShaderSet = new GlobeSurfaceShaderSet()

    constructor (ellipsoid = Ellipsoid.WGS84) {
        super();
        const terrainProvider = new EllipsoidTerrainProvider({
            ellipsoid: ellipsoid
        });

        this._ellipsoid = ellipsoid;

        const imageryLayerCollection = new ImageryLayerCollection();

        this._imageryLayerCollection = imageryLayerCollection;

        this._surface = new QuadtreePrimitive({
            tileProvider: new GlobeSurfaceTileProvider({
                terrainProvider: new EllipsoidTerrainProvider(),
                imageryLayers: imageryLayerCollection,
                surfaceShaderSet: this._surfaceShaderSet
            })
        });

        this._terrainProvider = terrainProvider;

        this._undergroundColorAlphaByDistance = new NearFarScalar(
            ellipsoid.maximumRadius / 1000.0,
            0.0,
            ellipsoid.maximumRadius / 5.0,
            1.0
        );

        makeShadersDirty(this);

        this.terrainProvider = new EllipsoidTerrainProvider();
    }

    get ellipsoid (): Ellipsoid {
        return this._ellipsoid;
    }

    get terrainProvider (): EllipsoidTerrainProvider {
        return this._terrainProvider;
    }

    set terrainProvider (value: EllipsoidTerrainProvider) {
        if (value !== this._terrainProvider) {
            this._terrainProvider = value;
            this._terrainProviderChanged.raiseEvent(value);
        }
    }

    get imageryLayers (): ImageryLayerCollection {
        return this._imageryLayerCollection;
    }

    get imageryLayersUpdatedEvent (): Event {
        return this._surface.tileProvider.imageryLayersUpdatedEvent;
    }

    get tilesLoaded (): boolean {
        if (!defined(this._surface)) {
            return true;
        }
        return (
            this._surface.tileProvider.ready &&
            this._surface._tileLoadQueueHigh.length === 0 &&
            this._surface._tileLoadQueueMedium.length === 0 &&
            this._surface._tileLoadQueueLow.length === 0
        );
    }

    get terrainProviderChanged (): Event {
        return this._terrainProviderChanged;
    }

    /**
     * Get the height of the surface at a given cartographic.
     *
     * @param {Cartographic} cartographic The cartographic for which to find the height.
     * @returns {Number|undefined} The height of the cartographic or undefined if it could not be found.
     */
    getHeight (cartographic: Cartographic): number | undefined {
        // >>includeStart('debug', pragmas.debug);
        if (!defined(cartographic)) {
            throw new DeveloperError('cartographic is required');
        }
        // >>includeEnd('debug');

        const levelZeroTiles = this._surface._levelZeroTiles;
        if (!defined(levelZeroTiles)) {
            return;
        }

        let tile;
        let i;

        const length = levelZeroTiles.length;
        for (i = 0; i < length; ++i) {
            tile = levelZeroTiles[i];
            if (Rectangle.contains(tile.rectangle, cartographic)) {
                break;
            }
        }

        if (i >= length) {
            return undefined;
        }

        let tileWithMesh = tile;

        while (defined(tile)) {
            tile =
        tileIfContainsCartographic(tile._southwestChild, cartographic) ||
        tileIfContainsCartographic(tile._southeastChild, cartographic) ||
        tileIfContainsCartographic(tile._northwestChild, cartographic) ||
        tile._northeastChild;

            if (
                defined(tile) &&
        defined(tile.data) &&
        defined(tile.data.renderedMesh)
            ) {
                tileWithMesh = tile;
            }
        }

        tile = tileWithMesh;

        // This tile was either rendered or culled.
        // It is sometimes useful to get a height from a culled tile,
        // e.g. when we're getting a height in order to place a billboard
        // on terrain, and the camera is looking at that same billboard.
        // The culled tile must have a valid mesh, though.
        if (
            !defined(tile) ||
      !defined(tile.data) ||
      !defined(tile.data.renderedMesh)
        ) {
            // Tile was not rendered (culled).
            return undefined;
        }

        const projection = this._surface._tileProvider.tilingScheme.projection;
        const ellipsoid = this._surface._tileProvider.tilingScheme.ellipsoid;

        // cartesian has to be on the ellipsoid surface for `ellipsoid.geodeticSurfaceNormal`
        const cartesian = Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            0.0,
            ellipsoid,
            scratchGetHeightCartesian
        );

        const ray = scratchGetHeightRay;
        const surfaceNormal = ellipsoid.geodeticSurfaceNormal(cartesian, ray.direction) as Cartesian3;

        // Try to find the intersection point between the surface normal and z-axis.
        // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
        const rayOrigin = ellipsoid.getSurfaceNormalIntersectionWithZAxis(
            cartesian,
            11500.0,
            ray.origin
        );

        // Theoretically, not with Earth datums, the intersection point can be outside the ellipsoid
        if (!defined(rayOrigin)) {
            // intersection point is outside the ellipsoid, try other value
            // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
            let minimumHeight;
            if (defined(tile.data.tileBoundingRegion)) {
                minimumHeight = tile.data.tileBoundingRegion.minimumHeight;
            }
            const magnitude = Math.min(defaultValue(minimumHeight, 0.0), -11500.0);

            // multiply by the *positive* value of the magnitude
            const vectorToMinimumPoint = Cartesian3.multiplyByScalar(
                surfaceNormal,
                Math.abs(magnitude) + 1,
                scratchGetHeightIntersection
            );
            Cartesian3.subtract(cartesian, vectorToMinimumPoint, ray.origin);
        }

        const intersection = tile.data.pick(
            ray,
            undefined,
            projection,
            false,
            scratchGetHeightIntersection
        );
        if (!defined(intersection)) {
            return undefined;
        }

        return (ellipsoid as any).cartesianToCartographic(
            intersection,
            scratchGetHeightCartographic
        ).height;
    }

    render (frameState: FrameState): void {
        if (!this.visible) {
            return;
        }

        const surface = this._surface;
        const pass = frameState.passes;

        if (pass.render) {
            surface.render(frameState);
        }
    }

    beginFrame (frameState: FrameState): void {
        const surface = this._surface;
        const tileProvider = surface.tileProvider;
        const terrainProvider = this.terrainProvider;

        const hasWaterMask =
            this.showWaterEffect &&
            terrainProvider.ready &&
            terrainProvider.hasWaterMask;

        const pass = frameState.passes;
        const mode = frameState.mode;

        if (pass.render) {
            if (this.showGroundAtmosphere) {
                this._zoomedOutOceanSpecularIntensity = 0.4;
            } else {
                this._zoomedOutOceanSpecularIntensity = 0.5;
            }

            surface.maximumScreenSpaceError = this.maximumScreenSpaceError;
            surface.tileCacheSize = this.tileCacheSize;
            surface.loadingDescendantLimit = this.loadingDescendantLimit;
            surface.preloadAncestors = this.preloadAncestors;
            surface.preloadSiblings = this.preloadSiblings;

            tileProvider.terrainProvider = this.terrainProvider;
            tileProvider.lightingFadeOutDistance = this.lightingFadeOutDistance;
            tileProvider.lightingFadeInDistance = this.lightingFadeInDistance;
            tileProvider.nightFadeOutDistance = this.nightFadeOutDistance;
            tileProvider.nightFadeInDistance = this.nightFadeInDistance;
            tileProvider.zoomedOutOceanSpecularIntensity =
              mode === SceneMode.SCENE3D ? this._zoomedOutOceanSpecularIntensity : 0.0;
            tileProvider.hasWaterMask = hasWaterMask;
            tileProvider.oceanNormalMap = this._oceanNormalMap;
            tileProvider.enableLighting = this.enableLighting;
            tileProvider.dynamicAtmosphereLighting = this.dynamicAtmosphereLighting;
            tileProvider.dynamicAtmosphereLightingFromSun = this.dynamicAtmosphereLightingFromSun;
            tileProvider.showGroundAtmosphere = this.showGroundAtmosphere;
            tileProvider.shadows = this.shadows;
            tileProvider.hueShift = this.atmosphereHueShift;
            tileProvider.saturationShift = this.atmosphereSaturationShift;
            tileProvider.brightnessShift = this.atmosphereBrightnessShift;
            tileProvider.fillHighlightColor = this.fillHighlightColor;
            tileProvider.showSkirts = this.showSkirts;
            tileProvider.backFaceCulling = this.backFaceCulling;
            tileProvider.undergroundColor = this._undergroundColor;
            tileProvider.undergroundColorAlphaByDistance = this._undergroundColorAlphaByDistance;

            surface.beginFrame(frameState);
        }
    }

    endFrame (frameState: FrameState): void {
        if (!this.visible) {
            return;
        }

        if (frameState.passes.render) {
            this._surface.endFrame(frameState);
        }
    }

    update (frameState: FrameState): void {
        if (!this.visible) {
            return;
        }

        if (frameState.passes.render) {
            this._surface.update(frameState);
        }
    }

    pickWorldCoordinates (ray: Ray,
        scene: Scene,
        cullBackFaces = true,
        result?: Cartesian3): Cartesian3 | undefined {
        cullBackFaces = defaultValue(cullBackFaces, true);

        const mode = scene.mode;
        const projection = scene.mapProjection;

        const sphereIntersections = scratchArray;
        sphereIntersections.length = 0;

        const tilesToRender = this._surface._tilesToRender;
        let length = tilesToRender.length;

        let tile;
        let i;

        for (i = 0; i < length; ++i) {
            tile = tilesToRender[i];
            const surfaceTile = tile.data;

            if (!defined(surfaceTile)) {
                continue;
            }

            let boundingVolume = surfaceTile.pickBoundingSphere;
            if (mode !== SceneMode.SCENE3D) {
                surfaceTile.pickBoundingSphere = boundingVolume = BoundingSphere.fromRectangleWithHeights2D(
                    tile.rectangle,
                    projection,
                    surfaceTile.tileBoundingRegion.minimumHeight,
                    surfaceTile.tileBoundingRegion.maximumHeight,
                    boundingVolume
                );
                Cartesian3.fromElements(
                    boundingVolume.center.z,
                    boundingVolume.center.x,
                    boundingVolume.center.y,
                    boundingVolume.center
                );
            } else if (defined(surfaceTile.renderedMesh)) {
                BoundingSphere.clone(
                    surfaceTile.tileBoundingRegion.boundingSphere,
                    boundingVolume
                );
            } else {
                // So wait how did we render this thing then? It shouldn't be possible to get here.
                continue;
            }

            // const boundingSphereIntersection = IntersectionTests.intersectSphere(
            //     ray,
            //     boundingVolume,
            //     intersectionPoint
            // );
            const boundingSphereIntersection = IntersectionTests.raySphere(
                ray,
                boundingVolume,
                scratchSphereIntersectionResult
            );

            if (defined(boundingSphereIntersection)) {
                sphereIntersections.push(surfaceTile);
            }
        }

        sphereIntersections.sort(createComparePickTileFunction(ray.origin));

        let intersection;
        length = sphereIntersections.length;
        for (i = 0; i < length; ++i) {
            intersection = sphereIntersections[i].pick(
                ray,
                scene.mode,
                scene.mapProjection,
                cullBackFaces,
                result
            );
            if (defined(intersection)) {
                break;
            }
        }

        return intersection;
    }
}

export { Globe };
