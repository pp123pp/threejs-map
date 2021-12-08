import { defined } from './defined';

let imageRenderingValueResult: string;
let supportsImageRenderingPixelatedResult: boolean;
function supportsImageRenderingPixelated (): boolean {
    if (!defined(supportsImageRenderingPixelatedResult)) {
        const canvas = document.createElement('canvas');
        canvas.setAttribute(
            'style',
            'image-rendering: -moz-crisp-edges;' + 'image-rendering: pixelated;'
        );
        // canvas.style.imageRendering will be undefined, null or an empty string on unsupported browsers.
        const tmp: string = canvas.style.imageRendering;
        supportsImageRenderingPixelatedResult = defined(tmp) && tmp !== '';
        if (supportsImageRenderingPixelatedResult) {
            imageRenderingValueResult = tmp;
        }
    }
    return supportsImageRenderingPixelatedResult;
}

function imageRenderingValue (): string | undefined {
    return supportsImageRenderingPixelated()
        ? imageRenderingValueResult
        : undefined;
}

const FeatureDetection = {
    imageRenderingValue,
    supportsImageRenderingPixelated
};

export { FeatureDetection };
