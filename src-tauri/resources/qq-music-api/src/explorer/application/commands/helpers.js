"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVisibleEndpointCount = exports.getEndpointByIdFromState = exports.getActiveEndpoint = exports.createInitializedExplorerState = exports.createExplorerInitialState = exports.syncVisibleTreeState = void 0;
const domain_1 = require("../../domain");
const getEndpointById = (metadata, endpointId) => {
    if (!metadata || !endpointId) {
        return null;
    }
    return metadata.endpoints.find((endpoint) => endpoint.id === endpointId) || null;
};
const getVisibleEndpointIds = (state) => state.resourceState.visibleNodeIds.filter((nodeId) => Boolean(state.resourceState.endpointMap[nodeId]));
const syncVisibleTreeState = (state) => {
    const previousActiveEndpointId = state.viewState.activeEndpointId;
    const visibleNodeIds = (0, domain_1.getVisibleExplorerNodeIds)({
        endpointMap: state.resourceState.endpointMap,
        groupMap: state.resourceState.groupMap,
        groupOrder: state.resourceState.groupOrder,
        expandedGroupIds: state.viewState.expandedGroupIds,
        searchKeyword: state.viewState.searchKeyword,
        methodFilter: state.viewState.methodFilter,
    });
    let nextActiveEndpointId = state.viewState.activeEndpointId;
    const visibleEndpointIds = visibleNodeIds.filter((nodeId) => Boolean(state.resourceState.endpointMap[nodeId]));
    if (!nextActiveEndpointId || !visibleEndpointIds.includes(nextActiveEndpointId)) {
        nextActiveEndpointId = visibleEndpointIds[0] || null;
    }
    const activeEndpoint = getEndpointById(state.resourceState.metadata, nextActiveEndpointId);
    const shouldResetRequestState = previousActiveEndpointId !== nextActiveEndpointId;
    return {
        ...state,
        resourceState: {
            ...state.resourceState,
            visibleNodeIds,
        },
        viewState: {
            ...state.viewState,
            activeEndpointId: nextActiveEndpointId,
        },
        requestState: shouldResetRequestState
            ? (0, domain_1.createExplorerRequestState)(activeEndpoint)
            : state.requestState,
    };
};
exports.syncVisibleTreeState = syncVisibleTreeState;
const createExplorerInitialState = () => ({
    resourceState: {
        metadata: null,
        groupOrder: [],
        groupMap: {},
        endpointMap: {},
        visibleNodeIds: [],
    },
    viewState: {
        activeEndpointId: null,
        selectedHistoryEntryId: null,
        searchKeyword: '',
        methodFilter: 'ALL',
        expandedGroupIds: [],
        isHistoryPanelOpen: true,
        contextMenu: (0, domain_1.createExplorerContextMenuState)(),
    },
    requestState: (0, domain_1.createExplorerRequestState)(null),
    historyState: {
        sessions: {},
        entries: {},
        activeSessionId: null,
        orderedEntryIds: [],
    },
});
exports.createExplorerInitialState = createExplorerInitialState;
const createInitializedExplorerState = (metadata) => {
    const tree = (0, domain_1.buildExplorerTree)(metadata);
    const firstEndpointId = metadata.endpoints.find((endpoint) => Boolean(tree.endpointMap[endpoint.id]))?.id || null;
    const firstEndpoint = getEndpointById(metadata, firstEndpointId);
    return {
        resourceState: {
            metadata,
            groupOrder: tree.groupOrder,
            groupMap: tree.groupMap,
            endpointMap: tree.endpointMap,
            visibleNodeIds: tree.visibleNodeIds,
        },
        viewState: {
            activeEndpointId: firstEndpointId,
            selectedHistoryEntryId: null,
            searchKeyword: '',
            methodFilter: 'ALL',
            expandedGroupIds: tree.groupOrder,
            isHistoryPanelOpen: true,
            contextMenu: (0, domain_1.createExplorerContextMenuState)(),
        },
        requestState: (0, domain_1.createExplorerRequestState)(firstEndpoint),
        historyState: {
            sessions: {},
            entries: {},
            activeSessionId: null,
            orderedEntryIds: [],
        },
    };
};
exports.createInitializedExplorerState = createInitializedExplorerState;
const getActiveEndpoint = (state) => getEndpointById(state.resourceState.metadata, state.viewState.activeEndpointId);
exports.getActiveEndpoint = getActiveEndpoint;
const getEndpointByIdFromState = (state, endpointId) => getEndpointById(state.resourceState.metadata, endpointId);
exports.getEndpointByIdFromState = getEndpointByIdFromState;
const getVisibleEndpointCount = (state) => getVisibleEndpointIds(state).length;
exports.getVisibleEndpointCount = getVisibleEndpointCount;
