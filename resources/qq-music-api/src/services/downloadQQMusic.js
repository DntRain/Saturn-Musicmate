"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const observability_1 = require("../util/observability");
const request_1 = __importDefault(require("../util/request"));
const upstream = '/download/download.js';
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const data = Object.assign(params, {
        format: 'jsonp',
        jsonpCallback: 'MusicJsonCallback',
        platform: 'yqq',
    });
    const options = Object.assign(option, {
        headers: {
            host: 'y.qq.com',
            referer: config_1.requestConfig.referer.y,
            ...option.headers,
        },
        params: data,
    });
    (0, observability_1.logServiceRequest)('downloadQQMusic', upstream, data);
    return (0, request_1.default)(upstream, method, options, 'y')
        .then((res) => {
        let response = res.data;
        const isJsonpResponse = typeof response === 'string';
        if (typeof response === 'string') {
            const reg = /^\w+\(({[^()]+})\)$/;
            const matches = response.match(reg);
            if (matches) {
                response = JSON.parse(matches[1]);
            }
        }
        (0, observability_1.logServiceSuccess)('downloadQQMusic', upstream, response, {
            isJsonpResponse,
        });
        return {
            status: 200,
            body: {
                response,
            },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('downloadQQMusic', upstream, error, data);
        return {
            status: 500,
            body: {
                error,
            },
        };
    });
};
