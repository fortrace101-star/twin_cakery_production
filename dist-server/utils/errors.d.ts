export declare class AppError extends Error {
    statusCode: number;
    message: string;
    details?: unknown | undefined;
    code: string;
    constructor(statusCode: number, message: string, details?: unknown | undefined, code?: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, details?: unknown);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string, details?: unknown);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string, details?: unknown);
}
export declare class ConflictError extends AppError {
    constructor(message?: string, details?: unknown);
}
export declare class ValidationError extends AppError {
    constructor(message?: string, details?: unknown);
}
