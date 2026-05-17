"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.ConfigManager = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const logger_1 = require("../util/logger");
const default_1 = require("./default");
const schema_1 = require("./schema");
class ConfigManager {
    static instance;
    config;
    isLoaded = false;
    version = 1;
    constructor() {
        this.config = default_1.defaultConfig;
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    /**
     * 加载并校验配置
     * 可通过环境变量或外部配置文件进行深度合并
     */
    loadConfig(externalConfig = {}) {
        if (this.isLoaded)
            return; // 避免重复加载，实现按需加载和缓存机制
        try {
            const mergedConfig = {
                ...this.config,
                ...externalConfig,
            };
            // 通过 Zod 强制进行类型与结构校验
            this.config = schema_1.AppConfigSchema.parse(mergedConfig);
            this.isLoaded = true;
            logger_1.logger.info('[ConfigManager] Config loaded and validated successfully.');
        }
        catch (error) {
            logger_1.logger.error('[ConfigManager] Configuration validation failed:', error);
            process.exit(1); // 配置加载失败时终止启动
        }
    }
    /**
     * 获取当前应用配置（返回冻结的对象以确保访问安全性，避免在运行时被意外修改）
     */
    getConfig() {
        if (!this.isLoaded) {
            this.loadConfig(); // 懒加载
        }
        return Object.freeze(this.config);
    }
    /**
     * 获取脱敏后的安全配置（用于对外暴露或非安全日志输出）
     */
    getSafeConfig() {
        const conf = this.getConfig();
        return this.maskSensitiveData(conf);
    }
    /**
     * 动态更新配置（并触发审计日志记录）
     */
    updateConfig(newConfig, source = 'unknown') {
        const previousConfig = { ...this.config };
        const mergedConfig = { ...this.config, ...newConfig };
        try {
            this.config = schema_1.AppConfigSchema.parse(mergedConfig);
            this.version += 1;
            this.auditLog(source, previousConfig, this.config);
            this.triggerAlert(source);
        }
        catch (error) {
            logger_1.logger.error('[ConfigManager] Failed to update config dynamically:', error);
            throw error;
        }
    }
    /**
     * 审计日志机制
     */
    auditLog(source, oldVal, newVal) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            source,
            version: this.version,
            // 日志中同样需要对敏感信息进行脱敏处理
            oldConfig: this.maskSensitiveData(oldVal),
            newConfig: this.maskSensitiveData(newVal),
        };
        // 写入日志文件或输出到监控流
        const logDir = node_path_1.default.resolve(process.cwd(), 'logs');
        if (!node_fs_1.default.existsSync(logDir)) {
            node_fs_1.default.mkdirSync(logDir, { recursive: true });
        }
        node_fs_1.default.appendFileSync(node_path_1.default.join(logDir, 'config-audit.log'), `${JSON.stringify(logEntry)}\n`, 'utf8');
        logger_1.logger.info(`[ConfigManager] Config changed by ${source}. Audit log recorded. Version: ${this.version}`);
    }
    /**
     * 脱敏辅助方法
     */
    maskSensitiveData(conf) {
        return {
            ...conf,
            user: {
                ...conf.user,
                cookie: conf.user.cookie ? '*** MASKED ***' : '',
                cookieList: conf.user.cookieList?.length ? ['*** MASKED ***'] : [],
                cookieObject: conf.user.cookieObject ? { '***': 'MASKED' } : {},
            },
        };
    }
    /**
     * 配置变更告警埋点
     */
    triggerAlert(source) {
        // 这里可以集成 Sentry / Prometheus 等告警系统
        logger_1.logger.warn(`[ALERT] Configuration has been modified at runtime by source: ${source}`);
    }
}
exports.ConfigManager = ConfigManager;
exports.configManager = ConfigManager.getInstance();
