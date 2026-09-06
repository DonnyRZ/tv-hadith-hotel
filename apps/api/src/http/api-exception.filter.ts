import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

import { runtimeEnvironment, runtimeReleaseId } from '../config/runtime-config';
import { REQUEST_ID_HEADER, type RequestWithContext } from './request-context.middleware';

interface ErrorDetail {
  field: string;
  message: string;
}

interface ErrorBody {
  code?: string;
  message?: string | string[];
  details?: ErrorDetail[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorDetail(value: unknown): value is ErrorDetail {
  return isRecord(value) && typeof value.field === 'string' && typeof value.message === 'string';
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  public constructor(private readonly config: ConfigService) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<RequestWithContext>();
    const httpException = exception instanceof HttpException ? exception : undefined;
    const status = httpException?.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.requestId ?? randomUUID();
    const rawBody: unknown = httpException?.getResponse();
    const body: ErrorBody = isRecord(rawBody) ? (rawBody as ErrorBody) : {};
    const messages = Array.isArray(body.message) ? body.message : undefined;
    const message =
      typeof body.message === 'string'
        ? body.message
        : status >= 500
          ? 'An unexpected error occurred.'
          : 'Request could not be completed.';
    const details =
      body.details?.filter(isErrorDetail) ??
      messages?.map((validationMessage) => ({ field: 'request', message: validationMessage }));

    const payload = {
      statusCode: status,
      code: body.code ?? this.defaultCode(status),
      message,
      requestId,
      environment: runtimeEnvironment(this.config),
      releaseId: runtimeReleaseId(this.config),
      ...(details !== undefined && details.length > 0 ? { details } : {}),
      timestamp: new Date().toISOString(),
    };

    response.setHeader(REQUEST_ID_HEADER, requestId);
    const requestPath = request.originalUrl ?? request.url ?? 'unknown';
    const logLine = `${status} ${payload.code} requestId=${requestId} ${request.method ?? 'UNKNOWN'} ${requestPath}`;
    if (status >= 500) {
      this.logger.error(logLine);
    } else if (status >= 400) {
      this.logger.warn(logLine);
    }
    response.status(status).json(payload);
  }

  private defaultCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'RESOURCE_CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
