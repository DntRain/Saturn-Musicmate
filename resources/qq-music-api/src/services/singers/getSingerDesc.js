"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
const observability_1 = require("../../util/observability");
const y_common_1 = __importDefault(require("../y_common"));
const upstream = '/splcloud/fcgi-bin/fcg_get_singer_desc.fcg';
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const hasCommonParams = false;
    const data = Object.assign(params, {
        format: 'xml',
        outCharset: 'utf-8',
        utf8: 1,
        r: (0, moment_1.default)().valueOf(),
    });
    const options = Object.assign(option, {
        params: data,
    });
    (0, observability_1.logServiceRequest)('getSingerDesc', upstream, data, {
        hasCommonParams,
    });
    return (0, y_common_1.default)({
        url: upstream,
        method,
        options,
        hasCommonParams,
    })
        .then((res) => {
        const response = res.data;
        (0, observability_1.logServiceSuccess)('getSingerDesc', upstream, response, {
            hasCommonParams,
            singermid: data.singermid,
        });
        return {
            status: 200,
            body: {
                response,
            },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('getSingerDesc', upstream, error, data, {
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
