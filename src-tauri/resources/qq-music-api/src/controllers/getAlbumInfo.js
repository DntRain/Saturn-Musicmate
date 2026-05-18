"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { getAlbumInfo } = services_1.default;
exports.default = async (ctx) => {
    const { albummid } = ctx.query;
    const props = {
        method: 'get',
        params: {
            albummid,
        },
        option: {},
    };
    if (albummid) {
        const { status, body } = await getAlbumInfo(props);
        Object.assign(ctx, {
            status,
            body,
        });
    }
    else {
        ctx.status = 400;
        ctx.body = {
            data: {
                message: 'no albummid',
            },
        };
    }
};
