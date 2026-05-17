"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const request_1 = require("../types/core/request");
const { UCommon } = services_1.default;
exports.default = async (ctx) => {
    const query = (0, request_1.getTypedQuery)(ctx);
    const singermid = query.singermid;
    const num = +(query.limit || 5);
    const begin = +(query.page || 0);
    const data = {
        comm: {
            ct: 24,
            cv: 0,
        },
        singer: {
            method: 'GetAlbumList',
            param: {
                sort: 5,
                singermid,
                begin,
                num,
            },
            module: 'music.musichallAlbum.AlbumListServer',
        },
    };
    const params = Object.assign({
        format: 'json',
        singermid,
        data: JSON.stringify(data),
    });
    const props = {
        method: 'get',
        params,
        option: {},
    };
    if (singermid) {
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
    }
    else {
        ctx.status = 400;
        ctx.body = {
            response: 'no singermid',
        };
    }
};
