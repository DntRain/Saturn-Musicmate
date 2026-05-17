"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVisibleExplorerNodeIds = void 0;
const matchesMethod = (method, methodFilter) => methodFilter === 'ALL' || method === methodFilter;
const getVisibleExplorerNodeIds = (options) => {
    const keyword = options.searchKeyword.trim().toLowerCase();
    const expandedGroupIdSet = new Set(options.expandedGroupIds);
    const visibleNodeIds = [];
    for (const groupId of options.groupOrder) {
        const group = options.groupMap[groupId];
        const visibleChildIds = group.childIds.filter((childId) => {
            const endpointNode = options.endpointMap[childId];
            if (!endpointNode) {
                return false;
            }
            if (!matchesMethod(endpointNode.method, options.methodFilter)) {
                return false;
            }
            if (!keyword) {
                return true;
            }
            return endpointNode.searchableText.includes(keyword);
        });
        if (!visibleChildIds.length) {
            continue;
        }
        visibleNodeIds.push(groupId);
        if (expandedGroupIdSet.has(groupId)) {
            visibleNodeIds.push(...visibleChildIds);
        }
    }
    return visibleNodeIds;
};
exports.getVisibleExplorerNodeIds = getVisibleExplorerNodeIds;
