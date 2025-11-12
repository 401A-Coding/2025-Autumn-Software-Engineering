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
      // 专门处理 400（参数校验失败）：返回统一 details 数组
      if (status === HttpStatus.BAD_REQUEST) {
        let details: string[] = [];
        if (payload && typeof payload === 'object') {
          const obj = payload as Record<string, unknown>;
          const msg = obj['message'];
          if (Array.isArray(msg)) {
            details = msg.filter((m): m is string => typeof m === 'string');
          } else if (typeof msg === 'string') {
            details = [msg];
          }
        } else if (typeof payload === 'string') {
          details = [payload];
        }
        message = '参数校验失败';
        errorData = { details };
      } else if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const obj = payload as Record<string, unknown>;
        const msg = obj['message'];
        message = Array.isArray(msg)
          ? msg.join('; ')
          : typeof msg === 'string'
            ? msg
            : exception.message;
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
