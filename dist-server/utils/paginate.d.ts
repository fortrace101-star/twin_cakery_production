export declare const DEFAULT_PAGE_SIZE = 25;
export declare const MAX_PAGE_SIZE = 200;
export interface PageEnvelope<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
}
export interface PaginateOptions {
    /** Fields `?sortBy=` may name. Unknown fields are ignored (no sort). */
    sortable?: readonly string[];
    /** Field compared against `?from=` / `?to=` (inclusive, ISO prefix match). */
    dateField?: string;
    /** Fields `?search=` matches case-insensitively (substring). */
    searchFields?: readonly string[];
}
/**
 * Apply the §33 standard params to a filtered list. See contract above —
 * returns `T[]` when pagination was not requested, `PageEnvelope<T>` when it
 * was. `res.json(...)` accepts both, so call sites stay one-liners.
 */
export declare function paginate<T>(rows: readonly T[], query: unknown, options?: PaginateOptions): T[] | PageEnvelope<T>;
