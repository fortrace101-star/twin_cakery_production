export declare const pool: import("pg").Pool;
export declare function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
export declare function withTransaction<T>(fn: (client: TxClient) => Promise<T>): Promise<T>;
export interface TxClient {
    query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
}
export declare function isDatabaseConfigured(): boolean;
