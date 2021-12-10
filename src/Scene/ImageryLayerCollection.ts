import { Event } from '@/Core/Event';

class ImageryLayerCollection {
    _layers: any[];
    layerAdded: Event;
    layerRemoved: Event;
    layerMoved: Event;
    layerShownOrHidden: Event;

    constructor () {
        this._layers = [];

        /**
         * An event that is raised when a layer is added to the collection.  Event handlers are passed the layer that
         * was added and the index at which it was added.
         * @type {Event}
         * @default Event()
         */
        this.layerAdded = new Event();

        /**
         * An event that is raised when a layer is removed from the collection.  Event handlers are passed the layer that
         * was removed and the index from which it was removed.
         * @type {Event}
         * @default Event()
         */
        this.layerRemoved = new Event();

        /**
         * An event that is raised when a layer changes position in the collection.  Event handlers are passed the layer that
         * was moved, its new index after the move, and its old index prior to the move.
         * @type {Event}
         * @default Event()
         */
        this.layerMoved = new Event();

        /**
         * An event that is raised when a layer is shown or hidden by setting the
         * {@link ImageryLayer#show} property.  Event handlers are passed a reference to this layer,
         * the index of the layer in the collection, and a flag that is true if the layer is now
         * shown or false if it is now hidden.
         *
         * @type {Event}
         * @default Event()
         */
        this.layerShownOrHidden = new Event();
    }
}

export { ImageryLayerCollection };
