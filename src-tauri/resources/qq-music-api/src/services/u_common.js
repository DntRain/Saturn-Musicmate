"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const logger_1 = require("../util/logger");
const request_1 = __importDefault(require("../util/request"));
exports.default = ({ options = {}, method = 'get' }) => {
    const opts = Object.assign({}, options, config_1.apiConfig.commonParams, {
        headers: {
            referer: config_1.requestConfig.referer.u,
            host: 'u.y.qq.com',
            'content-type': 'application/x-www-form-urlencoded',
            ...options.headers,
        },
    });
    logger_1.logger.debug(config_1.requestConfig.baseURL.u, { opts });
    return (0, request_1.default)(config_1.requestConfig.baseURL.u, method, opts, 'u');
};
