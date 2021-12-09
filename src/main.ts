import { MapWidgets } from './Widgets/MapWidgets/MapWidgets';

import './Widgets/MapWidgets/CesiumWidget.css';

import { Scene } from './Scene/Scene';
import { AxesHelper, BoxGeometry, DoubleSide, Mesh, MeshNormalMaterial, SphereGeometry } from 'three';
import { Camera } from './Scene/Camera';
import { CameraEventType } from './Core/CameraEventType';
// const a = document.querySelector('#app');
// console.log(a);

const widget = new MapWidgets('app', {});
console.log(widget);

const scene: Scene = widget.scene;
const camera = scene.activeCamera;

camera.position.set(6378137 * 2, 6378137 * 2, 6378137 * 2);

const geometry = new SphereGeometry(6378137, 64, 64);
const material = new MeshNormalMaterial({ side: DoubleSide });
const cube = new Mesh(geometry, material);
scene.add(cube);

const axesHelper = new AxesHelper(50000000);
scene.add(axesHelper);
console.log(CameraEventType);
