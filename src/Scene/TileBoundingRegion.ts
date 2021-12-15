import { BoundingSphere } from '@/Core/BoundingSphere';
import { Cartesian3 } from '@/Core/Cartesian3';
import { Cartographic } from '@/Core/Cartographic';
import { defaultValue } from '@/Core/defaultValue';
import { Ellipsoid } from '@/Core/Ellipsoid';
import { IntersectionTests } from '@/Core/IntersectionTests';
import { OrientedBoundingBox } from '@/Core/OrientedBoundingBox';
import { Plane } from '@/Core/Plane';
import { Ray } from '@/Core/Ray';
import { Rectangle } from '@/Core/Rectangle';

const cartesian3Scratch = new Cartesian3();
const cartesian3Scratch2 = new Cartesian3();
const cartesian3Scratch3 = new Cartesian3();
const eastWestNormalScratch = new Cartesian3();
const westernMidpointScratch = new Cartesian3();
const easternMidpointScratch = new Cartesian3();
const cartographicScratch = new Cartographic();
const planeScratch = new Plane(Cartesian3.UNIT_X, 0.0);
const rayScratch = new Ray();

function computeBox (tileBB: TileBoundingRegion, rectangle:Rectangle, ellipsoid:Ellipsoid) {
    ellipsoid.cartographicToCartesian(
        Rectangle.southwest(rectangle),
        tileBB.southwestCornerCartesian
    );
    ellipsoid.cartographicToCartesian(
        Rectangle.northeast(rectangle),
        tileBB.northeastCornerCartesian
    );

    // The middle latitude on the western edge.
    cartographicScratch.longitude = rectangle.west;
    cartographicScratch.latitude = (rectangle.south + rectangle.north) * 0.5;
    cartographicScratch.height = 0.0;
    const westernMidpointCartesian = ellipsoid.cartographicToCartesian(
        cartographicScratch,
        westernMidpointScratch
    );

    // Compute the normal of the plane on the western edge of the tile.
    const westNormal = Cartesian3.cross(
        westernMidpointCartesian,
        Cartesian3.UNIT_Z,
        cartesian3Scratch
    );
    Cartesian3.normalize(westNormal, tileBB.westNormal);

    // The middle latitude on the eastern edge.
    cartographicScratch.longitude = rectangle.east;
    const easternMidpointCartesian = ellipsoid.cartographicToCartesian(
        cartographicScratch,
        easternMidpointScratch
    );

    // Compute the normal of the plane on the eastern edge of the tile.
    const eastNormal = Cartesian3.cross(
        Cartesian3.UNIT_Z,
        easternMidpointCartesian,
        cartesian3Scratch
    );
    Cartesian3.normalize(eastNormal, tileBB.eastNormal);

    // Compute the normal of the plane bounding the southern edge of the tile.
    const westVector = Cartesian3.subtract(
        westernMidpointCartesian,
        easternMidpointCartesian,
        cartesian3Scratch
    );
    const eastWestNormal = Cartesian3.normalize(westVector, eastWestNormalScratch);

    const south = rectangle.south;
    let southSurfaceNormal: any;

    if (south > 0.0) {
    // Compute a plane that doesn't cut through the tile.
        cartographicScratch.longitude = (rectangle.west + rectangle.east) * 0.5;
        cartographicScratch.latitude = south;
        const southCenterCartesian = ellipsoid.cartographicToCartesian(
            cartographicScratch,
            rayScratch.origin
        );
        Cartesian3.clone(eastWestNormal, rayScratch.direction);
        const westPlane = Plane.fromPointNormal(
            tileBB.southwestCornerCartesian,
            tileBB.westNormal,
            planeScratch
        );
        // Find a point that is on the west and the south planes
        IntersectionTests.rayPlane(
            rayScratch,
            westPlane,
            tileBB.southwestCornerCartesian
        );
        southSurfaceNormal = ellipsoid.geodeticSurfaceNormal(
            southCenterCartesian,
            cartesian3Scratch2
        );
    } else {
        southSurfaceNormal = ellipsoid.geodeticSurfaceNormalCartographic(
            Rectangle.southeast(rectangle),
            cartesian3Scratch2
        );
    }
    const southNormal = Cartesian3.cross(
        southSurfaceNormal,
        westVector,
        cartesian3Scratch3
    );
    Cartesian3.normalize(southNormal, tileBB.southNormal);

    // Compute the normal of the plane bounding the northern edge of the tile.
    const north = rectangle.north;
    let northSurfaceNormal: any;
    if (north < 0.0) {
    // Compute a plane that doesn't cut through the tile.
        cartographicScratch.longitude = (rectangle.west + rectangle.east) * 0.5;
        cartographicScratch.latitude = north;
        const northCenterCartesian = ellipsoid.cartographicToCartesian(
            cartographicScratch,
            rayScratch.origin
        );
        Cartesian3.negate(eastWestNormal, rayScratch.direction);
        const eastPlane = Plane.fromPointNormal(
            tileBB.northeastCornerCartesian,
            tileBB.eastNormal,
            planeScratch
        );
        // Find a point that is on the east and the north planes
        IntersectionTests.rayPlane(
            rayScratch,
            eastPlane,
            tileBB.northeastCornerCartesian
        );
        northSurfaceNormal = ellipsoid.geodeticSurfaceNormal(
            northCenterCartesian,
            cartesian3Scratch2
        );
    } else {
        northSurfaceNormal = ellipsoid.geodeticSurfaceNormalCartographic(
            Rectangle.northwest(rectangle),
            cartesian3Scratch2
        );
    }
    const northNormal = Cartesian3.cross(
        westVector,
        northSurfaceNormal,
        cartesian3Scratch3
    );
    Cartesian3.normalize(northNormal, tileBB.northNormal);
}

