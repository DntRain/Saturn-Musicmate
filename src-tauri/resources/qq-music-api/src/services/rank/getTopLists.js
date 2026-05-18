"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const observability_1 = require("../../util/observability");
const y_common_1 = __importDefault(require("../y_common"));
const upstream = '/v8/fcg-bin/fcg_myqq_toplist.fcg';
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const hasCommonParams = false;
    const data = Object.assign(params, {
        format: 'json',
        outCharset: 'utf-8',
        platform: 'h5',
        needNewCode: 1,
    });
    const options = Object.assign(option, {
        params: data,
    });
    (0, observability_1.logServiceRequest)('getTopLists', upstream, data, {
        hasCommonParams,
    });
    return (0, y_common_1.default)({
        url: upstream,
        method,
        options,
        hasCommonParams,
    })
        .then((res) => {
        let response = res.data;
        if (typeof response === 'string') {
            const reg = /^\w+\(({[^()]+})\)$/;
            const matches = response.match(reg);
            if (matches) {
                response = JSON.parse(matches[1]);
            }
        }
        (0, observability_1.logServiceSuccess)('getTopLists', upstream, response, {
            hasCommonParams,
            isJsonpResponse: typeof res.data === 'string',
        });
        return {
            status: 200,
            body: {
                response,
            },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('getTopLists', upstream, error, data, {
            hasCommonParams,
        });
        return {
            status: 500,
            body: {
                error,
            },
        };
    });
};
