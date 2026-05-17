"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
const lyricParse_1 = __importDefault(require("../../util/lyricParse"));
const observability_1 = require("../../util/observability");
const y_common_1 = __importDefault(require("../y_common"));
const upstream = '/lyric/fcgi-bin/fcg_query_lyric_new.fcg';
exports.default = ({ method = 'get', params = {}, options = {}, isFormat = false, }) => {
    const data = Object.assign(params, {
        format: 'json',
        outCharset: 'utf-8',
        pcachetime: (0, moment_1.default)().valueOf(),
    });
    const opts = Object.assign(options, {
        params: data,
    });
    (0, observability_1.logServiceRequest)('getLyric', upstream, data, {
        formatLyric: isFormat,
    });
    if (isFormat) {
        (0, observability_1.logServiceBranch)('getLyric', upstream, 'format', {
            formatLyric: true,
        });
    }
    return (0, y_common_1.default)({
        url: upstream,
        method,
        options: opts,
    })
        .then((res) => {
        const lyricString = res.data?.lyric && Buffer.from(res.data.lyric, 'base64').toString();
        const lyric = isFormat ? lyricParse_1.default.lyricParse(lyricString || '') : lyricString;
        const response = {
            ...(res.data || {}),
            lyric,
        };
        (0, observability_1.logServiceSuccess)('getLyric', upstream, {
            code: res.data?.code,
            hasLyric: Boolean(lyricString),
            formatLyric: isFormat,
        });
        return {
            status: 200,
            body: {
                response,
            },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('getLyric', upstream, error, data, {
            formatLyric: isFormat,
        });
        return {
            status: 500,
            body: {
                error,
            },
        };
    });
};
