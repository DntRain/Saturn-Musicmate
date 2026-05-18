"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logServiceBranch = exports.logServiceFailure = exports.logServiceSuccess = exports.logServiceRequest = exports.withControllerLogging = exports.summarizeResponseBody = exports.summarizeRequestContext = exports.summarizeValue = void 0;
const logger_1 = require("./logger");
const MAX_ARRAY_ITEMS = 3;
const MAX_OBJECT_KEYS = 6;
const MAX_STRING_LENGTH = 80;
const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';
const trimString = (value) => value.length > MAX_STRING_LENGTH
    ? {
        length: value.length,
        preview: `${value.slice(0, MAX_STRING_LENGTH)}...`,
    }
    : value;
const summarizeValue = (value, depth = 0) => {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        return trimString(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
        };
    }
    if (Buffer.isBuffer(value)) {
        return {
            type: 'buffer',
            length: value.length,
        };
    }
    if (Array.isArray(value)) {
        if (depth >= 1) {
            return {
                type: 'array',
                length: value.length,
            };
        }
        return {
            type: 'array',
            length: value.length,
            items: value.slice(0, MAX_ARRAY_ITEMS).map((item) => (0, exports.summarizeValue)(item, depth + 1)),
        };
    }
    if (isPlainObject(value)) {
        const keys = Object.keys(value);
        if (depth >= 1) {
            return {
                type: 'object',
                keys: keys.slice(0, MAX_OBJECT_KEYS),
            };
        }
        const entries = keys
            .slice(0, MAX_OBJECT_KEYS)
            .map((key) => [key, (0, exports.summarizeValue)(value[key], depth + 1)]);
        return Object.fromEntries(entries);
    }
    return String(value);
};
exports.summarizeValue = summarizeValue;
const compactRecord = (record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null));
const summarizeRequestContext = (ctx) => {
    const requestBody = ctx.request.body;
    return compactRecord({
        query: Object.keys(ctx.query || {}).length ? (0, exports.summarizeValue)(ctx.query) : undefined,
        params: Object.keys(ctx.params || {}).length
            ? (0, exports.summarizeValue)(ctx.params)
            : undefined,
        body: requestBody !== undefined ? (0, exports.summarizeValue)(requestBody) : undefined,
    });
};
exports.summarizeRequestContext = summarizeRequestContext;
const summarizeResponseBody = (body) => (0, exports.summarizeValue)(body);
exports.summarizeResponseBody = summarizeResponseBody;
const createControllerMeta = (controller, ctx) => ({
    scope: 'controller',
    controller,
    route: ctx.path,
    method: ctx.method,
    params: (0, exports.summarizeRequestContext)(ctx),
});
const withControllerLogging = (controller, handler) => async (ctx, next) => {
    const startedAt = Date.now();
    const baseMeta = createControllerMeta(controller, ctx);
    logger_1.logger.info('request.received', baseMeta);
    try {
        const nextHandler = next || (async () => Promise.resolve());
        await handler(ctx, nextHandler);
        const status = ctx.status || 200;
        const meta = {
            ...baseMeta,
            status,
            durationMs: Date.now() - startedAt,
            result: (0, exports.summarizeResponseBody)(ctx.body),
        };
        if (status >= 500) {
            logger_1.logger.error('request.failed', meta);
            return;
        }
        if (status >= 400) {
            logger_1.logger.warn('request.validation_failed', meta);
            return;
        }
        logger_1.logger.info('request.succeeded', meta);
    }
    catch (error) {
        const normalizedError = error instanceof Error
            ? error
            : new Error(typeof error === 'string' ? error : 'Unknown error');
        logger_1.logger.error('request.failed', {
            ...baseMeta,
            status: 500,
            durationMs: Date.now() - startedAt,
            error: (0, exports.summarizeValue)(normalizedError),
        });
        ctx.status = 500;
        if (ctx.body === undefined) {
            ctx.body = {
                error: normalizedError.message,
            };
        }
    }
};
exports.withControllerLogging = withControllerLogging;
const createServiceMeta = (service, upstream, params) => compactRecord({
    scope: 'service',
    service,
    upstream,
    params: params === undefined ? undefined : (0, exports.summarizeValue)(params),
});
const logServiceRequest = (service, upstream, params, extras = {}) => {
    logger_1.logger.info('service.requesting', {
        ...createServiceMeta(service, upstream, params),
        ...compactRecord(extras),
    });
};
exports.logServiceRequest = logServiceRequest;
const logServiceSuccess = (service, upstream, result, extras = {}) => {
    logger_1.logger.info('service.succeeded', {
        ...createServiceMeta(service, upstream),
        result: (0, exports.summarizeValue)(result),
        ...compactRecord(extras),
    });
};
exports.logServiceSuccess = logServiceSuccess;
const logServiceFailure = (service, upstream, error, params, extras = {}) => {
    logger_1.logger.error('service.failed', {
        ...createServiceMeta(service, upstream, params),
        error: (0, exports.summarizeValue)(error),
        ...compactRecord(extras),
    });
};
exports.logServiceFailure = logServiceFailure;
const logServiceBranch = (service, upstream, branch, details = {}) => {
    logger_1.logger.debug('service.branch_selected', {
        ...createServiceMeta(service, upstream),
        branch,
        ...compactRecord(details),
    });
};
exports.logServiceBranch = logServiceBranch;
