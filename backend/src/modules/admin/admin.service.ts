import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(opts: { q?: string }) {
    const where: any = opts.q
      ? {
          OR: [
            { username: { contains: opts.q, mode: 'insensitive' } },
            { email: { contains: opts.q, mode: 'insensitive' } },
            { phone: { contains: opts.q } },
          ],
        }
      : undefined;

    return this.prisma.user.findMany({ where, take: 100 });
  }

  async updateUserRole(id: number, dto: { role: 'USER' | 'ADMIN' }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });
  }

  async banUser(id: number, dto: { reason?: string; days?: number }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const bannedUntil = dto.days
      ? new Date(Date.now() + dto.days * 24 * 3600 * 1000)
      : null;

    return this.prisma.user.update({
      where: { id },
      data: { isBanned: true, bannedUntil },
    });
  }

  async unbanUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    return this.prisma.user.update({
      where: { id },
      data: { isBanned: false, bannedUntil: null },
    });
  }

  async listPosts(opts: { q?: string; status?: string }) {
    const where: any = {};
    if (opts.q) {
      where.OR = [
        { title: { contains: opts.q, mode: 'insensitive' } },
        { content: { contains: opts.q, mode: 'insensitive' } },
      ];
    }
    if (opts.status) where.status = opts.status;
    return this.prisma.post.findMany({
      where,
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
  }

  async removePost(id: number, adminId?: number) {
    // perform post removal and report resolution atomically
    const result = await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({ where: { id } });
      if (!post) throw new NotFoundException('帖子不存在');

      const updatedPost = await tx.post.update({
        where: { id },
        data: { status: 'REMOVED' },
      });

      if (adminId) {
        await tx.report.updateMany({
          where: { targetType: 'POST', targetId: id, status: 'open' },
          data: {
            status: 'resolved',
            resolvedBy: adminId,
            resolvedAt: new Date(),
          },
        });
      }

      return updatedPost;
    });

    return result;
  }

  async restorePost(id: number) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('帖子不存在');
    return this.prisma.post.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
  }

  async listLogs(opts: { adminId?: number }) {
    const where = opts.adminId ? { adminId: opts.adminId } : undefined;
    return this.prisma.adminActionLog.findMany({
      where,
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listReports(opts?: {
    targetType?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = {};
    if (opts?.targetType)
      where.targetType = String(opts.targetType).toUpperCase();
    if (opts?.status) where.status = opts.status;
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 200;

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: { reporter: { select: { id: true, username: true } } },
    });

    // for POST targets, fetch titles in batch
    const postIds = reports
      .filter((r) => r.targetType === 'POST')
      .map((r) => r.targetId);
    const postsMap: Record<number, { id: number; title?: string | null }> = {};
    if (postIds.length) {
      const posts = await this.prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, title: true },
      });
      for (const p of posts) postsMap[p.id] = p;
    }

    // attach postTitle and normalized reporter
    const mapped = reports.map((r) => ({
      ...r,
      reporter: r.reporter
        ? { id: r.reporter.id, username: r.reporter.username }
        : undefined,
      postTitle:
        r.targetType === 'POST' ? (postsMap[r.targetId]?.title ?? null) : null,
    }));

    const total = await this.prisma.report.count({ where });

    return {
      items: mapped,
      total,
      page,
      pageSize,
    };
  }
}
