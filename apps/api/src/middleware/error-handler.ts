import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/**
 * Application-specific error class with HTTP status codes.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(429, 'TOO_MANY_REQUESTS', message);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }

  static insufficientBalance(currency: string): AppError {
    return new AppError(400, 'INSUFFICIENT_BALANCE', `Insufficient ${currency} balance`);
  }

  static gameSessionInvalid(message: string): AppError {
    return new AppError(400, 'GAME_SESSION_INVALID', message);
  }
}

/**
 * Formats a ZodError into a user-friendly validation error response.
 */
function formatZodError(error: ZodError) {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: issues,
    },
  };
}

/**
 * Global Fastify error handler.
 * Handles AppError, ZodError, FastifyError, and unknown errors.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log the error (with stack in development)
  const logData = {
    method: request.method,
    url: request.url,
    errorName: error.name,
    errorMessage: error.message,
  };

  // Zod validation errors
  if (error instanceof ZodError) {
    request.log.warn(logData, 'Validation error');
    reply.status(400).send(formatZodError(error));
    return;
  }

  // Application errors
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      request.log.error({ ...logData, stack: error.stack }, 'Application error');
    } else {
      request.log.warn(logData, 'Application error');
    }

    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Fastify errors (validation, rate limit, etc.)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode;

    // Rate limit error
    if (statusCode === 429) {
      reply.status(429).send({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please try again later.',
        },
      });
      return;
    }

    // Other Fastify errors
    request.log.warn(logData, 'Fastify error');
    reply.status(statusCode).send({
      success: false,
      error: {
        code: (error as FastifyError).code || 'REQUEST_ERROR',
        message: error.message,
      },
    });
    return;
  }

  // Unknown errors - always 500
  request.log.error({ ...logData, stack: error.stack }, 'Unhandled error');
  reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An unexpected error occurred',
    },
  });
}
