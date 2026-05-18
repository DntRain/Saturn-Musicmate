"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { getSingerMv } = services_1.default;
exports.default = async (ctx) => {
    const { singermid, order, num = 5 } = ctx.query;
    let params = Object.assign({
        singermid,
        order,
        num,
    });
    if (order && String(order).toLowerCase() === 'time') {
        params = Object.assign(params, {
            cmd: 1,
        });
    }
    const props = {
        method: 'get',
        params,
        option: {},
    };
    if (singermid) {
        const { status, body } = await getSingerMv(props);
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
