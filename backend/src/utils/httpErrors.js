export class HttpError extends Error {
  constructor(status, message, code = "HTTP_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request", code = "BAD_REQUEST") {
    super(400, message, code);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(401, message, code);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(403, message, code);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(404, message, code);
  }
}
