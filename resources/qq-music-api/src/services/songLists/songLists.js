"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const observability_1 = require("../../util/observability");
const y_common_1 = __importDefault(require("../y_common"));
const upstream = '/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg';
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const data = Object.assign(params, {
        format: 'json',
        outCharset: 'utf-8',
        picmid: 1,
    });
    const options = Object.assign(option, {
        params: data,
    });
    (0, observability_1.logServiceRequest)('songLists', upstream, data);
    return (0, y_common_1.default)({
        url: upstream,
        method,
        options,
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
        (0, observability_1.logServiceSuccess)('songLists', upstream, response, {
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
        (0, observability_1.logServiceFailure)('songLists', upstream, error, data);
        return {
            status: 500,
            body: {
                error,
            },
        };
    });
};
