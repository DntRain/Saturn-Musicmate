"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeExplorer = void 0;
const helpers_1 = require("./helpers");
const initializeExplorer = (store, metadata) => {
    store.setState((0, helpers_1.createInitializedExplorerState)(metadata));
};
exports.initializeExplorer = initializeExplorer;
