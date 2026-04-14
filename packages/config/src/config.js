"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.isDevelopment = isDevelopment;
exports.isProduction = isProduction;
exports.isTest = isTest;
const schema_1 = require("./schema");
let config;
function getConfig() {
    if (!config) {
        config = (0, schema_1.validateEnv)();
    }
    return config;
}
function isDevelopment() {
    return getConfig().NODE_ENV === 'development';
}
function isProduction() {
    return getConfig().NODE_ENV === 'production';
}
function isTest() {
    return getConfig().NODE_ENV === 'test';
}
//# sourceMappingURL=config.js.map