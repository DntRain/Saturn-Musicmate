"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMethodFilter = void 0;
const helpers_1 = require("./helpers");
const updateMethodFilter = (store, methodFilter) => {
    store.updateState((state) => (0, helpers_1.syncVisibleTreeState)({
        ...state,
        viewState: {
            ...state.viewState,
            methodFilter,
        },
    }));
};
exports.updateMethodFilter = updateMethodFilter;
