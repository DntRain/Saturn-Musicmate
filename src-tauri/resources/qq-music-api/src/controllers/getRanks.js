"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { UCommon } = services_1.default;
const moment_1 = __importDefault(require("moment"));
const config_1 = require("../config");
const request_1 = require("../types/core/request");
exports.default = async (ctx) => {
    // Desc: https://github.com/Rain120/qq-music-api/issues/14
    // 1. topId is useless
    // 2. qq api period is change not YYYY-MM-DD
    const query = (0, request_1.getTypedQuery)(ctx);
    const topId = +(query.topId || 4);
    const num = +(query.limit || 20);
    const offset = +(query.page || 0);
    const date = query.period || (0, moment_1.default)().format('YYYY-MM-DD');
    const week = (0, moment_1.default)(date).isoWeek();
    const year = (0, moment_1.default)(date).year();
    const period = `${year}_${week}`;
    const data = {
        comm: {
            ...(config_1.commonParams || {}),
            cv: 4747474,
            ct: 24,
            format: 'json',
            inCharset: 'utf-8',
            needNewCode: 1,
            uin: 0,
        },
        req_1: {
            module: 'musicToplist.ToplistInfoServer',
            method: 'GetDetail',
            param: {
                topId,
                offset,
                num,
                period,
            },
        },
        // TODO: 新评论，之后迭代更新再说
        // req_2: {
        // 	module: 'music.globalComment.CommentReadServer',
        // 	method: 'GetNewCommentList',
        // 	param: {
        // 		BizType: 4,
        // 		BizId: '59',
        // 		LastCommentSeqNo: '',
        // 		PageSize: 25,
        // 		PageNum: 0,
        // 		FromCommentId: '',
        // 		WithHot: 1,
        // 	},
        // },
        // TODO: 热门评论，之后迭代更新再说
        // req_3: {
        // 	module: 'music.globalComment.CommentReadServer',
        // 	method: 'GetHotCommentList',
        // 	param: {
        // 		BizType: 4,
        // 		BizId: '59',
        // 		LastCommentSeqNo: '',
        // 		PageSize: 15,
        // 		PageNum: 0,
        // 		HotType: 2,
        // 		WithAirborne: 1,
        // 	},
        // },
    };
    const params = Object.assign({
        format: 'json',
        data: JSON.stringify(data),
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
