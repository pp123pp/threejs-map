/* eslint-disable no-bitwise */
import { defaultValue } from './../core/defaultValue';
import { defined } from './../core/defined';
import { DeveloperError } from './../core/DeveloperError';
import { createVerticesFromHeightmap } from './createVerticesFromHeightmap';
import { GeographicProjection } from './GeographicProjection';
import { Rectangle } from './Rectangle';
import { TerrainEncoding } from './TerrainEncoding';
import { TerrainMesh } from './TerrainMesh';
import { TerrainProvider } from './TerrainProvider';
import when from 'when';
import { GeographicTilingScheme } from './GeographicTilingScheme';

class HeightmapTerrainData {
    _buffer: any;
    _width: any;
    _height: any;
    _childTileMask: number;
    _createdByUpsampling: boolean;
    _skirtHeight?: number
    _mesh?: any
    _structure?: any
    constructor (options:any) {
        this._buffer = options.buffer;
        this._width = options.width;
        this._height = options.height;
        this._childTileMask = defaultValue(options.childTileMask, 15);

        this._createdByUpsampling = defaultValue(options.createdByUpsampling, false);
    }

    /**
     * Creates a {@link TerrainMesh} from this terrain data.
     *
     * @private
     *
     * @param {TilingScheme} tilingScheme The tiling scheme to which this tile belongs.
     * @param {Number} x The X coordinate of the tile for which to create the terrain data.
     * @param {Number} y The Y coordinate of the tile for which to create the terrain data.
     * @param {Number} level The level of the tile for which to create the terrain data.
     * @param {Number} [exaggeration=1.0] The scale used to exaggerate the terrain.
     * @returns {Promise.<TerrainMesh>|undefined} A promise for the terrain mesh, or undefined if too many
     *          asynchronous mesh creations are already in progress and the operation should
     *          be retried later.
     */
    createMesh (tilingScheme:GeographicTilingScheme, x: number, y: number, level: number, exaggeration = 1.0): when.Promise<TerrainMesh | undefined> {
        // >>includeStart('debug', pragmas.debug);
        if (!defined(tilingScheme)) {
            throw new DeveloperError('tilingScheme is required.');
        }
        if (!defined(x)) {
            throw new DeveloperError('x is required.');
        }
        if (!defined(y)) {
            throw new DeveloperError('y is required.');
        }
        if (!defined(level)) {
            throw new DeveloperError('level is required.');
        }
        // >>includeEnd('debug');

        const ellipsoid = tilingScheme.ellipsoid;
        // 计算矩形区域
        const nativeRectangle = tilingScheme.tileXYToNativeRectangle(x, y, level);
        const rectangle = tilingScheme.tileXYToRectangle(x, y, level);
        exaggeration = defaultValue(exaggeration, 1.0);

        // Compute the center of the tile for RTC rendering.
        // 计算矩形区域的中心点坐标
        const center = ellipsoid.cartographicToCartesian(Rectangle.center(rectangle));

        const structure = this._structure;

        // 计算第0级别的最大几何误差
        const levelZeroMaxError = TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(ellipsoid, this._width, tilingScheme.getNumberOfXTilesAtLevel(0));
        // 当前级别的集合误差
        const thisLevelMaxError = levelZeroMaxError / (1 << level);
        // 裙边
        this._skirtHeight = Math.min(thisLevelMaxError * 4.0, 1000.0);

        // var verticesPromise = taskProcessor.scheduleTask({
        //     heightmap : this._buffer,
        //     structure : structure,
        //     includeWebMercatorT : true,
        //     width : this._width,
        //     height : this._height,
        //     nativeRectangle : nativeRectangle,
        //     rectangle : rectangle,
        //     relativeToCenter : center,
        //     ellipsoid : ellipsoid,
        //     skirtHeight : this._skirtHeight,
        //     isGeographic : tilingScheme.projection instanceof GeographicProjection,
        //     exaggeration : exaggeration
        // });

        const verticesPromise = createVerticesFromHeightmap({
            heightmap: this._buffer,
            structure: structure,
            includeWebMercatorT: true,
            width: this._width,
            height: this._height,
            nativeRectangle: nativeRectangle,
            rectangle: rectangle,
            relativeToCenter: center,
            ellipsoid: ellipsoid,
            skirtHeight: this._skirtHeight,
            isGeographic: tilingScheme.projection instanceof GeographicProjection,
            exaggeration: exaggeration
        });

        if (!defined(verticesPromise)) {
            // Postponed
            return undefined;
        }

        const that = this;
        return when(verticesPromise, function (result) {
            that._mesh = new TerrainMesh(
                center,
                new Float32Array(result.vertices),
                TerrainProvider.getRegularGridIndices(result.gridWidth, result.gridHeight),
                result.minimumHeight,
                result.maximumHeight,
                result.boundingSphere3D,
                result.occludeePointInScaledSpace,
                result.numberOfAttributes,
                result.orientedBoundingBox,
                TerrainEncoding.clone(result.encoding),
                exaggeration
            );

            that._mesh.levelId = `${level}/${x}/${y}`;
            // Free memory received from server after mesh is created.
            that._buffer = undefined;
            return that._mesh;
        });
    }

    /**
     * Gets a value indicating whether or not this terrain data was created by upsampling lower resolution
     * terrain data.  If this value is false, the data was obtained from some other source, such
     * as by downloading it from a remote server.  This method should return true for instances
     * returned from a call to {@link HeightmapTerrainData#upsample}.
     *
     * @returns {Boolean} True if this instance was created by upsampling; otherwise, false.
     */
    wasCreatedByUpsampling () {
        return this._createdByUpsampling;
    }

    /**
     * Determines if a given child tile is available, based on the
     * {@link HeightmapTerrainData.childTileMask}.  The given child tile coordinates are assumed
     * to be one of the four children of this tile.  If non-child tile coordinates are
     * given, the availability of the southeast child tile is returned.
     *
     * @param {Number} thisX The tile X coordinate of this (the parent) tile.
     * @param {Number} thisY The tile Y coordinate of this (the parent) tile.
     * @param {Number} childX The tile X coordinate of the child tile to check for availability.
     * @param {Number} childY The tile Y coordinate of the child tile to check for availability.
     * @returns {Boolean} True if the child tile is available; otherwise, false.
     */
    isChildAvailable (thisX, thisY, childX, childY) {
        // >>includeStart('debug', pragmas.debug);
        if (!defined(thisX)) {
            throw new DeveloperError('thisX is required.');
        }
        if (!defined(thisY)) {
            throw new DeveloperError('thisY is required.');
        }
        if (!defined(childX)) {
            throw new DeveloperError('childX is required.');
        }
        if (!defined(childY)) {
            throw new DeveloperError('childY is required.');
        }
        // >>includeEnd('debug');

        let bitNumber = 2; // northwest child
        if (childX !== thisX * 2) {
            ++bitNumber; // east child
        }
        if (childY !== thisY * 2) {
            bitNumber -= 2; // south child
        }

        return (this._childTileMask & 1 << bitNumber) !== 0;
    }
}

export { HeightmapTerrainData };
