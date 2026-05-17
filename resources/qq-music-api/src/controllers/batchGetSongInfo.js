"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { UCommon } = services_1.default;
const config_1 = require("../config");
const logger_1 = require("../util/logger");
exports.default = async (ctx) => {
    const { songs } = ctx.request.body;
    const params = Object.assign(config_1.commonParams, {
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        notice: 0,
        platform: 'yqq.json',
        needNewCode: 0,
    });
    const props = {
        method: 'get',
        option: {},
        params,
    };
    const data = await Promise.all((songs || []).map(async (song) => {
        const [song_mid, song_id = ''] = song;
        logger_1.logger.debug('batchGetSongInfo item', { song_mid, song_id });
        return await UCommon({
            ...props,
            params: {
                ...params,
                data: {
                    comm: {
                        ct: 24,
                        cv: 0,
                    },
                    songinfo: {
                        method: 'get_song_detail_yqq',
                        param: {
                            song_type: 0,
                            song_mid,
                            song_id,
                        },
                        module: 'music.pf_song_detail_svr',
                    },
                },
            },
        }).then((res) => res.data);
    }));
    Object.assign(ctx, {
        body: {
            status: 200,
            data,
        },
    });
};
