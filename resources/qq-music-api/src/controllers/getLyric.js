"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const request_1 = require("../types/core/request");
const { getLyric } = services_1.default;
exports.default = async (ctx) => {
    // songmid=003rJSwm3TechU
    const { songmid, isFormat } = (0, request_1.getTypedQuery)(ctx);
    const props = {
        method: 'get',
        params: {
            songmid,
        },
        option: {},
        isFormat: isFormat === 'true' || isFormat === '1',
    };
    if (songmid) {
        const { status, body } = await getLyric(props);
        Object.assign(ctx, {
            status,
            body,
        });
    }
    else {
        ctx.status = 400;
        ctx.body = {
            response: 'no songmid',
        };
    }
};
