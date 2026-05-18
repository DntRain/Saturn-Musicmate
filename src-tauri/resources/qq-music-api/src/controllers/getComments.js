"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { getComments } = services_1.default;
exports.default = async (ctx) => {
    const { id, pagesize = 25, pagenum = 0, cid = 205360772, cmd = 8, reqtype = 2, biztype = 1, rootcommentid = !pagenum && '', } = ctx.query;
    const checkrootcommentid = !pagenum ? true : !!rootcommentid;
    const params = Object.assign({
        cid,
        reqtype,
        biztype,
        topid: id,
        cmd,
        pagenum,
        pagesize,
        lasthotcommentid: rootcommentid,
    });
    const props = {
        method: 'get',
        params,
        option: {},
    };
    if (id && checkrootcommentid) {
        const { status, body } = await getComments(props);
        Object.assign(ctx, {
            status,
            body,
        });
    }
    else {
        ctx.status = 400;
        ctx.body = {
            data: {
                message: "Don't have id or rootcommentid",
            },
        };
    }
};
