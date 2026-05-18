"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { songListDetail } = services_1.default;
exports.default = async (ctx) => {
    const { disstid } = ctx.query;
    const props = {
        method: 'get',
        params: {
            disstid,
        },
        option: {},
    };
    const { status, body } = await songListDetail(props);
    Object.assign(ctx, {
        status,
        body,
    });
};
