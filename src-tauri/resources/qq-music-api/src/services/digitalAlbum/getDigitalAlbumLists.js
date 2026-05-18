"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const observability_1 = require("../../util/observability");
const y_common_1 = __importDefault(require("../y_common"));
const upstream = '/v8/fcg-bin/musicmall.fcg';
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const data = Object.assign(params, {
        format: 'json',
        outCharset: 'utf-8',
        cmd: 'pc_index_new',
    });
    const options = Object.assign(option, {
        params: data,
    });
    (0, observability_1.logServiceRequest)('getDigitalAlbumLists', upstream, data);
    return (0, y_common_1.default)({
        url: upstream,
        method,
        options,
    })
        .then((res) => {
        const response = res.data;
        (0, observability_1.logServiceSuccess)('getDigitalAlbumLists', upstream, response, {
            cmd: data.cmd,
        });
        return {
            status: 200,
            body: {
                response,
            },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('getDigitalAlbumLists', upstream, error, data);
        return {
            status: 500,
            body: {
                error,
            },
        };
    });
};
