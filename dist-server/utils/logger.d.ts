/**
 * Single-line request log with exactly five fields and nothing more.
 * SQL text is never logged. No external dependencies.
 *
 * Spec (IMPLEMENTATION_PLAN §7.1): one log line per HTTP request —
 * source, endpoint, method, response time, response code. Nothing more.
 */
export type LogScope = "http" | "server" | "store" | "db";
export interface RequestLog {
    source: "http";
    endpoint: string;
    method: string;
    time: string;
    status: number;
}
export declare const logger: {
    request: (log: RequestLog) => void;
    boot: (message: string) => void;
    failure: (scope: Exclude<LogScope, "http">, message: string) => void;
};
