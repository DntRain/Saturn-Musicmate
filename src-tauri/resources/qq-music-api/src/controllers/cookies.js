"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * @Author: Rainy [https://github.com/rain120]
 * @Date: 2021-01-23 15:41:41
 * @LastEditors: Rainy
 * @LastEditTime: 2021-06-19 22:22:31
 */
const config_1 = require("../config");
exports.default = {
    get: async (ctx, next) => {
        const safeConfig = config_1.configManager.getSafeConfig();
        ctx.status = 200;
        const user = safeConfig.user;
        ctx.body = {
            data: {
                code: 200,
                cookie: user.cookie,
                cookieList: user.cookieList,
                cookieObject: user.cookieObject,
            },
        };
        await next();
    },
    set: async (ctx, next) => {
        ctx.status = 403;
        ctx.body = {
            data: {
                code: 403,
                message: 'Setting cookie dynamically is disabled for security reasons.',
            },
        };
        await next();
    },
};
