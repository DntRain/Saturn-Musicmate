"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const observability_1 = require("../../util/observability");
const y_common_1 = __importDefault(require("../y_common"));
const upstream = '/base/fcgi-bin/fcg_global_comment_h5.fcg';
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const data = Object.assign(params, {
        format: 'json',
        outCharset: 'GB2312',
        domain: 'qq.com',
        ct: 24,
        cv: 10101010,
        needmusiccrit: 0,
    });
    const options = Object.assign(option, { params: data });
    (0, observability_1.logServiceRequest)('getComments', upstream, data);
    return (0, y_common_1.default)({
        url: upstream,
        method,
        options,
    })
        .then((res) => {
        const response = res.data;
        (0, observability_1.logServiceSuccess)('getComments', upstream, response, {
            topId: data.topid,
        });
        return {
            status: 200,
            body: {
                response,
            },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('getComments', upstream, error, data);
        return {
            status: 500,
            body: {
                error,
            },
        };
    });
};
