"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSearchKeyword = void 0;
const helpers_1 = require("./helpers");
const updateSearchKeyword = (store, searchKeyword) => {
    store.updateState((state) => (0, helpers_1.syncVisibleTreeState)({
        ...state,
        viewState: {
            ...state.viewState,
            searchKeyword,
        },
    }));
};
exports.updateSearchKeyword = updateSearchKeyword;
