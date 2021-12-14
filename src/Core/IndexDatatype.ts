import { CesiumMath } from './CesiumMath';
import { defined } from './defined';
import { DeveloperError } from './DeveloperError';

const IndexDatatype = {
    createTypedArray: function (
        numberOfVertices: number,
        indicesLengthOrArray: number
    ): Uint32Array | Uint16Array {
        // >>includeStart('debug', pragmas.debug);
        if (!defined(numberOfVertices)) {
            throw new DeveloperError('numberOfVertices is required.');
        }
        // >>includeEnd('debug');

        if (numberOfVertices >= CesiumMath.SIXTY_FOUR_KILOBYTES) {
            return new Uint32Array(indicesLengthOrArray);
        }

        return new Uint16Array(indicesLengthOrArray);
    }
};
export { IndexDatatype };
