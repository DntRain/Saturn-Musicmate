"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = __importDefault(require("../services"));
const { getRadioLists } = services_1.default;
exports.default = async (ctx) => {
    const props = {
        method: 'get',
        params: {},
        option: {},
    };
    const { status, body } = await getRadioLists(props);
    Object.assign(ctx, {
        status,
        body,
    });
};
