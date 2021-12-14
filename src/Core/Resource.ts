
import { defaultValue } from './defaultValue';
import { defined } from './defined';
import { clone } from './clone';
import { combine } from './combine';
import { getAbsoluteUri } from './getAbsoluteUri';
import { getExtensionFromUri } from './getExtensionFromUri';
import { isBlobUri } from './isBlobUri';
import { isCrossOriginUrl } from './isCrossOriginUrl';
import { isDataUri } from './isDataUri';
import { objectToQuery } from './objectToQuery';
import { queryToObject } from './queryToObject';
import { Request } from './Request';
import { RequestScheduler } from './RequestScheduler';
import { RequestState } from './RequestState';
import { RuntimeError } from './RuntimeError';
import { TrustedServers } from './TrustedServers';
import { URI as Uri } from './../ThirdParty/Uri';
import when from 'when';
import { Static } from 'vue';

const xhrBlobSupported = (function () {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '#', true);
        xhr.responseType = 'blob';
        return xhr.responseType === 'blob';
    } catch (e) {
        return false;
    }
}());

/**
 * Parses a query string and returns the object equivalent.
 *
 * @param {Uri} uri The Uri with a query object.
 * @param {Resource} resource The Resource that will be assigned queryParameters.
 * @param {Boolean} merge If true, we'll merge with the resource's existing queryParameters. Otherwise they will be replaced.
 * @param {Boolean} preserveQueryParameters If true duplicate parameters will be concatenated into an array. If false, keys in uri will take precedence.
 *
 * @private
 */
function parseQuery (uri:Uri, resource:Resource, merge: boolean, preserveQueryParameters?: boolean) {
    const queryString = uri.query;
    if (!defined(queryString) || queryString.length === 0) {
        return {};
    }

    let query;
    // Special case we run into where the querystring is just a string, not key/value pairs
    if (queryString.indexOf('=') === -1) {
        const result = {};
        result[queryString] = undefined;
        query = result;
    } else {
        query = queryToObject(queryString);
    }

    if (merge) {
        resource._queryParameters = combineQueryParameters(query, resource._queryParameters, preserveQueryParameters);
    } else {
        resource._queryParameters = query;
    }
    uri.query = undefined;
}

/**
 * Converts a query object into a string.
 *
 * @param {Uri} uri The Uri object that will have the query object set.
 * @param {Resource} resource The resource that has queryParameters
 *
 * @private
 */
function stringifyQuery (uri:Uri, resource:Resource) {
    const queryObject = resource._queryParameters;

    const keys = Object.keys(queryObject);

    // We have 1 key with an undefined value, so this is just a string, not key/value pairs
    if (keys.length === 1 && !defined(queryObject[keys[0]])) {
        uri.query = keys[0];
    } else {
        uri.query = objectToQuery(queryObject);
    }
}

/**
 * Clones a value if it is defined, otherwise returns the default value
 *
 * @param {*} [val] The value to clone.
 * @param {*} [defaultVal] The default value.
 *
 * @returns {*} A clone of val or the defaultVal.
 *
 * @private
 */
function defaultClone (val: any, defaultVal: any) {
    if (!defined(val)) {
        return defaultVal;
    }

    return defined(val.clone)
        ? val.clone()
        : clone(val);
}

/**
 * Checks to make sure the Resource isn't already being requested.
 *
 * @param {Request} request The request to check.
 *
 * @private
 */
function checkAndResetRequest (request:Request) {
    if (request.state === RequestState.ISSUED || request.state === RequestState.ACTIVE) {
        throw new RuntimeError('The Resource is already being fetched.');
    }

    request.state = RequestState.UNISSUED;
    request.deferred = undefined;
}

