export class DomainError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "DomainError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function badRequest(message: string, code?: string): DomainError {
  return new DomainError(message, 400, code);
}

export function unauthorized(message: string, code?: string): DomainError {
  return new DomainError(message, 401, code);
}

export function forbidden(message: string, code?: string): DomainError {
  return new DomainError(message, 403, code);
}

export function notFound(message: string, code?: string): DomainError {
  return new DomainError(message, 404, code);
}

export function conflict(message: string, code?: string): DomainError {
  return new DomainError(message, 409, code);
}

export function unprocessable(message: string, code?: string): DomainError {
  return new DomainError(message, 422, code);
}

export function serviceUnavailable(message: string, code?: string): DomainError {
  return new DomainError(message, 503, code);
}