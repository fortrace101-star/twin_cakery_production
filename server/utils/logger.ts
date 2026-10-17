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

function fmt(log: RequestLog): string {
  return (
    `{ source: '${log.source}', endpoint: '${log.endpoint}', ` +
    `method: '${log.method}', time: '${log.time}', status: ${log.status} }`
  );
}

export const logger = {
  request: (log: RequestLog): void => console.log(fmt(log)),
  boot: (message: string): void => console.log(message),
  failure: (scope: Exclude<LogScope, "http">, message: string): void =>
    console.error(`[${scope}] ${message.replace(/'/g, "")}`),
};