/**
 * This combines a map of query parameters.
 *
 * @param {Object} q1 The first map of query parameters. Values in this map will take precedence if preserveQueryParameters is false.
 * @param {Object} q2 The second map of query parameters.
 * @param {Boolean} preserveQueryParameters If true duplicate parameters will be concatenated into an array. If false, keys in q1 will take precedence.
 *
 * @returns {Object} The combined map of query parameters.
 *
 * @example
 * var q1 = {
 *   a: 1,
 *   b: 2
 * };
 * var q2 = {
 *   a: 3,
 *   c: 4
 * };
 * var q3 = {
 *   b: [5, 6],
 *   d: 7
 * }
 *
 * // Returns
 * // {
 * //   a: [1, 3],
 * //   b: 2,
 * //   c: 4
 * // };
 * combineQueryParameters(q1, q2, true);
 *
 * // Returns
 * // {
 * //   a: 1,
 * //   b: 2,
 * //   c: 4
 * // };
 * combineQueryParameters(q1, q2, false);
 *
 * // Returns
 * // {
 * //   a: 1,
 * //   b: [2, 5, 6],
 * //   d: 7
 * // };
 * combineQueryParameters(q1, q3, true);
 *
 * // Returns
 * // {
 * //   a: 1,
 * //   b: 2,
 * //   d: 7
 * // };
 * combineQueryParameters(q1, q3, false);
 *
 * @private
 */
function combineQueryParameters (q1: any, q2: any, preserveQueryParameters: any) {
    if (!preserveQueryParameters) {
        return combine(q1, q2);
    }

    const result = clone(q1, true);
    for (const param in q2) {
        // if (q2.hasOwnProperty(param)) {
        if (Object.prototype.hasOwnProperty.call(q2, param)) {
            let value = result[param];
            const q2Value = q2[param];
            if (defined(value)) {
                if (!Array.isArray(value)) {
                    value = result[param] = [value];
                }

                result[param] = value.concat(q2Value);
            } else {
                result[param] = Array.isArray(q2Value)
                    ? q2Value.slice()
                    : q2Value;
            }
        }
    }

    return result;
}

/**
 * A resource that includes the location and any other parameters we need to retrieve it or create derived resources. It also provides the ability to retry requests.
 *
 * @alias Resource
 * @constructor
 *
 * @param {String|Object} options A url or an object with the following properties
 * @param {String} options.url The url of the resource.
 * @param {Object} [options.queryParameters] An object containing query parameters that will be sent when retrieving the resource.
 * @param {Object} [options.templateValues] Key/Value pairs that are used to replace template values (eg. {x}).
 * @param {Object} [options.headers={}] Additional HTTP headers that will be sent.
 * @param {DefaultProxy} [options.proxy] A proxy to be used when loading the resource.
 * @param {Resource~RetryCallback} [options.retryCallback] The Function to call when a request for this resource fails. If it returns true, the request will be retried.
 * @param {Number} [options.retryAttempts=0] The number of times the retryCallback should be called before giving up.
 * @param {Request} [options.request] A Request object that will be used. Intended for internal use only.
 *
 * @example
 * function refreshTokenRetryCallback(resource, error) {
 *   if (error.statusCode === 403) {
 *     // 403 status code means a new token should be generated
 *     return getNewAccessToken()
 *       .then(function(token) {
 *         resource.queryParameters.access_token = token;
 *         return true;
 *       })
 *       .otherwise(function() {
 *         return false;
 *       });
 *   }
 *
 *   return false;
 * }
 *
 * var resource = new Resource({
 *    url: 'http://server.com/path/to/resourceon',
 *    proxy: new DefaultProxy('/proxy/'),
 *    headers: {
 *      'X-My-Header': 'valueOfHeader'
 *    },
 *    queryParameters: {
 *      'access_token': '123-435-456-000'
 *    },
 *    retryCallback: refreshTokenRetryCallback,
 *    retryAttempts: 1
 * });
 */

interface ResourceOptions {
    templateValues?: { [name: string]: any };
    queryParameters?: { [name: string]: any };
    headers?: { [name: string]: any };
    request?: Request;
    proxy?: any;
    retryCallback?: any;
    retryAttempts?: number;
    url?: string
}

class Resource {
    _url?: string;
    _templateValues: { [name: string]: any };
    _queryParameters: { [name: string]: any };
    headers: { [name: string]: any };
    request: Request;
    proxy: any
    retryCallback?: any;
    retryAttempts: number;
    _retryCount: number;
    constructor (options: ResourceOptions | string) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        if (typeof options === 'string') {
            options = {
                url: options
            };
        }

        this._url = undefined;
        this._templateValues = defaultClone(options.templateValues, {});
        this._queryParameters = defaultClone(options.queryParameters, {});

