import { generateUUID } from 'three/src/math/MathUtils';
import { Scene } from './Scene';

class Context {
    scene: Scene;
    public cache: unknown;
    protected _id: string;
    constructor (scene: Scene) {
        this.scene = scene;

        this.cache = {};

        this._id = generateUUID();
    }
}

export { Context };
