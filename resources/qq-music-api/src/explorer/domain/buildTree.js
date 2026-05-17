"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExplorerTreeFromEndpoints = exports.buildExplorerTree = exports.createExplorerEndpointNode = exports.createExplorerSearchableText = exports.createExplorerGroupId = void 0;
const GROUP_ID_PREFIX = 'group:';
const normalizeSegment = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const createExplorerGroupId = (category) => `${GROUP_ID_PREFIX}${normalizeSegment(category) || 'uncategorized'}`;
exports.createExplorerGroupId = createExplorerGroupId;
const createExplorerSearchableText = (endpoint) => [endpoint.name, endpoint.category, endpoint.path, endpoint.method, endpoint.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
exports.createExplorerSearchableText = createExplorerSearchableText;
const createExplorerEndpointNode = (endpoint) => ({
    id: endpoint.id,
    type: 'endpoint',
    label: endpoint.name,
    endpointId: endpoint.id,
    category: endpoint.category,
    method: endpoint.method,
    path: endpoint.path,
    searchableText: (0, exports.createExplorerSearchableText)(endpoint),
});
exports.createExplorerEndpointNode = createExplorerEndpointNode;
const createExplorerGroupNode = (category, childIds) => ({
    id: (0, exports.createExplorerGroupId)(category),
    type: 'group',
    label: category,
    childIds,
    isExpanded: true,
    itemCount: childIds.length,
});
const buildExplorerTree = (metadata) => {
    const groupOrder = [];
    const groupLabels = new Map();
    const groupChildren = new Map();
    const endpointMap = {};
    for (const endpoint of metadata.endpoints) {
        const groupId = (0, exports.createExplorerGroupId)(endpoint.category);
        const childIds = groupChildren.get(groupId);
        if (!childIds) {
            groupOrder.push(groupId);
            groupLabels.set(groupId, endpoint.category);
            groupChildren.set(groupId, []);
        }
        groupChildren.get(groupId)?.push(endpoint.id);
        endpointMap[endpoint.id] = (0, exports.createExplorerEndpointNode)(endpoint);
    }
    const groupMap = groupOrder.reduce((accumulator, groupId) => {
        const category = groupLabels.get(groupId) || 'Uncategorized';
        const childIds = groupChildren.get(groupId) || [];
        accumulator[groupId] = createExplorerGroupNode(category, childIds);
        return accumulator;
    }, {});
    const visibleNodeIds = groupOrder.flatMap((groupId) => [groupId, ...groupMap[groupId].childIds]);
    return {
        groupOrder,
        groupMap,
        endpointMap,
        visibleNodeIds,
    };
};
exports.buildExplorerTree = buildExplorerTree;
const buildExplorerTreeFromEndpoints = (endpoints, metadata = {
    title: '',
    description: '',
}) => (0, exports.buildExplorerTree)({
    ...metadata,
    endpoints,
});
exports.buildExplorerTreeFromEndpoints = buildExplorerTreeFromEndpoints;
