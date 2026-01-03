import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, ShareType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // Build a lightweight record snapshot so posts can render embeds without hitting record permissions
  private async buildRecordSnapshot(recordId: number, ownerId?: number) {
    if (!recordId) return undefined;
    const record = await this.prisma.record.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        ownerId: true,
        opponent: true,
        result: true,
        initialLayout: true,
        moves: {
          orderBy: { moveIndex: 'asc' },
          select: {
            moveIndex: true,
            fromX: true,
            fromY: true,
            toX: true,
            toY: true,
            pieceType: true,
            pieceSide: true,
          },
        },
      },
    });
    if (!record) return undefined;
    if (ownerId && record.ownerId && record.ownerId !== ownerId)
      return undefined; // do not leak others' records
    return {
      recordId: record.id,
      opponent: record.opponent,
      result: record.result === 'unknown' ? 'unfinished' : record.result,
      initialLayout: record.initialLayout ?? null,
      moves:
        record.moves?.map((m) => ({
          moveIndex: m.moveIndex,
          fromX: m.fromX,
          fromY: m.fromY,
          toX: m.toX,
          toY: m.toY,
          pieceType: m.pieceType,
          pieceSide: m.pieceSide,
        })) ?? [],
    };
  }

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

    // 扩展搜索：同时匹配内容、标签和作者名
    if (q) {
      where.OR = [
        // 1. 标题或内容包含关键词
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        // 2. 标签包含关键词
        {
          tags: {
            some: {
              tag: { name: { contains: q, mode: 'insensitive' } },
            },
          },
        },
        // 3. 作者用户名包含关键词
        {
          author: {
            username: { contains: q, mode: 'insensitive' },
          },
        },
      ];
    }

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

    const mapped = [] as any[];
    for (const p of items) {
      let snapshot = null as any;
      if (p.shareType === 'RECORD' && p.shareRefId) {
        snapshot =
          (await this.buildRecordSnapshot(p.shareRefId, p.authorId)) ?? null;
        // Persist latest snapshot for downstream fetches
        await this.prisma.post.update({
          where: { id: p.id },
          data: { shareSnap: snapshot },
        });
      }

      mapped.push({
        id: p.id,
        authorId: p.authorId,
        authorNickname: p.author?.username,
        authorAvatar: p.author?.avatarUrl ?? null,
        title: p.title ?? null,
        excerpt: p.content?.slice(0, 200) ?? '',
        shareType:
          p.shareType === 'NONE' ? null : String(p.shareType).toLowerCase(),
        shareRefId: p.shareType === 'NONE' ? null : p.shareRefId,
        shareReference:
          p.shareType === 'NONE'
            ? null
            : {
                refType: String(p.shareType).toLowerCase(),
                refId: p.shareRefId ?? 0,
                snapshot,
              },
        createdAt: p.createdAt,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        tags: p.tags?.map((t: any) => t.tag.name) ?? [],
      });
    }

    return { items: mapped, page, pageSize, total };
  }

  async createPost(userId: number, data: any) {
    // 禁止被封禁用户发帖
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isBanned: true, bannedUntil: true },
      });
      if (u?.isBanned) {
        const until = u.bannedUntil ? new Date(u.bannedUntil).getTime() : null;
        if (!until || until > Date.now()) {
          throw new ForbiddenException('账号被封禁，无法发帖');
        } else {
          // expired: auto clear
          try {
            await this.prisma.user.update({
              where: { id: userId },
              data: { isBanned: false, bannedUntil: null },
            });
          } catch {}
        }
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
    }
    const shareType = (data.shareType?.toUpperCase() ?? 'NONE') as ShareType;
    const shareRefId = data.shareRefId ?? null;
    const shareSnap =
      shareType === 'RECORD' && shareRefId
        ? ((await this.buildRecordSnapshot(shareRefId, userId)) ??
          Prisma.JsonNull)
        : Prisma.JsonNull;

    const created = await this.prisma.post.create({
      data: {
        authorId: userId,
        title: data.title ?? null,
        content: data.content ?? null,
        shareType,
        shareRefId,
        shareSnap,
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

  async getPost(postId: number, userId?: number) {
    const p = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        attachments: true,
        tags: { include: { tag: true } },
        _count: { select: { likes: true, comments: true, bookmarks: true } },
      },
    });
    if (!p) return null;

    let shareSnapshot = null as any;
    if (p.shareType === 'RECORD' && p.shareRefId) {
      shareSnapshot =
        (await this.buildRecordSnapshot(p.shareRefId, p.authorId)) ?? null;
      await this.prisma.post.update({
        where: { id: postId },
        data: { shareSnap: shareSnapshot },
      });
    }

    let bookmarked = false;
    if (userId) {
      const bookmark = await this.prisma.postBookmark.findFirst({
        where: { postId, userId },
      });
      bookmarked = !!bookmark;
    }

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
              snapshot: shareSnapshot ?? null,
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
      bookmarkCount: p._count.bookmarks,
      bookmarked,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt ?? null,
    };
  }

  async updatePost(userId: number, postId: number, patch: any) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) {
      throw new Error('Forbidden');
    }

    const shareTypePatchRaw = patch.shareType;
    const shareTypePatch =
      typeof shareTypePatchRaw === 'string'
        ? String(shareTypePatchRaw).toUpperCase()
        : undefined;
    const shareRefPatch = Object.prototype.hasOwnProperty.call(
      patch,
      'shareRefId',
    )
      ? patch.shareRefId
      : undefined;

    let nextShareType: ShareType = post.shareType;
    let nextShareRefId = post.shareRefId;
    let nextShareSnap: any = post.shareSnap;

    const shouldUpdateShare =
      shareTypePatch !== undefined || shareRefPatch !== undefined;

    if (shouldUpdateShare) {
      nextShareType = (shareTypePatch as ShareType) ?? post.shareType;
      nextShareRefId =
        shareRefPatch !== undefined ? shareRefPatch : post.shareRefId;

      if (nextShareType === 'NONE') {
        nextShareRefId = null;
        nextShareSnap = null;
      } else if (nextShareType === 'RECORD' && nextShareRefId) {
        nextShareSnap =
          (await this.buildRecordSnapshot(nextShareRefId, post.authorId)) ??
          null;
      } else {
        // Other share types: clear snapshot by default
        nextShareSnap = null;
      }
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        title: patch.title ?? post.title,
        content: patch.content ?? post.content,
        ...(shouldUpdateShare
          ? {
              shareType: nextShareType,
              shareRefId:
                nextShareType === 'NONE' ? null : (nextShareRefId ?? null),
              shareSnap:
                nextShareType === 'NONE'
                  ? Prisma.JsonNull
                  : nextShareType === 'RECORD' && nextShareRefId
                    ? (nextShareSnap ?? Prisma.JsonNull)
                    : Prisma.JsonNull,
            }
          : {}),
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

    // 获取这些顶级评论下的所有回复（任意层级），再按根评论分组
    const allReplies = topIds.length
      ? await this.prisma.communityComment.findMany({
          where: {
            postId,
            parentId: { not: null },
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

    const replyMap = new Map<number, any>();
    for (const r of allReplies) {
      replyMap.set(r.id, r);
    }

    const rootCache = new Map<number, number | null>();
    const findRoot = (reply: any): number | null => {
      if (rootCache.has(reply.id))
        return rootCache.get(reply.id) as number | null;
      let currentParentId = reply.parentId as number | null;
      while (currentParentId && !topIds.includes(currentParentId)) {
        const parent = replyMap.get(currentParentId);
        if (!parent) {
          currentParentId = null;
          break;
        }
        currentParentId = parent.parentId as number | null;
      }
      const root =
        currentParentId && topIds.includes(currentParentId)
          ? currentParentId
          : null;
      rootCache.set(reply.id, root);
      return root;
    };

    const repliesByRoot: Record<number, any[]> = {};
    for (const r of allReplies) {
      const rootId = findRoot(r);
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
        content: r.deletedAt ? null : r.content,
        isDeleted: !!r.deletedAt,
        likeCount: r._count.likes,
        createdAt: r.createdAt,
      }));
      return {
        id: c.id,
        authorId: c.authorId,
        authorNickname: c.author?.username,
        authorAvatar: c.author?.avatarUrl ?? null,
        content: c.deletedAt ? null : c.content,
        isDeleted: !!c.deletedAt,
        likeCount: c._count.likes,
        replyCount: replies.length,
        replies,
        createdAt: c.createdAt,
      };
    });

    return { items: mapped, page, pageSize, total };
  }

  async addComment(userId: number, postId: number, body: any) {
    // 禁止被封禁用户评论
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isBanned: true, bannedUntil: true },
      });
      if (u?.isBanned) {
        const until = u.bannedUntil ? new Date(u.bannedUntil).getTime() : null;
        if (!until || until > Date.now()) {
          throw new ForbiddenException('账号被封禁，无法评论');
        } else {
          try {
            await this.prisma.user.update({
              where: { id: userId },
              data: { isBanned: false, bannedUntil: null },
            });
          } catch {}
        }
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
    }
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

  async deleteComment(userId: number, commentId: number) {
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, deletedAt: true },
    });
    if (!comment) return { ok: false, reason: 'not_found' };
    if (comment.authorId !== userId) return { ok: false, reason: 'forbidden' };
    if (comment.deletedAt) return { ok: false, reason: 'already_deleted' };

    // soft delete: mark deletedAt to retain thread context
    await this.prisma.communityComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return { ok: true };
  }

  // Admin-level comment deletion (soft delete) with optional reason
  async adminDeleteComment(
    adminId: number,
    commentId: number,
    reason?: string,
  ) {
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) return { ok: false, reason: 'not_found' };
    if (comment.deletedAt) return { ok: false, reason: 'already_deleted' };

    await this.prisma.communityComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    // record moderator action for audit and user visibility
    try {
      await this.prisma.moderatorAction.create({
        data: {
          moderatorId: adminId,
          actionType: 'remove',
          targetType: 'COMMENT',
          targetId: commentId,
          reason: reason ?? null,
          metadata: {},
        },
      });
    } catch (e) {
      console.error('Failed to write moderator action', e);
    }

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
    const raw = data.targetType ?? 'post';
    const normalized = String(raw).toLowerCase();
    const allowed = ['post', 'comment', 'record'];
    if (!allowed.includes(normalized))
      throw new BadRequestException('invalid targetType');
    const created = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: normalized.toUpperCase() as any,
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

  async getMyComments(userId: number, page = 1, pageSize = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.communityComment.findMany({
        where: {
          authorId: userId,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          parent: {
            select: {
              id: true,
              authorId: true,
              author: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.communityComment.count({
        where: {
          authorId: userId,
        },
      }),
    ]);

    const mapped = items.map((c: any) => ({
      id: c.id,
      postId: c.postId,
      postTitle: c.post?.title ?? null,
      postStatus: c.post?.status ?? null,
      parentId: c.parentId,
      parentAuthorNickname: c.parent?.author?.username ?? null,
      content: c.deletedAt ? null : c.content,
      isDeleted: !!c.deletedAt,
      createdAt: c.createdAt,
      authorId: c.authorId,
      authorNickname: c.author?.username,
      authorAvatar: c.author?.avatarUrl ?? null,
    }));

    return { items: mapped, page, pageSize, total };
  }

  async recordPostView(userId: number, postId: number) {
    await this.prisma.postView.upsert({
      where: { postId_userId: { postId, userId } },
      update: { updatedAt: new Date() },
      create: { postId, userId },
    });
    return { ok: true };
  }

  async getMyViews(userId: number, page = 1, pageSize = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.postView.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.postView.count({ where: { userId } }),
    ]);

    const mapped = items.map((v: any) => ({
      postId: v.postId,
      postTitle: v.post?.title ?? null,
      postStatus: v.post?.status ?? null,
      viewedAt: v.updatedAt,
    }));

    return { items: mapped, page, pageSize, total };
  }

  async clearMyViews(userId: number) {
    await this.prisma.postView.deleteMany({ where: { userId } });
    return { ok: true };
  }

  async getMyLikes(
    userId: number,
    type: 'all' | 'post' | 'comment' = 'all',
    page = 1,
    pageSize = 20,
  ) {
    if (type === 'post' || type === 'all') {
      const [postLikes, postTotal] = await this.prisma.$transaction([
        this.prisma.postLike.findMany({
          where: { userId },
          skip: type === 'post' ? (page - 1) * pageSize : 0,
          take: type === 'post' ? pageSize : undefined,
          orderBy: { createdAt: 'desc' },
          include: {
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                status: true,
                author: { select: { username: true, avatarUrl: true } },
                createdAt: true,
                _count: { select: { likes: true, comments: true } },
              },
            },
          },
        }),
        this.prisma.postLike.count({ where: { userId } }),
      ]);

      if (type === 'post') {
        const mapped = postLikes.map((l: any) => ({
          type: 'post',
          id: l.post.id,
          title: l.post.title,
          excerpt: l.post.content?.slice(0, 100) ?? '',
          authorNickname: l.post.author?.username,
          authorAvatar: l.post.author?.avatarUrl ?? null,
          likedAt: l.createdAt,
          createdAt: l.post.createdAt,
          postStatus: l.post.status,
          postLikeCount: l.post._count?.likes ?? 0,
          postCommentCount: l.post._count?.comments ?? 0,
        }));
        return { items: mapped, page, pageSize, total: postTotal };
      }
    }

    if (type === 'comment' || type === 'all') {
      const [commentLikes, commentTotal] = await this.prisma.$transaction([
        this.prisma.commentLike.findMany({
          where: { userId },
          skip: type === 'comment' ? (page - 1) * pageSize : 0,
          take: type === 'comment' ? pageSize : undefined,
          orderBy: { createdAt: 'desc' },
          include: {
            comment: {
              select: {
                id: true,
                content: true,
                postId: true,
                deletedAt: true,
                author: { select: { username: true, avatarUrl: true } },
                createdAt: true,
                post: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    _count: { select: { likes: true, comments: true } },
                  },
                },
                _count: { select: { likes: true } },
              },
            },
          },
        }),
        this.prisma.commentLike.count({ where: { userId } }),
      ]);

      if (type === 'comment') {
        const mapped = commentLikes.map((l: any) => ({
          type: 'comment',
          id: l.comment.id,
          postId: l.comment.postId,
          postTitle: l.comment.post?.title ?? null,
          postStatus: l.comment.post?.status ?? null,
          content: l.comment.deletedAt ? null : l.comment.content,
          isDeleted: !!l.comment.deletedAt,
          commentStatus: l.comment.deletedAt ? 'DELETED' : null,
          authorNickname: l.comment.author?.username,
          authorAvatar: l.comment.author?.avatarUrl ?? null,
          likedAt: l.createdAt,
          createdAt: l.comment.createdAt,
          commentLikeCount: l.comment._count?.likes ?? 0,
          postLikeCount: l.comment.post?._count?.likes ?? 0,
          postCommentCount: l.comment.post?._count?.comments ?? 0,
        }));
        return { items: mapped, page, pageSize, total: commentTotal };
      }
    }

    // type === 'all'
    const [postLikes, commentLikes, postTotal, commentTotal] =
      await this.prisma.$transaction([
        this.prisma.postLike.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: {
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                status: true,
                author: { select: { username: true, avatarUrl: true } },
                createdAt: true,
                _count: { select: { likes: true, comments: true } },
              },
            },
          },
        }),
        this.prisma.commentLike.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: {
            comment: {
              select: {
                id: true,
                content: true,
                postId: true,
                deletedAt: true,
                author: { select: { username: true, avatarUrl: true } },
                createdAt: true,
                post: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    _count: { select: { likes: true, comments: true } },
                  },
                },
                _count: { select: { likes: true } },
              },
            },
          },
        }),
        this.prisma.postLike.count({ where: { userId } }),
        this.prisma.commentLike.count({ where: { userId } }),
      ]);

    const allLikes = [
      ...postLikes.map((l: any) => ({
        type: 'post',
        id: l.post.id,
        title: l.post.title,
        excerpt: l.post.content?.slice(0, 100) ?? '',
        authorNickname: l.post.author?.username,
        authorAvatar: l.post.author?.avatarUrl ?? null,
        likedAt: l.createdAt,
        createdAt: l.post.createdAt,
        postStatus: l.post.status,
        postLikeCount: l.post._count?.likes ?? 0,
        postCommentCount: l.post._count?.comments ?? 0,
      })),
      ...commentLikes.map((l: any) => ({
        type: 'comment',
        id: l.comment.id,
        postId: l.comment.postId,
        postTitle: l.comment.post?.title ?? null,
        postStatus: l.comment.post?.status ?? null,
        content: l.comment.deletedAt ? null : l.comment.content,
        isDeleted: !!l.comment.deletedAt,
        commentStatus: l.comment.deletedAt ? 'DELETED' : null,
        authorNickname: l.comment.author?.username,
        authorAvatar: l.comment.author?.avatarUrl ?? null,
        likedAt: l.createdAt,
        createdAt: l.comment.createdAt,
        commentLikeCount: l.comment._count?.likes ?? 0,
        postLikeCount: l.comment.post?._count?.likes ?? 0,
        postCommentCount: l.comment.post?._count?.comments ?? 0,
      })),
    ];

    allLikes.sort(
      (a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime(),
    );
    const paged = allLikes.slice((page - 1) * pageSize, page * pageSize);

    return { items: paged, page, pageSize, total: postTotal + commentTotal };
  }

  async getMyBookmarks(userId: number, page = 1, pageSize = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.postBookmark.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              content: true,
              author: { select: { username: true, avatarUrl: true } },
              createdAt: true,
              _count: { select: { likes: true, comments: true } },
            },
          },
        },
      }),
      this.prisma.postBookmark.count({ where: { userId } }),
    ]);

    const mapped = items.map((b: any) => ({
      postId: b.post.id,
      title: b.post.title,
      excerpt: b.post.content?.slice(0, 100) ?? '',
      authorNickname: b.post.author?.username,
      authorAvatar: b.post.author?.avatarUrl ?? null,
      likeCount: b.post._count.likes,
      commentCount: b.post._count.comments,
      bookmarkedAt: b.createdAt,
      createdAt: b.post.createdAt,
    }));

    return { items: mapped, page, pageSize, total };
  }
}
