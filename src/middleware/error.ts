import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors";
import { env } from "../config/env";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      error: {
        message: "Validation error",
        code: "VALIDATION_ERROR",
        details: err.flatten()
      }
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      ok: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details
      }
    });
  }

  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        ok: false,
        error: {
          message: "File too large",
          code: "FILE_TOO_LARGE"
        }
      });
    }
  }

  console.error(err);
  return res.status(500).json({
    ok: false,
    error: {
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : "Internal server error",
      code: "INTERNAL_ERROR"
    }
  });
};
