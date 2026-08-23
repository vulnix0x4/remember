import { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 16_384): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") throw new ApiError(422, "invalid_content_type", "Expected application/json.");

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(422, "body_too_large", "Request body is too large.");
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new ApiError(422, "body_too_large", "Request body is too large.");

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(422, "invalid_json", "Request body is not valid JSON.");
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(422, "validation_error", "Request validation failed.", z.flattenError(result.error));
  return result.data;
}

export function jsonError(error: unknown, requestId: string): Response {
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: { code: "validation_error", message: "Request validation failed.", details: z.flattenError(error) }, requestId },
      { status: 422 },
    );
  }
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details }, requestId },
      { status: error.status },
    );
  }
  return Response.json(
    { error: { code: "internal_error", message: "An unexpected error occurred." }, requestId },
    { status: 500 },
  );
}

export function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
}

export function publicProcessingError(error: unknown): string {
  const message = safeErrorMessage(error);
  const normalized = message.toLocaleLowerCase("en-US");
  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("aborted")) {
    return "Analysis took longer than expected. Your source is saved safely and can be retried.";
  }
  if (normalized.includes("no readable captions")) {
    return "This video has no readable captions, so Remember cannot analyze it faithfully yet.";
  }
  if (normalized.includes("no readable public text")) {
    return "This page has no readable public text, so Remember cannot analyze it faithfully yet.";
  }
  return "Remember could not finish analyzing this source. Your link is saved safely and can be retried.";
}
