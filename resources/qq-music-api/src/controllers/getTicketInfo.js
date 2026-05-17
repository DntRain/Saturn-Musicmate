"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { UCommon } = services_1.default;
exports.default = async (ctx) => {
    const data = {
        comm: {
            ct: 24,
            cv: 0,
        },
        getFirstData: {
            module: 'mall.ticket_index_page_svr',
            method: 'GetTicketIndexPage',
            param: {
                city_id: -1,
            },
        },
        getTag: {
            module: 'mall.ticket_index_page_svr',
            method: 'GetShowTypeList',
            param: {},
        },
    };
    const params = Object.assign({
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'GB2312',
        platform: 'yqq.json',
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
            response,
        };
    })
        .catch((error) => {
        throw error;
    });
};
