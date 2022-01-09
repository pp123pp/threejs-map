import { AxesHelper, DoubleSide, Mesh, MeshNormalMaterial, ShaderChunk, ShaderLib, SphereGeometry, Vector2 } from 'three';
import { CameraEventType } from './Core/CameraEventType';
import { MeshNormalGlsl3Material, ScreenSpaceEventType, TileCoordinatesImageryProvider, WebMapTileServiceImageryProvider } from './Map';
import { Scene } from './Scene/Scene';
import './Widgets/MapWidgets/CesiumWidget.css';
import { MapWidgets } from './Widgets/MapWidgets/MapWidgets';
import { when } from './ThirdParty/when';
import { Cartesian3 } from './Core/Cartesian3';

import * as Map from './Map';
import { IntersectionTests } from './Core/IntersectionTests';
import { Ray } from './Core/Ray';
import { BoundingSphere } from './Core/BoundingSphere';
import { Cartesian2 } from './Core/Cartesian2';

// const a = document.querySelector('#app');
// console.log(a);

const widget = new MapWidgets('app', {});
console.log(widget);

const scene: Scene = widget.scene;
const camera = scene.activeCamera;

// camera.position.set(6378137 * 2, 6378137 * 2, 6378137 * 2);
// camera.position.set(3452756.404004388, -26226288.65595444, 18610961.973367725);

// camera.position.set(-742945.7510284233, -6142190.297500091, 6604747.564006202);
// camera.lookAt(0, 0, 0);

scene.camera.setView({
    // destination: new Cartesian3(-742945.7510284233, -6142190.297500091, 6604747.564006202)
    destination: new Cartesian3(3452756.404004388, -26226288.65595444, 18610961.973367725)
});

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
    maximumLevel: 17, // 定义最大缩放级别
    layer: 'tdtImgLayer',
    style: 'default',
    format: 'image/jpeg',
    tileMatrixSetID: 'GoogleMapsCompatible' // 使用谷歌的瓦片切片方式
}));

// scene.imageryLayers.addImageryProvider(new (TileCoordinatesImageryProvider as any)());

const geometry = new SphereGeometry(1, 64, 64);
const material = new MeshNormalGlsl3Material({ side: DoubleSide, wireframe: true });
const cube = new Mesh(geometry, material);
scene.add(cube);

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

    // const ray = scene.camera.getPickRay(movement.position);
    // const ps = scene.globe.pickWorldCoordinates(ray, scene, true) as Cartesian3;
    // cube.position.x = ps.x;
    // cube.position.y = ps.y;
    // cube.position.z = ps.z;
    console.log(scene.camera);
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

console.log(scratchSphereIntersectionResult);

console.log(ShaderLib.background);

let isAni = false;

(document.getElementById('btn') as HTMLElement).onclick = function () {
    //
    isAni = !isAni;
};

scene.preRender.addEventListener(() => {
    if (isAni) {
        scene.camera.twistLeft(0.01);
    }
});
