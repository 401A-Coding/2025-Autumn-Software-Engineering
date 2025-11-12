import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface JwtPayload {
  sub: number;
  username: string;
  role: 'USER' | 'ADMIN';
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const auth =
      req.headers['authorization'] ||
      (req.headers['Authorization'] as string | undefined);
    if (
      !auth ||
      typeof auth !== 'string' ||
      !auth.toLowerCase().startsWith('bearer ')
    ) {
      throw new UnauthorizedException('未登录');
    }
    const token = auth.slice(7).trim();
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('无效的凭证');
    }
  }
}
