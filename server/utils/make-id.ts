// Small id helper shared across the server routes (was private inside the
// store). Kept deterministic-friendly for tests and easy to trace in logs.
export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
