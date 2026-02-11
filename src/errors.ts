export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, "BAD_REQUEST", details);

export const unauthorized = (message: string, details?: unknown) =>
  new AppError(401, message, "UNAUTHORIZED", details);

export const forbidden = (message: string, details?: unknown) =>
  new AppError(403, message, "FORBIDDEN", details);

export const notFound = (message: string, details?: unknown) =>
  new AppError(404, message, "NOT_FOUND", details);
