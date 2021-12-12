import { Cartesian2 } from '@/Core/Cartesian2';
import { generateUUID } from 'three/src/math/MathUtils';
import { Scene } from './Scene';

class Context {
    scene: Scene;
    public cache: any;
    protected _id: string;
    drawingBufferHeight: Cartesian2;
    constructor (scene: Scene) {
        this.scene = scene;

        this.cache = {};

        this._id = generateUUID();

        this.drawingBufferHeight = new Cartesian2();
    }
}

export { Context };
