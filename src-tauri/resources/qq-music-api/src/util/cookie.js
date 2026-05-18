"use strict";
/*
 * @Author: Rainy [https://github.com/rain120]
 * @Date: 2021-01-23 16:19:21
 * @LastEditors: Rainy
 * @LastEditTime: 2021-06-19 22:20:01
 */
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
exports.default = () => async (ctx, next) => {
    if (config_1.userInfo.cookie) {
        ctx.request.cookie = config_1.userInfo.cookie;
    }
    const cookieHeader = ctx.request.headers;
    if (cookieHeader && config_1.userInfo.cookieList) {
        config_1.userInfo.cookieList.forEach((cookie) => {
            const [key, value = ''] = cookie.split('=');
            if (value) {
                ctx.cookies.set(key, value.trim(), {
                    maxAge: 24 * 60 * 60 * 1000,
                    // overwirte: true,
                });
            }
        });
    }
    await next();
};
