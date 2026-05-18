"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const logger_1 = require("../util/logger");
const request_1 = __importDefault(require("../util/request"));
exports.default = ({ url, method = 'get', options = {}, hasCommonParams = true, }) => {
    const commonParams = hasCommonParams ? config_1.apiConfig.commonParams : {};
    const opts = Object.assign({}, options, commonParams, {
        headers: {
            referer: config_1.requestConfig.referer.c,
            host: 'c.y.qq.com',
            ...options.headers,
        },
    });
    logger_1.logger.debug(url, { opts });
    return (0, request_1.default)(url, method, opts);
};
