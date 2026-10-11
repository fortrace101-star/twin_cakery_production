/**
 * Tiny structured logger for the ERP backend.
 *
 * Emits one line per event with an ISO timestamp, a level and a scope tag so
 * logs can be grepped by area (`http`, `db`, `server`, …). Metadata is appended
 * as compact JSON when provided. No external dependencies — the server runs
 * from tsx and must not depend on frontend packages.
 */

type LogLevel = "INFO" | "WARN" | "ERROR";

const BOOT_TIME = Date.now();

function timestamp(): string {
  return new Date().toISOString();
}

function sinceBoot(): string {
  return `+${((Date.now() - BOOT_TIME) / 1000).toFixed(3)}s`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Error) return { name: v.name, message: v.message };
      return v;
    });
  } catch {
    return String(value);
  }
}

function emit(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  const suffix = meta === undefined ? "" : ` ${safeStringify(meta)}`;
  const line = `${timestamp()} ${sinceBoot()} ${level.padEnd(5)} [${scope}] ${message}${suffix}`;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (scope: string, message: string, meta?: unknown): void => emit("INFO", scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown): void => emit("WARN", scope, message, meta),
  error: (scope: string, message: string, meta?: unknown): void => emit("ERROR", scope, message, meta),
};
