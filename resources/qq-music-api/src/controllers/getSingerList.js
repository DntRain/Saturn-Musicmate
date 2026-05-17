"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { UCommon } = services_1.default;
const config_1 = require("../config");
exports.default = async (ctx) => {
    const { area = -100, sex = -100, genre = -100, index = -100, page = 1 } = ctx.query;
    const data = {
        comm: {
            ct: 24,
            cv: 0,
        },
        singerList: {
            module: 'Music.SingerListServer',
            method: 'get_singer_list',
            param: {
                area: +area,
                sex: +sex,
                genre: +genre,
                index: +index,
                sin: (Number(page) - 1) * 80,
                cur_page: +page,
            },
        },
    };
    const params = Object.assign(config_1.commonParams, {
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
