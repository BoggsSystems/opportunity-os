"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
const config_1 = require("@opportunity-os/config");
const config = (0, config_1.getConfig)();
const baseLogger = (0, pino_1.default)({
    level: config.LOG_LEVEL,
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label }),
        log: (object) => {
            if (object.err) {
                object.err = {
                    ...object.err,
                    message: object.err.message,
                    stack: object.err.stack,
                };
            }
            return object;
        },
    },
});
function createLogger(context) {
    if (context) {
        return baseLogger.child({ context });
    }
    return baseLogger;
}
exports.logger = createLogger();
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map