
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
import { URI as Uri } from './Uri';
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
function parseQuery (uri:Uri, resource:Resource, merge: boolean, preserveQueryParameters: boolean) {
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
}

export { Resource };
