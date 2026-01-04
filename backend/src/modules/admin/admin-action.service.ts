import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminActionService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    adminId: number,
    action: string,
    targetType?: string,
    targetId?: number,
    payload?: any,
    ip?: string,
    userAgent?: string,
  ) {
    return this.prisma.adminActionLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        payload,
        ip,
        userAgent,
      },
    });
  }

  async createModeratorAction(
    moderatorId: number,
    actionType: string,
    targetType: string,
    targetId: number,
    reason?: string,
    metadata?: any,
  ) {
    return this.prisma.moderatorAction.create({
      data: {
        moderatorId,
        actionType,
        targetType,
        targetId,
        reason: reason ?? null,
        metadata: metadata ?? {},
      },
    });
  }
}
