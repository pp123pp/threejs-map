import { defaultValue } from '@/Core/defaultValue';
import { Ellipsoid } from '@/Core/Ellipsoid';
import { Event } from '@/Core/Event';
import { QuadtreeOccluders } from './QuadtreeOccluders';
import { QuadtreeTileProvider } from './QuadtreeTileProvider';
import { TileReplacementQueue } from './TileReplacementQueue';

class QuadtreePrimitive {
    _tileProvider: QuadtreeTileProvider;
    _debug: any;
    _tilesToRender: any[];
    _tileLoadQueueHigh: any[];
    _tileLoadQueueMedium: any[];
    _tileLoadQueueLow: any[];
    _tileReplacementQueue: TileReplacementQueue;
    _levelZeroTiles: any;
    _loadQueueTimeSlice: number;
    _tilesInvalidated: boolean;
    _addHeightCallbacks: any[];
    _removeHeightCallbacks: any[];

    _tileToUpdateHeights: any[];
    _lastTileIndex: number;
    _updateHeightsTimeSlice: number;

    maximumScreenSpaceError: number;

    tileCacheSize: number;
    _occluders: QuadtreeOccluders;
    _tileLoadProgressEvent: Event;
    _lastTileLoadQueueLength: number;
    constructor (options: {
        tileProvider: QuadtreeTileProvider,
        maximumScreenSpaceError?: number,
        tileCacheSize?: number
    }) {
        this._tileProvider = options.tileProvider;
        this._tileProvider.quadtree = this;

        this._debug = {
            enableDebugOutput: false,

            maxDepth: 0,
            maxDepthVisited: 0,
            tilesVisited: 0,
            tilesCulled: 0,
            tilesRendered: 0,
            tilesWaitingForChildren: 0,

            lastMaxDepth: -1,
            lastMaxDepthVisited: -1,
            lastTilesVisited: -1,
            lastTilesCulled: -1,
            lastTilesRendered: -1,
            lastTilesWaitingForChildren: -1,

            suspendLodUpdate: false
        };

        const tilingScheme = this._tileProvider.tilingScheme as any;
        const ellipsoid = tilingScheme.ellipsoid;

        this._tilesToRender = [];
        this._tileLoadQueueHigh = []; // high priority tiles are preventing refinement
        this._tileLoadQueueMedium = []; // medium priority tiles are being rendered
        this._tileLoadQueueLow = []; // low priority tiles were refined past or are non-visible parts of quads.
        this._tileReplacementQueue = new TileReplacementQueue();
        this._levelZeroTiles = undefined;
        this._loadQueueTimeSlice = 5.0;
        this._tilesInvalidated = false;

        this._addHeightCallbacks = [];
        this._removeHeightCallbacks = [];

        this._tileToUpdateHeights = [];
        this._lastTileIndex = 0;
        this._updateHeightsTimeSlice = 2.0;

        /**
         * Gets or sets the maximum screen-space error, in pixels, that is allowed.
         * A higher maximum error will render fewer tiles and improve performance, while a lower
         * value will improve visual quality.
         * @type {Number}
         * @default 2
         */
        this.maximumScreenSpaceError = defaultValue(options.maximumScreenSpaceError, 2) as number;

        /**
         * Gets or sets the maximum number of tiles that will be retained in the tile cache.
         * Note that tiles will never be unloaded if they were used for rendering the last
         * frame, so the actual number of resident tiles may be higher.  The value of
         * this property will not affect visual quality.
         * @type {Number}
         * @default 100
         */
        this.tileCacheSize = defaultValue(options.tileCacheSize, 100) as number;

        this._occluders = new QuadtreeOccluders({
            ellipsoid: ellipsoid
        });

        this._tileLoadProgressEvent = new Event();
        this._lastTileLoadQueueLength = 0;
    }
}
export { QuadtreePrimitive };
