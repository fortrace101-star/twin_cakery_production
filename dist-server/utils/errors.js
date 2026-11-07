export class AppError extends Error {
    statusCode;
    message;
    details;
    code;
    constructor(statusCode, message, details, code = "BAD_REQUEST") {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.details = details;
        this.code = code;
        this.name = this.constructor.name;
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", details) {
        super(401, message, details, "UNAUTHORIZED");
        this.name = "UnauthorizedError";
    }
}
export class ForbiddenError extends AppError {
    constructor(message = "Forbidden", details) {
        super(403, message, details, "FORBIDDEN");
        this.name = "ForbiddenError";
    }
}
export class NotFoundError extends AppError {
    constructor(message = "Resource not found", details) {
        super(404, message, details, "NOT_FOUND");
        this.name = "NotFoundError";
    }
}
export class ConflictError extends AppError {
    constructor(message = "Conflict", details) {
        super(409, message, details, "CONFLICT");
        this.name = "ConflictError";
    }
}
export class ValidationError extends AppError {
    constructor(message = "Validation failed", details) {
        super(422, message, details, "VALIDATION_ERROR");
        this.name = "ValidationError";
    }
}
