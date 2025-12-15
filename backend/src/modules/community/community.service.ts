import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async listPosts(params: {
    page: number;
    pageSize: number;
    q?: string;
    tag?: string;
    type?: string;
    authorId?: number;
    sort?: 'new' | 'hot';
  }) {
    const { page, pageSize, q, tag, type, authorId, sort } = params;
    const where: any = {};
    if (authorId) where.authorId = authorId;
    if (type) where.shareType = (type || '').toUpperCase();
    if (q)
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    const tagFilter = tag
      ? {
          tags: {
            some: { tag: { name: { equals: tag, mode: 'insensitive' } } },
          },
        }
      : {};

    const orderBy: any =
      sort === 'hot'
        ? [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: { status: 'PUBLISHED', ...where, ...tagFilter },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          tags: { include: { tag: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      this.prisma.post.count({
        where: { status: 'PUBLISHED', ...where, ...tagFilter },
      }),
    ]);

    const mapped = items.map((p: any) => ({
      id: p.id,
      authorId: p.authorId,
      authorNickname: p.author?.username,
      authorAvatar: p.author?.avatarUrl ?? null,
      title: p.title ?? null,
      excerpt: p.content?.slice(0, 200) ?? '',
      shareType:
        p.shareType === 'NONE' ? null : String(p.shareType).toLowerCase(),
      shareRefId: p.shareType === 'NONE' ? null : p.shareRefId,
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      tags: p.tags?.map((t: any) => t.tag.name) ?? [],
    }));

    return { items: mapped, page, pageSize, total };
  }

  async createPost(userId: number, data: any) {
    const created = await this.prisma.post.create({
      data: {
        authorId: userId,
        title: data.title ?? null,
        content: data.content,
        shareType: data.shareType?.toUpperCase() ?? 'NONE',
        shareRefId: data.shareRefId ?? null,
        status: 'PUBLISHED',
      },
    });
    if (Array.isArray(data.tags) && data.tags.length > 0) {
      for (const name of data.tags) {
        const tag = await this.prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        await this.prisma.postTag.create({
          data: { postId: created.id, tagId: tag.id },
        });
      }
    }
    return { postId: created.id };
  }

  async getPost(postId: number) {
    const p = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        attachments: true,
        tags: { include: { tag: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      authorId: p.authorId,
      authorNickname: p.author?.username,
      authorAvatar: p.author?.avatarUrl ?? null,
      title: p.title ?? null,
      content: p.content,
      shareType:
        p.shareType === 'NONE' ? null : String(p.shareType).toLowerCase(),
      shareRefId: p.shareType === 'NONE' ? null : p.shareRefId,
      shareReference:
        p.shareType === 'NONE'
          ? null
          : {
              refType: String(p.shareType).toLowerCase(),
              refId: p.shareRefId ?? 0,
              snapshot: p.shareSnap ?? null,
            },
      attachments:
        p.attachments?.map((a: any) => ({
          url: a.url,
          mimeType: a.mimeType ?? null,
          width: a.width ?? null,
          height: a.height ?? null,
        })) ?? [],
      tags: p.tags?.map((t: any) => t.tag.name) ?? [],
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt ?? null,
    };
  }

  async updatePost(userId: number, postId: number, patch: any) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) {
      throw new Error('Forbidden');
    }
    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        title: patch.title ?? post.title,
        content: patch.content ?? post.content,
      },
      include: { tags: { include: { tag: true } } },
    });
    if (Array.isArray(patch.tags)) {
      await this.prisma.postTag.deleteMany({ where: { postId } });
      for (const name of patch.tags) {
        const tag = await this.prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        await this.prisma.postTag.create({ data: { postId, tagId: tag.id } });
      }
    }
    return updated;
  }

  async deletePost(userId: number, postId: number) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) {
      throw new Error('Forbidden');
    }
    await this.prisma.post.update({
      where: { id: postId },
      data: { status: 'REMOVED' },
    });
    return { ok: true };
  }

  async listComments(postId: number, page: number, pageSize: number) {
    const [topComments, total] = await this.prisma.$transaction([
      this.prisma.communityComment.findMany({
        where: { postId, parentId: null }, // 只返回顶级评论
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          _count: { select: { likes: true } },
        },
      }),
      this.prisma.communityComment.count({ where: { postId, parentId: null } }),
    ]);

    const topIds = topComments.map((c) => c.id);
    // 取出每个顶级评论下的所有楼中楼：直接子回复 + 子回复的子回复
    const allReplies = topIds.length
      ? await this.prisma.communityComment.findMany({
          where: {
            OR: [
              { parentId: { in: topIds } },
              { parent: { parentId: { in: topIds } } },
            ],
          },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            parent: {
              select: {
                id: true,
                parentId: true,
                author: { select: { id: true, username: true } },
              },
            },
            _count: { select: { likes: true } },
          },
        })
      : [];

    const repliesByRoot: Record<number, any[]> = {};
    for (const r of allReplies) {
      const parentId = r.parentId ?? null;
      const parentParentId = r.parent?.parentId ?? null;
      const rootId = topIds.includes(parentId as number)
        ? (parentId as number)
        : topIds.includes(parentParentId as number)
          ? (parentParentId as number)
          : null;
      if (!rootId) continue;
      if (!repliesByRoot[rootId]) repliesByRoot[rootId] = [];
      repliesByRoot[rootId].push(r);
    }

    const mapped = topComments.map((c: any) => {
      const replies = (repliesByRoot[c.id] ?? []).map((r: any) => ({
        id: r.id,
        parentId: r.parentId,
        authorId: r.authorId,
        authorNickname: r.author?.username,
        authorAvatar: r.author?.avatarUrl ?? null,
        replyToId: r.parent?.author?.id ?? null,
        replyToNickname: r.parent?.author?.username ?? null,
        content: r.content,
        likeCount: r._count.likes,
        createdAt: r.createdAt,
      }));
      return {
        id: c.id,
        authorId: c.authorId,
        authorNickname: c.author?.username,
        authorAvatar: c.author?.avatarUrl ?? null,
        content: c.content,
        likeCount: c._count.likes,
        replyCount: replies.length,
        replies,
        createdAt: c.createdAt,
      };
    });

    return { items: mapped, page, pageSize, total };
  }

  async addComment(userId: number, postId: number, body: any) {
    const created = await this.prisma.communityComment.create({
      data: {
        postId,
        authorId: userId,
        content: body.content,
        parentId: body.parentId ?? null,
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    return {
      commentId: created.id,
      authorId: created.authorId,
      authorNickname: created.author?.username,
      authorAvatar: created.author?.avatarUrl ?? null,
      content: created.content,
      createdAt: created.createdAt,
    };
  }

  async likePost(userId: number, postId: number) {
    await this.prisma.postLike.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    });
    return { ok: true };
  }

  async unlikePost(userId: number, postId: number) {
    await this.prisma.postLike.deleteMany({ where: { postId, userId } });
    return { ok: true };
  }

  async likeComment(userId: number, commentId: number) {
    await this.prisma.commentLike.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: {},
      create: { commentId, userId },
    });
    return { ok: true };
  }

  async unlikeComment(userId: number, commentId: number) {
    await this.prisma.commentLike.deleteMany({ where: { commentId, userId } });
    return { ok: true };
  }

  async bookmarkPost(userId: number, postId: number) {
    await this.prisma.postBookmark.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    });
    return { ok: true };
  }

  async unbookmarkPost(userId: number, postId: number) {
    await this.prisma.postBookmark.deleteMany({ where: { postId, userId } });
    return { ok: true };
  }

  async createReport(userId: number, data: any) {
    const created = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: (data.targetType ?? 'POST').toUpperCase(),
        targetId: data.targetId,
        reason: data.reason ?? 'unspecified',
      },
    });
    return { reportId: created.id };
  }

  async search(params: {
    q?: string;
    tag?: string;
    type?: string;
    page: number;
    pageSize: number;
  }) {
    const { q, tag, type, page, pageSize } = params;
    const where: any = {};
    if (type) where.shareType = (type || '').toUpperCase();
    if (q)
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    const tagFilter = tag
      ? {
          tags: {
            some: { tag: { name: { equals: tag, mode: 'insensitive' } } },
          },
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: { status: 'PUBLISHED', ...where, ...tagFilter },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true },
      }),
      this.prisma.post.count({
        where: { status: 'PUBLISHED', ...where, ...tagFilter },
      }),
    ]);
    const mapped = items.map((i: any) => ({
      recordId: i.id,
      title: i.title ?? '',
    }));
    return { items: mapped, page, pageSize, total };
  }
}
