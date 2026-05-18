"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { UCommon } = services_1.default;
exports.default = async (ctx) => {
    const page = +ctx.query.page || 1;
    const num = +ctx.query.limit || 20;
    const start = (page - 1) * num;
    const data = {
        new_album: {
            module: 'newalbum.NewAlbumServer',
            method: 'get_new_album_info',
            param: {
                area: 1,
                start,
                num,
            },
        },
        comm: {
            ct: 24,
            cv: 0,
        },
    };
    if (!start) {
        data.new_album = {
            module: 'newalbum.NewAlbumServer',
            method: 'get_new_album_area',
            param: { area: 1, start: 0, num: 0 },
        };
    }
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
            status: 200,
            response,
        };
    })
        .catch((error) => {
        throw error;
    });
};
