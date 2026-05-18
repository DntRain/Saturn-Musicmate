"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { getTopLists } = services_1.default;
const config_1 = require("../config");
exports.default = async (ctx) => {
    const props = {
        method: 'get',
        params: config_1.commonParams,
        option: {},
    };
    const { status, body } = await getTopLists(props);
    Object.assign(ctx, {
        status,
        body,
    });
};
