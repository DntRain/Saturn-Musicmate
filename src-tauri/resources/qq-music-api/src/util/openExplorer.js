"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoOpenExplorer = exports.getOpenCommand = exports.getExplorerSessionMarkerPath = exports.getExplorerUrl = exports.shouldAutoOpenExplorer = exports.AUTO_OPEN_EXPLORER_ENV = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const apiExplorer_1 = require("../config/apiExplorer");
const logger_1 = require("./logger");
exports.AUTO_OPEN_EXPLORER_ENV = 'AUTO_OPEN_EXPLORER';
const sanitizeSessionId = (value) => value.replace(/[^A-Za-z0-9_-]/g, '_');
const shouldAutoOpenExplorer = () => {
    if (logger_1.loggerState.isTestEnv) {
        return false;
    }
    if (process.env.CI) {
        return false;
    }
    return process.env[exports.AUTO_OPEN_EXPLORER_ENV] === 'true';
};
exports.shouldAutoOpenExplorer = shouldAutoOpenExplorer;
const getExplorerUrl = (port) => `http://localhost:${port}${apiExplorer_1.API_EXPLORER_ROUTE_PATH}`;
exports.getExplorerUrl = getExplorerUrl;
const getExplorerSessionMarkerPath = (port) => node_path_1.default.join(node_os_1.default.tmpdir(), `qq-music-api-explorer-${sanitizeSessionId(String(process.ppid || process.pid))}-${port}.lock`);
exports.getExplorerSessionMarkerPath = getExplorerSessionMarkerPath;
const getOpenCommand = (url) => {
    switch (process.platform) {
        case 'darwin':
            return { command: 'open', args: [url] };
        case 'win32':
            return { command: 'cmd', args: ['/c', 'start', '', url] };
        default:
            return { command: 'xdg-open', args: [url] };
    }
};
exports.getOpenCommand = getOpenCommand;
const autoOpenExplorer = (port) => {
    if (!(0, exports.shouldAutoOpenExplorer)()) {
        return;
    }
    const explorerUrl = (0, exports.getExplorerUrl)(port);
    const markerPath = (0, exports.getExplorerSessionMarkerPath)(port);
    if ((0, node_fs_1.existsSync)(markerPath)) {
        return;
    }
    try {
        (0, node_fs_1.writeFileSync)(markerPath, explorerUrl, 'utf8');
    }
    catch (error) {
        logger_1.logger.warn('explorer.auto_open_marker_failed', {
            markerPath,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    try {
        const { command, args } = (0, exports.getOpenCommand)(explorerUrl);
        const childProcess = (0, node_child_process_1.spawn)(command, args, {
            detached: true,
            stdio: 'ignore',
        });
        childProcess.on('error', (error) => {
            logger_1.logger.warn('explorer.auto_open_failed', {
                url: explorerUrl,
                error: error.message,
            });
        });
        childProcess.unref();
        logger_1.logger.info('explorer.auto_open_started', {
            url: explorerUrl,
        });
    }
    catch (error) {
        logger_1.logger.warn('explorer.auto_open_failed', {
            url: explorerUrl,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
exports.autoOpenExplorer = autoOpenExplorer;
