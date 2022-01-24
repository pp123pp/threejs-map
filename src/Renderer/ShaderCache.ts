import { defined } from '@/Core/defined';
import { Context } from '@/Scene/Context';
import { ShaderProgram } from './ShaderProgram';
import { ShaderSource } from './ShaderSource';

class ShaderCache {
    _context: Context;
    _shaders = {};
    _numberOfShaders = 0;
    _shadersToRelease = {}
    constructor (context: Context) {
        this._context = context;
    }

    getShaderProgram (options: {
        vertexShaderSource: ShaderSource | string,
        fragmentShaderSource: ShaderSource | string,
        context: Context,
        attributeLocations?: {
            [name: string]: number
        }
    }): ShaderProgram {
        let vertexShaderSource = options.vertexShaderSource;
        let fragmentShaderSource = options.fragmentShaderSource;
        const attributeLocations = options.attributeLocations;

        if (typeof vertexShaderSource === 'string') {
            vertexShaderSource = new ShaderSource({
                sources: [vertexShaderSource]
            });
        }

        if (typeof fragmentShaderSource === 'string') {
            fragmentShaderSource = new ShaderSource({
                sources: [fragmentShaderSource]
            });
        }

        const vertexShaderText = vertexShaderSource.createCombinedVertexShader(
            this._context
        );
        const fragmentShaderText = fragmentShaderSource.createCombinedFragmentShader(
            this._context
        );

        const keyword =
        vertexShaderText + fragmentShaderText + JSON.stringify(attributeLocations);
        let cachedShader;

        if (defined(this._shaders[keyword])) {
            cachedShader = this._shaders[keyword];

            // No longer want to release this if it was previously released.
            delete this._shadersToRelease[keyword];
        } else {
            const context = this._context;
            const shaderProgram = new ShaderProgram({
                vertexShaderSource: vertexShaderSource,
                vertexShaderText: vertexShaderText,
                fragmentShaderSource: fragmentShaderSource,
                fragmentShaderText: fragmentShaderText,
                attributeLocations: attributeLocations
            });

            cachedShader = {
                cache: this,
                shaderProgram: shaderProgram,
                keyword: keyword,
                derivedKeywords: [],
                count: 0
            };

            // A shader can't be in more than one cache.
            shaderProgram._cachedShader = cachedShader;
            this._shaders[keyword] = cachedShader;
            ++this._numberOfShaders;
        }

        ++cachedShader.count;
        return cachedShader.shaderProgram;
    }
}

export { ShaderCache };
