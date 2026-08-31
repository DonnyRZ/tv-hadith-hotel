import { HttpException, type HttpStatus } from '@nestjs/common';

export interface ApiExceptionBody {
  code: string;
  message: string;
  details?: readonly { field: string; message: string }[];
}

export class ApiException extends HttpException {
  public constructor(status: HttpStatus, body: ApiExceptionBody) {
    super(body, status);
  }
}
