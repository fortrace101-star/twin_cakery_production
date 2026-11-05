"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.RequestLog = exports.LogScope = void 0;
const LogScope = ["http", "server", "store", "db"];
exports.LogScope = LogScope;
class RequestLog {}
exports.RequestLog = RequestLog;
const logger = {
    request: (log) => {
        console.log(`{ source: '${log.source}', endpoint: '${log.endpoint}', method: '${log.method}', time: '${log.time}', status: ${log.status} }`);
    },
    boot: (message) => {
        console.log(message);
    },
    failure: (scope, message) => {
        console.error(`[${scope}] ${message.replace(/'/g, "")}`);
    }
};
exports.logger = logger;
