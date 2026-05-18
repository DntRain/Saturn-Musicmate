"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { getSmartbox } = services_1.default;
exports.default = async (ctx) => {
    const { key } = ctx.query;
    const props = {
        method: 'get',
        params: {
            key,
        },
        option: {},
    };
    if (key) {
        const { status, body } = await getSmartbox(props);
        Object.assign(ctx, {
            status,
            body,
        });
    }
    else {
        ctx.status = 200;
        ctx.body = {
            response: null,
        };
    }
};
