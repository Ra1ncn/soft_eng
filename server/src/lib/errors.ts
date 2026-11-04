import type { ErrorRequestHandler } from "express";
import type { ApiErrorResponse, ErrorCode } from "@quiz/shared";
import { ZodError } from "zod";

const statusByCode = { VALIDATION_ERROR: 400, FORBIDDEN: 403, NOT_FOUND: 404, INTERNAL_ERROR: 500 } as const;
export class AppError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, message: string, readonly fields?: Record<string, string>) {
    super(message);
    this.status = statusByCode[code];
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  let normalized: AppError;
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "body";
      fields[path] ??= issue.message;
    }
    normalized = new AppError("VALIDATION_ERROR", "请求字段不合法", fields);
  } else if (error instanceof SyntaxError && "type" in error && error.type === "entity.parse.failed") {
    normalized = new AppError("VALIDATION_ERROR", "请求体不是合法 JSON");
  } else if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    normalized = new AppError("VALIDATION_ERROR", "请求体超过 1MB 限制");
  } else {
    normalized = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "服务器内部错误");
  }
  if (normalized.status === 500) console.error(error);
  const body: ApiErrorResponse = { error: {
    code: normalized.code,
    message: normalized.status === 500 ? "服务器内部错误" : normalized.message,
    ...(normalized.status === 400 && normalized.fields ? { fields: normalized.fields } : {}),
  } };
  res.status(normalized.status).json(body);
};
