export const HttpStatus = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
  ) {
    super(message);

    this.name = this.constructor.name;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super(HttpStatus.BAD_REQUEST, message);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(HttpStatus.UNAUTHORIZED, message);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(HttpStatus.FORBIDDEN, message);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(HttpStatus.NOT_FOUND, message);
  }
}

export class MethodNotAllowedException extends HttpException {
  constructor(message = 'Method Not Allowed') {
    super(HttpStatus.METHOD_NOT_ALLOWED, message);
  }
}

export class ConflictException extends HttpException {
  constructor(message = 'Conflict') {
    super(HttpStatus.CONFLICT, message);
  }
}

export class GoneException extends HttpException {
  constructor(message = 'Gone') {
    super(HttpStatus.GONE, message);
  }
}

export class UnsupportedMediaTypeException extends HttpException {
  constructor(message = 'Unsupported Media Type') {
    super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, message);
  }
}

export class UnprocessableEntityException extends HttpException {
  constructor(message = 'Unprocessable Entity') {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message);
  }
}

export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too Many Requests') {
    super(HttpStatus.TOO_MANY_REQUESTS, message);
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message = 'Internal Server Error') {
    super(HttpStatus.INTERNAL_SERVER_ERROR, message);
  }
}

export class NotImplementedException extends HttpException {
  constructor(message = 'Not Implemented') {
    super(HttpStatus.NOT_IMPLEMENTED, message);
  }
}

export class BadGatewayException extends HttpException {
  constructor(message = 'Bad Gateway') {
    super(HttpStatus.BAD_GATEWAY, message);
  }
}

export class ServiceUnavailableException extends HttpException {
  constructor(message = 'Service Unavailable') {
    super(HttpStatus.SERVICE_UNAVAILABLE, message);
  }
}

export class GatewayTimeoutException extends HttpException {
  constructor(message = 'Gateway Timeout') {
    super(HttpStatus.GATEWAY_TIMEOUT, message);
  }
}