import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let errorData: unknown = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const obj = payload as Record<string, unknown>;
        const msg = obj['message'];
        message = Array.isArray(msg)
          ? msg.join('; ')
          : typeof msg === 'string'
            ? msg
            : exception.message;
        // provide original payload for debugging if needed
        errorData = obj;
      } else {
        message = exception.message;
      }
    } else if (exception && typeof exception === 'object') {
      message = (exception as { message?: string }).message || message;
    }

    res.status(status).json({ code: status, message, data: errorData });
  }
}
