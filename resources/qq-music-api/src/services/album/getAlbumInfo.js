"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const observability_1 = require("../../util/observability");
const y_common_1 = __importDefault(require("../y_common"));
const upstream = '/v8/fcg-bin/fcg_v8_album_info_cp.fcg';
exports.default = ({ method = 'get', params = {}, options = {}, }) => {
    const data = Object.assign(params, {
        format: 'json',
        outCharset: 'utf-8',
    });
    const opts = Object.assign(options, {
        params: data,
    });
    (0, observability_1.logServiceRequest)('getAlbumInfo', upstream, data);
    return (0, y_common_1.default)({
        url: upstream,
        method,
        options: opts,
    })
        .then((res) => {
        const response = res.data;
        (0, observability_1.logServiceSuccess)('getAlbumInfo', upstream, response);
        return {
            status: 200,
            body: {
                response,
            },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('getAlbumInfo', upstream, error, data);
        return {
            status: 500,
            body: {
                error,
            },
        };
    });
};
