"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectEndpoint = void 0;
const domain_1 = require("../../domain");
const helpers_1 = require("./helpers");
const selectEndpoint = (store, endpointId) => {
    store.updateState((state) => {
        const requestedEndpoint = (0, helpers_1.getEndpointByIdFromState)(state, endpointId);
        if (!requestedEndpoint) {
            return state;
        }
        const nextState = (0, helpers_1.syncVisibleTreeState)({
            ...state,
            viewState: {
                ...state.viewState,
                activeEndpointId: endpointId,
            },
        });
        return {
            ...nextState,
            requestState: (0, domain_1.createExplorerRequestState)(requestedEndpoint),
        };
    });
};
exports.selectEndpoint = selectEndpoint;
