import { BoundingSphere } from '@/Core/BoundingSphere';
import { defined } from '@/Core/defined';
import { OrientedBoundingBox } from '@/Core/OrientedBoundingBox';
import { FrameState } from '@/Scene/FrameState';
import { BufferGeometry, Material, Mesh } from 'three';

class DrawMeshCommand extends Mesh {
    derivedCommands: any;
    isCommand: boolean;
    isDrawMeshCommand: boolean;
    owner?: any;
    boundingVolume?: BoundingSphere;
    orientedBoundingBox?: OrientedBoundingBox
    constructor (geometry?: BufferGeometry, material?: Material) {
        super(geometry, material);

        this.derivedCommands = {
            originalMaterial: this.material,
            oit: undefined,
            // 用于颜色拾取的材质
            picking: undefined,
            oitMaterial: undefined,
            depth: undefined,
            basicMaterial: undefined
        };
        // this.pass = CommandRenderPass.OPAQUE;
        this.isCommand = true;
        this.allowPicking = true;

        this.isDrawMeshCommand = true;

        this.frustumCulled = false;

        this.frustumCulled = false;

        this.owner = undefined;
    }

    get levelId (): number {
        return this.owner.levelId;
    }

    compressVertices () {
        // const geometry = this.geometry;
    }

    update (frameState: FrameState): void {
        // this.material.picking = false;

        // if (defined(this.material.update)) {
        //     this.material.update(frameState);
        // }

        // if (frameState.passes.pick) {
        //     this.material.picking = true;
        // }
    }
}

export { DrawMeshCommand };