class TileBoundingRegion {
    rectangle: Rectangle;
    minimumHeight: number;
    maximumHeight: number;
    southwestCornerCartesian: Cartesian3;
    northeastCornerCartesian: Cartesian3;
    westNormal: Cartesian3;
    southNormal: Cartesian3;
    eastNormal: Cartesian3;
    northNormal: Cartesian3;
    _orientedBoundingBox?: OrientedBoundingBox;
    _boundingSphere?: BoundingSphere;
    constructor (options: {
        rectangle: Rectangle;
        minimumHeight?: number;
        maximumHeight?: number;
        ellipsoid?: Ellipsoid;
        computeBoundingVolumes?: boolean;
    }) {
        this.rectangle = Rectangle.clone(options.rectangle) as Rectangle;
        this.minimumHeight = defaultValue(options.minimumHeight, 0.0) as number;
        this.maximumHeight = defaultValue(options.maximumHeight, 0.0) as number;

        /**
         * The world coordinates of the southwest corner of the tile's rectangle.
         *
         * @type {Cartesian3}
         * @default Cartesian3()
         */
        this.southwestCornerCartesian = new Cartesian3();

        /**
         * The world coordinates of the northeast corner of the tile's rectangle.
         *
         * @type {Cartesian3}
         * @default Cartesian3()
         */
        this.northeastCornerCartesian = new Cartesian3();

        /**
         * A normal that, along with southwestCornerCartesian, defines a plane at the western edge of
         * the tile.  Any position above (in the direction of the normal) this plane is outside the tile.
         *
         * @type {Cartesian3}
         * @default Cartesian3()
         */
        this.westNormal = new Cartesian3();

        /**
         * A normal that, along with southwestCornerCartesian, defines a plane at the southern edge of
         * the tile.  Any position above (in the direction of the normal) this plane is outside the tile.
         * Because points of constant latitude do not necessary lie in a plane, positions below this
         * plane are not necessarily inside the tile, but they are close.
         *
         * @type {Cartesian3}
         * @default Cartesian3()
         */
        this.southNormal = new Cartesian3();

        /**
         * A normal that, along with northeastCornerCartesian, defines a plane at the eastern edge of
         * the tile.  Any position above (in the direction of the normal) this plane is outside the tile.
         *
         * @type {Cartesian3}
         * @default Cartesian3()
         */
        this.eastNormal = new Cartesian3();

        /**
         * A normal that, along with northeastCornerCartesian, defines a plane at the eastern edge of
         * the tile.  Any position above (in the direction of the normal) this plane is outside the tile.
         * Because points of constant latitude do not necessary lie in a plane, positions below this
         * plane are not necessarily inside the tile, but they are close.
         *
         * @type {Cartesian3}
         * @default Cartesian3()
         */
        this.northNormal = new Cartesian3();

        const ellipsoid = defaultValue(options.ellipsoid, Ellipsoid.WGS84) as Ellipsoid;
        computeBox(this, options.rectangle, ellipsoid);

        this._orientedBoundingBox = undefined;
        this._boundingSphere = undefined;

        if (defaultValue(options.computeBoundingVolumes, true)) {
            this.computeBoundingVolumes(ellipsoid);
        }
    }

    computeBoundingVolumes (ellipsoid: Ellipsoid): void {
        // An oriented bounding box that encloses this tile's region.  This is used to calculate tile visibility.
        this._orientedBoundingBox = OrientedBoundingBox.fromRectangle(
            this.rectangle,
            this.minimumHeight,
            this.maximumHeight,
            ellipsoid
        );

        this._boundingSphere = BoundingSphere.fromOrientedBoundingBox(
            this._orientedBoundingBox
        );
    }
}

export { TileBoundingRegion };
