"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateApiExplorerRequestLogEntry = exports.createApiExplorerRequestLogEntry = exports.filterApiExplorerEndpoints = exports.buildApiExplorerRequest = exports.parseExplorerBody = exports.toQueryString = void 0;
const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const replacePathParams = (pathTemplate, pathValues = {}) => pathTemplate.replace(/:([A-Za-z0-9_]+)\??/g, (_match, key) => {
    const rawValue = pathValues[key];
    return rawValue ? encodeURIComponent(rawValue) : '';
});
const normalizePath = (value) => value.replace(/\/{2,}/g, '/');
const normalizeSearchKeyword = (value) => value.trim().toLowerCase();
const toQueryString = (queryValues = {}) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryValues)) {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, value);
        }
    }
    return searchParams.toString();
};
exports.toQueryString = toQueryString;
const parseExplorerBody = (bodyText) => {
    if (!bodyText?.trim()) {
        return undefined;
    }
    const parsedBody = JSON.parse(bodyText);
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
        throw new Error('Request body must be a JSON object.');
    }
    return parsedBody;
};
exports.parseExplorerBody = parseExplorerBody;
const buildApiExplorerRequest = (endpoint, options) => {
    const resolvedPath = normalizePath(replacePathParams(endpoint.path, options.pathValues));
    const queryString = (0, exports.toQueryString)(options.queryValues);
    const baseUrl = trimTrailingSlash(options.baseUrl);
    const url = `${baseUrl}${resolvedPath}${queryString ? `?${queryString}` : ''}`;
    const body = endpoint.method === 'POST' ? (0, exports.parseExplorerBody)(options.bodyText) : undefined;
    return {
        method: endpoint.method,
        url,
        body,
    };
};
exports.buildApiExplorerRequest = buildApiExplorerRequest;
const filterApiExplorerEndpoints = (endpoints, searchKeyword = '', methodFilter = 'ALL') => {
    const keyword = normalizeSearchKeyword(searchKeyword);
    return endpoints.filter((endpoint) => {
        const matchesMethod = methodFilter === 'ALL' || endpoint.method === methodFilter;
        if (!matchesMethod) {
            return false;
        }
        if (!keyword) {
            return true;
        }
        return [endpoint.name, endpoint.category, endpoint.path].some((fieldValue) => fieldValue.toLowerCase().includes(keyword));
    });
};
exports.filterApiExplorerEndpoints = filterApiExplorerEndpoints;
const createApiExplorerRequestLogEntry = (endpoint, request, options) => ({
    id: options.id,
    timestamp: options.timestamp,
    endpointId: endpoint.id,
    endpointName: endpoint.name,
    method: endpoint.method,
    url: request.url,
    requestBody: request.bodyText || '',
    status: 'pending',
    duration: null,
    responsePreview: '请求进行中...',
    errorMessage: '',
});
exports.createApiExplorerRequestLogEntry = createApiExplorerRequestLogEntry;
const updateApiExplorerRequestLogEntry = (logs, logId, patch) => logs.map((log) => (log.id === logId ? { ...log, ...patch } : log));
exports.updateApiExplorerRequestLogEntry = updateApiExplorerRequestLogEntry;
