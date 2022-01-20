import { AxesHelper, DoubleSide, Mesh, MeshNormalMaterial, ShaderLib, SphereGeometry } from 'three';
import { BoundingSphere } from './Core/BoundingSphere';
import { Cartesian2 } from './Core/Cartesian2';
import { Cartesian3 } from './Core/Cartesian3';
import { IntersectionTests } from './Core/IntersectionTests';
import { Ray } from './Core/Ray';
import { ScreenSpaceEventType, TileCoordinatesImageryProvider, WebMapTileServiceImageryProvider } from './Map';
import { Scene } from './Scene/Scene';
import { UrlTemplateImageryProvider } from './Scene/UrlTemplateImageryProvider';
import './Widgets/MapWidgets/CesiumWidget.css';
import { MapWidgets } from './Widgets/MapWidgets/MapWidgets';

const widget = new MapWidgets('app', {});

const scene: Scene = widget.scene;

// scene.camera.setView({
//     // destination: new Cartesian3(-742945.7510284233, -6142190.297500091, 6604747.564006202)
//     destination: new Cartesian3(3452756.404004388, -26226288.65595444, 18610961.973367725)
// });

// scene.camera.setView({
//     // destination: new Cartesian3(-742945.7510284233, -6142190.297500091, 6604747.564006202)
//     destination: new Cartesian3(720788.1922255766, -5160602.436697017, 3837563.1171764936)
// });

const axesHelper = new AxesHelper(50000000);
// scene.add(axesHelper);
// console.log(CameraEventType);

const mapToken = '39d358c825ec7e59142958656c0a6864';// 盈嘉企业开发者秘钥
// '3669131581c051178afabed885766ac2', //天地图广州---容易出错
// '993470e78cc4324e1023721f57b23640',
// '5f5ced578c88ac399b0691415c56a9d7',
// 'a1da75892570d7add77b51f40a1d72c4'

scene.imageryLayers.addImageryProvider(new WebMapTileServiceImageryProvider({
    // 影像底图
    url: 'https://{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&tk=' + mapToken,
    subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
    // url: 'https://{s}.aerial.maps.ls.hereapi.com/maptile/2.1/maptile/newest/satellite.day/{TileMatrix}/{TileCol}/{TileRow}/512/png8?apikey=J0IJdYzKDYS3nHVDDEWETIqK3nAcxqW42vz7xeSq61M',
    // subdomains: ['1', '2', '3', '4'],
    maximumLevel: 17, // 定义最大缩放级别
    layer: 'tdtImgLayer',
    style: 'default',
    format: 'image/jpeg',
    tileMatrixSetID: 'GoogleMapsCompatible' // 使用谷歌的瓦片切片方式
}));

scene.imageryLayers.addImageryProvider(new WebMapTileServiceImageryProvider({
    // 调用影响中文注记服务
    url: 'https://{s}.tianditu.gov.cn/cva_w/wmts?service=wmts&request=GetTile&version=1.0.0' +
                 '&LAYER=cva&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}' +
                 '&style=default.jpg&tk=' + mapToken,
    layer: 'cia_w',
    style: 'default',
    format: 'tiles',
    tileMatrixSetID: 'GoogleMapsCompatible',
    subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
    minimumLevel: 0,
    maximumLevel: 18
}));

const urlTemplateImageryProvide = new UrlTemplateImageryProvider({
    // url: 'http://www.google.cn/maps/vt?lyrs=s@800&x={x}&y={y}&z={z}'
    // tilingScheme: new WebMercatorTilingScheme({}),
    // minimumLevel: 1,
    // maximumLevel: 20
    url: 'https://map.geoq.cn/a rcgis/rest/services/ChinaOnlineStreetPurplishBlue/MapServer/tile/{z}/{y}/{x}'
});
// scene.imageryLayers.addImageryProvider(
//     urlTemplateImageryProvide
// );

// scene.imageryLayers.addImageryProvider(new (TileCoordinatesImageryProvider as any)());

console.log(urlTemplateImageryProvide.proxy);
const geometry = new SphereGeometry(1, 64, 64);
const material = new MeshNormalMaterial({ side: DoubleSide, wireframe: true });
const cube = new Mesh(geometry, material);
scene.add(cube);
// scene.camera.lookAt(scene.camera.direction);
// console.log(Map);
// console.log(ShaderLib);

// console.log(ShaderChunk.output_fragment);
// console.log(ShaderChunk.common);

const screenPs = new Cartesian2();
widget.screenSpaceEventHandler.setInputAction((movement: any) => {
    // console.log(movement.position);

    // screenPs.x = event.clientX;
    // screenPs.y = event.clientY;
    // const ps = scene.camera.pickEllipsoid(movement.endPosition) as Cartesian3;

    const ray = scene.camera.getPickRay(movement.position);
    const ps = scene.globe.pickWorldCoordinates(ray, scene, true) as Cartesian3;
    cube.position.x = ps.x;
    cube.position.y = ps.y;
    cube.position.z = ps.z;
    // console.log(scene.camera);

    // scene.camera.lookAt(scene.camera.direction);
},
ScreenSpaceEventType.LEFT_CLICK);

const direction = new Cartesian3(-0.4903381374223797, 0.7704996762071239, -0.407306714840142);
const origin = new Cartesian3(30222806.15307514, -42745526.64600748, 26630845.84547744);
const ray = new Ray(origin, direction);

const center = new Cartesian3(-12.277106075028938, -5250.839785214442, 10077.616726956829);
const radius = 6379226.7259915285;
const boundingVolume = new BoundingSphere(center, radius);

const scratchSphereIntersectionResult = {
    start: 0.0,
    stop: 0.0
};
IntersectionTests.raySphere(
    ray,
    boundingVolume,
    scratchSphereIntersectionResult
);

// let isAni = false;

// (document.getElementById('btn') as HTMLElement).onclick = function () {
//     //
//     isAni = !isAni;
// };

// scene.preRender.addEventListener(() => {
//     if (isAni) {
//         scene.camera.rotateRight(0.01);
//         // scene.camera.rotateUp(0.01);
//     }
// });

scene.renderer.toneMappingExposure = 10;
