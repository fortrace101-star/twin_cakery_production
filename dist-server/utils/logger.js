/**
 * Single-line request log with exactly five fields and nothing more.
 * SQL text is never logged. No external dependencies.
 *
 * Spec (IMPLEMENTATION_PLAN §7.1): one log line per HTTP request —
 * source, endpoint, method, response time, response code. Nothing more.
 */
function fmt(log) {
    return (`{ source: '${log.source}', endpoint: '${log.endpoint}', ` +
        `method: '${log.method}', time: '${log.time}', status: ${log.status} }`);
}
export const logger = {
    request: (log) => console.log(fmt(log)),
    boot: (message) => console.log(message),
    failure: (scope, message) => console.error(`[${scope}] ${message.replace(/'/g, "")}`),
};
