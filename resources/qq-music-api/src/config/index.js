"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.appConfig = exports.userInfo = exports.optionsPrefix = exports.options = exports._guid = exports.commonParams = exports.apiConfig = exports.requestConfig = exports.serverConfig = void 0;
const manager_1 = require("./manager");
Object.defineProperty(exports, "configManager", { enumerable: true, get: function () { return manager_1.configManager; } });
// 触发一次初始化加载
const appConfig = manager_1.configManager.getConfig();
exports.appConfig = appConfig;
exports.serverConfig = appConfig.server;
exports.requestConfig = appConfig.request;
exports.apiConfig = appConfig.api;
exports.commonParams = appConfig.api.commonParams;
exports._guid = appConfig.api._guid;
exports.options = appConfig.api.options;
exports.optionsPrefix = appConfig.api.optionsPrefix;
exports.userInfo = appConfig.user;
