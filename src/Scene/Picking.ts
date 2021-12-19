import { Scene } from './Scene';

class Picking {
    scene: Scene;
    constructor (scene: Scene) {
        // 保存主场景
        this.scene = scene;

        this.pickScene = new Scene();

        // 用于计算深度
        this.pickDepth = new PickDepth(scene, this);

        // 用于拾取颜色
        // this.pickColor = new PickColor(scene, this);

        this.scissor = new Vector4();
    }

    // 根据depthTexture获取深度
    getDepth (x: number, y: number, frustum: Frustum) {
        const pixels = this.pickDepth.getDepth(x, y, frustum);

        if (this.pickDepth.depthMaterial.depthPacking === RGBADepthPacking) {
            const packedDepth = (Vector4 as any).unpack(pixels, 0, scratchPackedDepth);
            return packedDepth.dot(UnpackFactors) * 2 - 1;
        }

        return -pixels[0] * 2.0 + 1.0;
    }
}

export { Picking };
