// Typed errors shared by Server Actions and route handlers (api-design §15).
// Clients switch on `code`, never on the message string.

export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  LINK_INVALID: 404,
  EMAIL_IN_USE: 409,
  LAST_ADMIN: 409,
  RSVP_OVER_LIMIT: 409,
  RSVP_LOCKED: 409,
  TABLE_FULL: 409,
  NOT_INVITED: 409,
  STORAGE_FULL: 409,
  UPLOADS_CLOSED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export type ApiOk<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: { code: ErrorCode; message: string } };

export function okEnvelope<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function errorEnvelope(code: ErrorCode, message: string): ApiError {
  return { ok: false, error: { code, message } };
}
