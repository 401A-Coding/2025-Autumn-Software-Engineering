/* note: minimal mocks below intentionally keep loose typing for test purposes */
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

describe('GlobalExceptionFilter', () => {
  type BodyShape = {
    code: number;
    message: string;
    data?: { details?: string[] };
  };
  const makeHost = (
    cb: (status: number, body: BodyShape) => void,
  ): ArgumentsHost => {
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: (s: number) => ({
            json: (b: BodyShape) => cb(s, b),
          }),
        }),
      }),
    } as unknown as ArgumentsHost;
    return host; // minimal mock for ArgumentsHost
  };

  it('wraps BadRequestException into unified details array', (done) => {
    const filter = new GlobalExceptionFilter();
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['name must be a string', 'layout should not be empty'],
      error: 'Bad Request',
    });
    const host = makeHost((status, body) => {
      try {
        expect(status).toBe(HttpStatus.BAD_REQUEST);
        expect(body.code).toBe(400);
        expect(body.message).toBe('参数校验失败');
        expect(Array.isArray(body.data?.details)).toBe(true);
        expect(body.data?.details).toContain('name must be a string');
        done();
      } catch (e) {
        done(e);
      }
    });
    filter.catch(exception, host);
  });

  it('passes through non-400 HttpException preserving message', (done) => {
    const filter = new GlobalExceptionFilter();
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    const host = makeHost((status, body) => {
      try {
        expect(status).toBe(HttpStatus.FORBIDDEN);
        expect(body.code).toBe(403);
        expect(body.message).toBe('Forbidden');
        done();
      } catch (e) {
        done(e);
      }
    });
    filter.catch(exception, host);
  });
});
