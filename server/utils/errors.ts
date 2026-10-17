export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown,
    public code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(401, message, details, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super(403, message, details, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(404, message, details, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(409, message, details, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(422, message, details, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
