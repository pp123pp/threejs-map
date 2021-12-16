import { AxesHelper, DoubleSide, Mesh, MeshNormalMaterial, SphereGeometry } from 'three';
import { CameraEventType } from './Core/CameraEventType';
import { TileCoordinatesImageryProvider, WebMapTileServiceImageryProvider } from './Map';
import { Scene } from './Scene/Scene';
import './Widgets/MapWidgets/CesiumWidget.css';
import { MapWidgets } from './Widgets/MapWidgets/MapWidgets';
import { when } from './ThirdParty/when';

// const a = document.querySelector('#app');
// console.log(a);

const widget = new MapWidgets('app', {});
console.log(widget);

const scene: Scene = widget.scene;
const camera = scene.activeCamera;

// camera.position.set(6378137 * 2, 6378137 * 2, 6378137 * 2);
// camera.position.set(2033992.677662228, -15449708.24660572, 10948396.652844096);

camera.position.set(2033992.677662228,
    -15449708.24660572,
    10948396.652844096);
camera.lookAt(0, 0, 0);

const geometry = new SphereGeometry(6378137, 64, 64);
const material = new MeshNormalMaterial({ side: DoubleSide, wireframe: true });
const cube = new Mesh(geometry, material);
// scene.add(cube);

const axesHelper = new AxesHelper(50000000);
scene.add(axesHelper);
console.log(CameraEventType);

const mapToken = '39d358c825ec7e59142958656c0a6864';// 盈嘉企业开发者秘钥
// '3669131581c051178afabed885766ac2', //天地图广州---容易出错
// '993470e78cc4324e1023721f57b23640',
// '5f5ced578c88ac399b0691415c56a9d7',
// 'a1da75892570d7add77b51f40a1d72c4'

// scene.imageryLayers.addImageryProvider(new WebMapTileServiceImageryProvider({
//     // 影像底图
//     url: 'https://{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&tk=' + mapToken,
//     subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
//     maximumLevel: 17, // 定义最大缩放级别
//     layer: 'tdtImgLayer',
//     style: 'default',
//     format: 'image/jpeg',
//     tileMatrixSetID: 'GoogleMapsCompatible' // 使用谷歌的瓦片切片方式
// }));

scene.imageryLayers.addImageryProvider(new (TileCoordinatesImageryProvider as any)());
