"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { getSingerStarNum } = services_1.default;
exports.default = async (ctx) => {
    const { singermid } = ctx.query;
    const props = {
        method: 'get',
        params: {
            singermid,
        },
        option: {},
    };
    if (singermid) {
        const { status, body } = await getSingerStarNum(props);
        Object.assign(ctx, {
            status,
            body,
        });
    }
    else {
        ctx.status = 400;
        ctx.body = {
            response: 'no singermid',
        };
    }
};
