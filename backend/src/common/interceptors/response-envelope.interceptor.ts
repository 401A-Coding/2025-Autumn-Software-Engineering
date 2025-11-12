import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
    private isEnvelope(
        data: unknown,
    ): data is { code: number; message: string; data: unknown } {
        if (!data || typeof data !== 'object') return false;
        const obj = data as Record<string, unknown>;
        const hasCode = typeof obj.code === 'number';
        const hasMessage = typeof obj.message === 'string';
        const hasData = 'data' in obj;
        return hasCode && hasMessage && hasData;
    }

    intercept(
        _context: ExecutionContext,
        next: CallHandler,
    ): Observable<{ code: number; message: string; data: unknown }> {
        return next
            .handle()
            .pipe(
                map(
                    (data: unknown): { code: number; message: string; data: unknown } =>
                        this.isEnvelope(data)
                            ? (data as { code: number; message: string; data: unknown })
                            : { code: 0, message: 'success', data },
                ),
            );
    }
}
