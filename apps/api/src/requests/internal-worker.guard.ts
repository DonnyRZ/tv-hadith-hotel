import { timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { ApiException } from '../auth/api-exception';

const INTERNAL_WORKER_HEADER = 'x-internal-worker-secret';

@Injectable()
export class InternalWorkerGuard implements CanActivate {
  public constructor(private readonly config: ConfigService) {}

  public canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_WORKER_SECRET')?.trim();
    if (expected === undefined || expected.length === 0) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, {
        code: 'INTERNAL_WORKER_NOT_CONFIGURED',
        message: 'The internal worker endpoint is not configured.',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.header(INTERNAL_WORKER_HEADER)?.trim();
    const matches =
      supplied !== undefined &&
      supplied.length === expected.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

    if (!matches) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: 'INTERNAL_WORKER_FORBIDDEN',
        message: 'The internal worker credential is invalid.',
      });
    }

    return true;
  }
}
