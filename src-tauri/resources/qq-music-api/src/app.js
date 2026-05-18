"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const chalk_1 = __importDefault(require("chalk"));
const koa_1 = __importDefault(require("koa"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const koa_static_1 = __importDefault(require("koa-static"));
const apiExplorer_1 = require("./config/apiExplorer");
const koa_cors_1 = __importDefault(require("./middlewares/koa-cors"));
const router_1 = __importDefault(require("./routes/router"));
const cookie_1 = __importDefault(require("./util/cookie"));
const logger_1 = require("./util/logger");
const openExplorer_1 = require("./util/openExplorer");
require("./util/colors");
const package_json_1 = __importDefault(require("../package.json"));
const config_1 = require("./config");
const app = new koa_1.default();
const isTestEnv = logger_1.loggerState.isTestEnv;
const publicDirectory = node_path_1.default.join(__dirname, '../public');
const isExplorerDebugRequest = (pathName) => pathName === apiExplorer_1.API_EXPLORER_ROUTE_PATH ||
    pathName === apiExplorer_1.API_EXPLORER_METADATA_PATH ||
    pathName.startsWith(`${apiExplorer_1.API_EXPLORER_ROUTE_PATH}/`);
const logExplorerRequestDebug = (stage, details) => {
    logger_1.logger.debug(`[explorer.server] ${stage}`, details);
};
logger_1.logger.info(chalk_1.default.green('\n🥳🎉 We had supported config the user cookies. \n'));
if (!(config_1.userInfo.loginUin || config_1.userInfo.uin)) {
    logger_1.logger.info(chalk_1.default.yellow(`😔 The configuration ${chalk_1.default.red('loginUin')} or your ${chalk_1.default.red('cookie')} in file ${chalk_1.default.green('config/user-info')} has not configured. \n`));
}
if (!config_1.userInfo.cookie) {
    logger_1.logger.info(chalk_1.default.yellow(`😔 The configuration ${chalk_1.default.red('cookie')} in file ${chalk_1.default.green('config/user-info')} has not configured. \n`));
}
if (!isTestEnv) {
    const versionCheckProcess = (0, node_child_process_1.exec)('npm info qq-music-api version', (err, stdout) => {
        if (!err) {
            const version = stdout.trim();
            if (package_json_1.default.version < version) {
                logger_1.logger.info(chalk_1.default.white(`Current Version: ${version}, Local Version: ${package_json_1.default.version}, Please update it.`));
            }
        }
    });
    versionCheckProcess.unref();
}
app.use((0, koa_bodyparser_1.default)());
app.use((0, cookie_1.default)());
app.use(async (ctx, next) => {
    if (isExplorerDebugRequest(ctx.path)) {
        logExplorerRequestDebug('request-enter', {
            method: ctx.method,
            path: ctx.path,
            url: ctx.url,
        });
    }
    if (ctx.path === apiExplorer_1.API_EXPLORER_ROUTE_PATH) {
        logExplorerRequestDebug('route-redirect', {
            from: ctx.path,
            to: apiExplorer_1.API_EXPLORER_INDEX_PATH,
            method: ctx.method,
        });
        ctx.redirect(apiExplorer_1.API_EXPLORER_INDEX_PATH);
        return;
    }
    if (ctx.path === apiExplorer_1.API_EXPLORER_METADATA_PATH) {
        logExplorerRequestDebug('route-metadata', {
            endpointCount: apiExplorer_1.apiExplorerMetadata.endpoints.length,
            method: ctx.method,
            path: ctx.path,
            type: 'application/json',
        });
        ctx.type = 'application/json';
        ctx.body = apiExplorer_1.apiExplorerMetadata;
        return;
    }
    const requestStartAt = Date.now();
    if (isExplorerDebugRequest(ctx.path)) {
        logExplorerRequestDebug('next-before', {
            method: ctx.method,
            path: ctx.path,
            startedAt: requestStartAt,
        });
    }
    await next();
    if (isExplorerDebugRequest(ctx.path)) {
        logExplorerRequestDebug('next-after', {
            durationMs: Date.now() - requestStartAt,
            method: ctx.method,
            path: ctx.path,
            responseTime: ctx.response.get('X-Response-Time') || `${Date.now() - requestStartAt}ms`,
            status: ctx.status,
        });
    }
});
app.use((0, koa_static_1.default)(publicDirectory));
// logger
app.use(async (ctx, next) => {
    const requestStartAt = Date.now();
    await next();
    const rt = ctx.response.get('X-Response-Time');
    const sanitizedUrl = encodeURI(ctx.url).replace(/%0D|%0A/gi, '');
    if (isExplorerDebugRequest(ctx.path)) {
        logExplorerRequestDebug('request-summary', {
            durationMs: Date.now() - requestStartAt,
            method: ctx.method,
            responseTime: rt || `${Date.now() - requestStartAt}ms`,
            sanitizedUrl,
            status: ctx.status,
        });
    }
    logger_1.logger.info(chalk_1.default.white(`${ctx.method} ${sanitizedUrl} - ${rt}`));
});
// cors
app.use((0, koa_cors_1.default)({
    origin: '*',
    ...config_1.serverConfig.cors,
}));
// x-response-time
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});
app.use(router_1.default.routes()).use(router_1.default.allowedMethods());
if (!isTestEnv) {
    app.listen(config_1.serverConfig.port, () => {
        logger_1.logger.info(chalk_1.default.white(`server running @ http://localhost:${config_1.serverConfig.port}`));
        (0, openExplorer_1.autoOpenExplorer)(config_1.serverConfig.port);
    });
}
exports.default = app;
