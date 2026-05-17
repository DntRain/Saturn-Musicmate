"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { UCommon } = services_1.default;
const config_1 = require("../config");
exports.default = async (ctx) => {
    const song_mid = ctx.query.songmid;
    const song_id = ctx.query.songid || '';
    const params = Object.assign({}, config_1.commonParams, {
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        notice: 0,
        platform: 'yqq.json',
        needNewCode: 0,
        data: JSON.stringify({
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
        }),
    });
    const props = {
        method: 'get',
        params,
        option: {},
    };
    await UCommon(props)
        .then((res) => {
        const response = res.data;
        ctx.status = 200;
        ctx.body = {
            response,
        };
    })
        .catch((error) => {
        throw error;
    });
};
