"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleGroup = void 0;
const helpers_1 = require("./helpers");
const toggleGroup = (store, groupId) => {
    store.updateState((state) => {
        if (!state.resourceState.groupMap[groupId]) {
            return state;
        }
        const expandedGroupIdSet = new Set(state.viewState.expandedGroupIds);
        if (expandedGroupIdSet.has(groupId)) {
            expandedGroupIdSet.delete(groupId);
        }
        else {
            expandedGroupIdSet.add(groupId);
        }
        return (0, helpers_1.syncVisibleTreeState)({
            ...state,
            viewState: {
                ...state.viewState,
                expandedGroupIds: [...expandedGroupIdSet],
            },
        });
    });
};
exports.toggleGroup = toggleGroup;