        /**
         * Additional HTTP headers that will be sent with the request.
         *
         * @type {Object}
         */
        this.headers = defaultClone(options.headers, {});

        /**
         * A Request object that will be used. Intended for internal use only.
         *
         * @type {Request}
         */
        this.request = defaultValue(options.request, new Request()) as Request;

        /**
         * A proxy to be used when loading the resource.
         *
         * @type {Proxy}
         */
        this.proxy = options.proxy;

        /**
         * Function to call when a request for this resource fails. If it returns true or a Promise that resolves to true, the request will be retried.
         *
         * @type {Function}
         */
        this.retryCallback = options.retryCallback;

        /**
         * The number of times the retryCallback should be called before giving up.
         *
         * @type {Number}
         */
        this.retryAttempts = defaultValue(options.retryAttempts, 0) as number;
        this._retryCount = 0;

        const uri = new Uri(options.url);
        parseQuery(uri, this, true, true);

        // Remove the fragment as it's not sent with a request
        uri.fragment = undefined;

        this._url = uri.toString();
    }

    get queryParameters (): any {
        return this._queryParameters;
    }

    get templateValues (): any {
        return this._templateValues;
    }

    get url (): string {
        return this.getUrlComponent(true, true);
    }

    set url (value: string) {
        const uri = new Uri(value);

        parseQuery(uri, this, false);

        // Remove the fragment as it's not sent with a request
        uri.fragment = undefined;

        this._url = uri.toString();
    }

    get extension (): string {
        return getExtensionFromUri(this._url as string);
    }

    get isDataUri (): boolean {
        return isDataUri(this._url as string);
    }

    /**
 * Returns the url, optional with the query string and processed by a proxy.
 *
 * @param {Boolean} [query=false] If true, the query string is included.
 * @param {Boolean} [proxy=false] If true, the url is processed by the proxy object, if defined.
 *
 * @returns {String} The url with all the requested components.
 */
    getUrlComponent (query = false, proxy = false): string {
        if (this.isDataUri) {
            return this._url as string;
        }

        const uri = new Uri(this._url);

        if (query) {
            stringifyQuery(uri, this);
        }

        // objectToQuery escapes the placeholders.  Undo that.
        let url = uri.toString().replace(/%7B/g, '{').replace(/%7D/g, '}');

        const templateValues = this._templateValues;
        url = url.replace(/{(.*?)}/g, function (match: any, key: any) {
            const replacement = templateValues[key];
            if (defined(replacement)) {
                // use the replacement value from templateValues if there is one...
                return encodeURIComponent(replacement);
            }
            // otherwise leave it unchanged
            return match;
        });

        if (proxy && defined(this.proxy)) {
            url = this.proxy.getURL(url);
        }
        return url;
    }

    /**
     * Duplicates a Resource instance.
     *
     * @param {Resource} [result] The object onto which to store the result.
     *
     * @returns {Resource} The modified result parameter or a new Resource instance if one was not provided.
     */
    clone (result?: Resource): Resource {
        if (!defined(result)) {
            result = new Resource({
                url: this._url
            });
        }

        (result as Resource)._url = this._url;
        (result as Resource)._queryParameters = clone(this._queryParameters);
        (result as Resource)._templateValues = clone(this._templateValues);
        (result as Resource).headers = clone(this.headers);
        (result as Resource).proxy = this.proxy;
        (result as Resource).retryCallback = this.retryCallback;
        (result as Resource).retryAttempts = this.retryAttempts;
        (result as Resource)._retryCount = 0;
        (result as Resource).request = this.request.clone();

        return (result as Resource);
    }

    /**
     * Returns a resource relative to the current instance. All properties remain the same as the current instance unless overridden in options.
     *
     * @param {Object} options An object with the following properties
     * @param {String} [options.url]  The url that will be resolved relative to the url of the current instance.
     * @param {Object} [options.queryParameters] An object containing query parameters that will be combined with those of the current instance.
     * @param {Object} [options.templateValues] Key/Value pairs that are used to replace template values (eg. {x}). These will be combined with those of the current instance.
     * @param {Object} [options.headers={}] Additional HTTP headers that will be sent.
     * @param {Proxy} [options.proxy] A proxy to be used when loading the resource.
     * @param {Resource.RetryCallback} [options.retryCallback] The function to call when loading the resource fails.
     * @param {Number} [options.retryAttempts] The number of times the retryCallback should be called before giving up.
     * @param {Request} [options.request] A Request object that will be used. Intended for internal use only.
     * @param {Boolean} [options.preserveQueryParameters=false] If true, this will keep all query parameters from the current resource and derived resource. If false, derived parameters will replace those of the current resource.
     *
     * @returns {Resource} The resource derived from the current one.
     */
    getDerivedResource (options: {
        url?: string;
        queryParameters?: any;
        templateValues?: any;
        headers?: any;
        retryCallback?: any;
        retryAttempts?: number;
        request?: any;
        proxy?: any;
        preserveQueryParameters?: boolean;
    }):Resource {
        const resource = this.clone();
        resource._retryCount = 0;

        if (defined(options.url)) {
            const uri = new Uri(options.url);

            const preserveQueryParameters = defaultValue(
                options.preserveQueryParameters,
                false
            ) as boolean;
            parseQuery(uri, resource, true, preserveQueryParameters);

            // Remove the fragment as it's not sent with a request
            uri.fragment = undefined;

            resource._url = uri.resolve(new Uri(getAbsoluteUri(this._url as string))).toString();
        }

        if (defined(options.queryParameters)) {
            resource._queryParameters = combine(
                options.queryParameters,
                resource._queryParameters
            );
        }
        if (defined(options.templateValues)) {
            resource._templateValues = combine(
                options.templateValues,
                resource.templateValues
            );
        }
        if (defined(options.headers)) {
            resource.headers = combine(options.headers, resource.headers);
        }
        if (defined(options.proxy)) {
            resource.proxy = options.proxy;
        }
        if (defined(options.request)) {
            resource.request = options.request;
        }
        if (defined(options.retryCallback)) {
            resource.retryCallback = options.retryCallback;
        }
        if (defined(options.retryAttempts)) {
            resource.retryAttempts = options.retryAttempts as number;
        }

        return resource;
    }

    /**
     * A helper function to create a resource depending on whether we have a String or a Resource
     *
     * @param {Resource|String} resource A Resource or a String to use when creating a new Resource.
     *
     * @returns {Resource} If resource is a String, a Resource constructed with the url and options. Otherwise the resource parameter is returned.
     *
     * @private
     */
    static createIfNeeded (resource: Resource | string) :Resource {
        if (resource instanceof Resource) {
            // Keep existing request object. This function is used internally to duplicate a Resource, so that it can't
            //  be modified outside of a class that holds it (eg. an imagery or terrain provider). Since the Request objects
            //  are managed outside of the providers, by the tile loading code, we want to keep the request property the same so if it is changed
            //  in the underlying tiling code the requests for this resource will use it.
            return resource.getDerivedResource({
                request: resource.request
            });
        }

        if (typeof resource !== 'string') {
            return resource;
        }

        return new Resource({
            url: resource
        });
    }

    /**
     * Combines the specified object and the existing query parameters. This allows you to add many parameters at once,
     *  as opposed to adding them one at a time to the queryParameters property. If a value is already set, it will be replaced with the new value.
     *
     * @param {Object} params The query parameters
     * @param {Boolean} [useAsDefault=false] If true the params will be used as the default values, so they will only be set if they are undefined.
     */
    setQueryParameters (params: any, useAsDefault = false): void {
        if (useAsDefault) {
            this._queryParameters = combineQueryParameters(
                this._queryParameters,
                params,
                false
            );
        } else {
            this._queryParameters = combineQueryParameters(
                params,
                this._queryParameters,
                false
            );
        }
    }

    /**
     * Combines the specified object and the existing template values. This allows you to add many values at once,
     *  as opposed to adding them one at a time to the templateValues property. If a value is already set, it will become an array and the new value will be appended.
     *
     * @param {Object} template The template values
     * @param {Boolean} [useAsDefault=false] If true the values will be used as the default values, so they will only be set if they are undefined.
     */
    setTemplateValues (template: any, useAsDefault = false): void {
        if (useAsDefault) {
            this._templateValues = combine(this._templateValues, template);
        } else {
            this._templateValues = combine(template, this._templateValues);
        }
    }
}

export { Resource };
