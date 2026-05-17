"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const u_common_1 = __importDefault(require("../u_common"));
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const options = Object.assign(option, { params });
    return (0, u_common_1.default)({ method, options });
};
