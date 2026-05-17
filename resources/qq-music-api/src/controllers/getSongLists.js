"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const request_1 = require("../types/core/request");
const { songLists } = services_1.default;
/**
 * @description: 2, 3
 * @param {page} 页数
 * @param {limit} 每页条数[20, 60]
 * @param {categoryId} 分类
 * @param {sortId} 分类
 * @return:
 */
exports.default = async (ctx) => {
    const query = (0, request_1.getTypedQuery)(ctx);
    const { limit = 20, page = 0, sortId = 5, categoryId = 10000000 } = query;
    // BUGFIX: https://github.com/Rain120/qq-music-api/issues/16
    const sin = +page * +limit;
    const ein = +limit * (+page + 1) - 1;
    const params = Object.assign({
        categoryId,
        sortId,
        sin,
        ein,
    });
    const props = {
        method: 'get',
        params,
        option: {},
    };
    const { status, body } = await songLists(props);
    Object.assign(ctx, {
        status,
        body,
    });
};
