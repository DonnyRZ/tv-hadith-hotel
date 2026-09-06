import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

export type RequestWithContext = Request & {
  requestId: string;
};

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header(REQUEST_ID_HEADER)?.trim();
  const requestId =
    incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  (request as RequestWithContext).requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
