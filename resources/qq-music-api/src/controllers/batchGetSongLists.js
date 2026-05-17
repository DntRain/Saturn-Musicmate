"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { songLists } = services_1.default;
exports.default = async (ctx) => {
    const { limit: ein = 19, page: sin = 0, sortId = 5, categoryIds = [10000000], } = ctx.request.body;
    const params = {
        sortId,
        sin,
        ein,
    };
    const props = {
        method: 'get',
        option: {},
        params,
    };
    const data = await Promise.all(categoryIds.map(async (categoryId) => await songLists({
        ...props,
        params: {
            ...params,
            categoryId,
        },
    }).then((res) => {
        if (res.body?.response && +(res.body.response.code || 1) === 0) {
            return res.body.response.data;
        }
        else {
            return res.body?.response;
        }
    })));
    Object.assign(ctx, {
        body: {
            status: 200,
            data,
        },
    });
};
