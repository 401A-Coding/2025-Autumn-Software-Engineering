import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredRoles || requiredRoles.length === 0) return true;

        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (!user || !user.role) {
            throw new ForbiddenException('无权限访问');
        }

        if (requiredRoles.includes(user.role)) return true;

        throw new ForbiddenException('无权限访问');
    }
}
