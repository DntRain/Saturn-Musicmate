"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExplorerRequestState = exports.createExplorerLatestResponseState = exports.createExplorerContextMenuState = void 0;
const DEFAULT_RESPONSE_MESSAGE = '发送请求后在这里查看最新结果';
const toFieldValueMap = (fields) => (fields || []).reduce((accumulator, field) => {
    if (field.defaultValue !== undefined) {
        accumulator[field.key] = String(field.defaultValue);
    }
    return accumulator;
}, {});
const createExplorerContextMenuState = () => ({
    isOpen: false,
    nodeId: null,
    x: 0,
    y: 0,
});
exports.createExplorerContextMenuState = createExplorerContextMenuState;
const createExplorerLatestResponseState = () => ({
    statusText: DEFAULT_RESPONSE_MESSAGE,
    bodyText: '等待请求...',
    isError: false,
});
exports.createExplorerLatestResponseState = createExplorerLatestResponseState;
const createExplorerRequestState = (endpoint) => ({
    pathParams: toFieldValueMap(endpoint?.pathParams),
    queryParams: toFieldValueMap(endpoint?.queryParams),
    bodyText: endpoint?.bodyExample ? JSON.stringify(endpoint.bodyExample, null, 2) : '',
    previewText: '',
    isSending: false,
    latestResponse: (0, exports.createExplorerLatestResponseState)(),
});
exports.createExplorerRequestState = createExplorerRequestState;
