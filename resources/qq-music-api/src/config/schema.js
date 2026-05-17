"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfigSchema = exports.UserSchema = exports.ApiSchema = exports.RequestSchema = exports.ServerSchema = void 0;
const zod_1 = require("zod");
exports.ServerSchema = zod_1.z.object({
    port: zod_1.z.number().int().positive(),
    cors: zod_1.z.object({
        exposeHeaders: zod_1.z.array(zod_1.z.string()),
        maxAge: zod_1.z.number().int().nonnegative(),
        credentials: zod_1.z.boolean(),
        allowMethods: zod_1.z.array(zod_1.z.string()),
        allowHeaders: zod_1.z.array(zod_1.z.string()),
    }),
});
exports.RequestSchema = zod_1.z.object({
    timeout: zod_1.z.number().int().positive(),
    withCredentials: zod_1.z.boolean(),
    contentType: zod_1.z.string(),
    responseType: zod_1.z.string(),
    baseURL: zod_1.z.object({
        y: zod_1.z.string().url(),
        c: zod_1.z.string().url(),
        u: zod_1.z.string().url(),
        pic: zod_1.z.string().url(),
    }),
    referer: zod_1.z.object({
        y: zod_1.z.string().url(),
        c: zod_1.z.string().url(),
        u: zod_1.z.string().url(),
    }),
});
exports.ApiSchema = zod_1.z.object({
    commonParams: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    _guid: zod_1.z.number(),
    options: zod_1.z.object({
        param: zod_1.z.string(),
        prefix: zod_1.z.string(),
    }),
    optionsPrefix: zod_1.z.object({
        param: zod_1.z.string(),
        prefix: zod_1.z.string(),
    }),
});
exports.UserSchema = zod_1.z.object({
    loginUin: zod_1.z.string(),
    cookie: zod_1.z.string(),
    uin: zod_1.z.string().optional(),
    cookieList: zod_1.z.array(zod_1.z.string()).optional(),
    cookieObject: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
});
exports.AppConfigSchema = zod_1.z.object({
    server: exports.ServerSchema,
    request: exports.RequestSchema,
    api: exports.ApiSchema,
    user: exports.UserSchema,
});
