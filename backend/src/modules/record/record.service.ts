import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { PrismaService } from '../../prisma/prisma.service';

type CreateMoveInput = {
  moveIndex: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  pieceType: string;
  pieceSide: string;
  capturedType?: string | null;
  capturedSide?: string | null;
  timeSpentMs: number;
  san?: string | null;
};

type CreateBookmarkInput = {
  step: number;
  label: string;
  note: string;
};

@Injectable()
export class RecordService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: number, dto: CreateRecordDto) {
    // Basic validation of required fields
    if (!dto?.opponent || !dto?.startedAt || !dto?.endedAt || !dto?.result || !dto?.endReason) {
      throw new BadRequestException('Missing required record fields');
    }

    // Enforce retention limit only for non-favorites
    const pref = await this.prisma.userRecordPreference.findUnique({ where: { userId } });
    const limit = pref?.retentionLimit ?? 30;

    const movesInput: CreateMoveInput[] = (dto as any).moves ?? [];
    const bookmarksInput: CreateBookmarkInput[] = (dto as any).bookmarks ?? [];

    const record = await this.prisma.record.create({
      data: {
        ownerId: userId,
        opponent: dto.opponent,
        startedAt: new Date(dto.startedAt),
        endedAt: new Date(dto.endedAt),
        result: dto.result,
        endReason: dto.endReason,
        keyTags: dto.keyTags ?? [],
        moves: movesInput?.length
          ? {
            create: movesInput.map((m) => ({
              moveIndex: m.moveIndex,
              fromX: m.fromX,
              fromY: m.fromY,
              toX: m.toX,
              toY: m.toY,
              pieceType: m.pieceType,
              pieceSide: m.pieceSide,
              capturedType: m.capturedType ?? null,
              capturedSide: m.capturedSide ?? null,
              timeSpentMs: m.timeSpentMs,
              san: m.san ?? null,
            })),
          }
          : undefined,
        bookmarks: bookmarksInput?.length
          ? {
            create: bookmarksInput.map((b) => ({
              step: b.step,
              label: b.label,
              note: b.note,
            })),
          }
          : undefined,
      },
      include: { moves: true, bookmarks: true },
    });

    // Count non-favorite records for this user
    const nonFavCount = await this.prisma.record.count({
      where: { ownerId: userId, favorites: { none: { userId } } },
    });
    if (nonFavCount > limit) {
      const toDelete = nonFavCount - limit;
      const oldestNonFav = await this.prisma.record.findMany({
        where: { ownerId: userId, favorites: { none: { userId } } },
        orderBy: { createdAt: 'asc' },
        take: toDelete,
        select: { id: true },
      });
      const ids = oldestNonFav.map((r) => r.id);
      if (ids.length) await this.prisma.record.deleteMany({ where: { id: { in: ids } } });
    }

    return record;
  }

  async findAll() {
    // Basic list, newest first. Can be extended to paginate/filter later.
    return this.prisma.record.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        favorites: true,
        shares: true,
      },
    });
  }

  async findAllPaginated(userId: number, page = 1, pageSize = 10, favorite?: boolean, result?: string) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where: any = { ownerId: userId };
    if (favorite === true) where.favorites = { some: { userId } };
    if (favorite === false) where.favorites = { none: { userId } };
    if (result) where.result = result;
    const [items, total] = await Promise.all([
      this.prisma.record.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          owner: { select: { id: true, username: true, avatarUrl: true } },
          favorites: true,
          shares: true,
        },
      }),
      this.prisma.record.count({ where }),
    ]);
    return { items, page: Math.max(page, 1), pageSize: take, total };
  }

  async findOne(userId: number, id: number) {
    const record = await this.prisma.record.findFirst({
      where: { id, ownerId: userId },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        moves: true,
        bookmarks: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, username: true, avatarUrl: true } } },
        },
        favorites: true,
        shares: true,
      },
    });
    if (!record) throw new NotFoundException('Record not found');
    return record;
  }

  async remove(userId: number, id: number) {
    const record = await this.prisma.record.findUnique({ where: { id }, select: { ownerId: true } });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId) throw new ForbiddenException('Not allowed to delete this record');
    await this.prisma.record.delete({ where: { id } });
    return { ok: true };
  }

  async shareRecord(userId: number, id: number, title?: string | null, tags?: string[]) {
    const exists = await this.prisma.record.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Record not found');
    return this.prisma.recordShare.create({ data: { recordId: id, userId, title: title ?? null, tags: tags ?? [] } });
  }

  async favoriteRecord(userId: number, id: number) {
    const exists = await this.prisma.record.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Record not found');
    return this.prisma.recordFavorite.upsert({
      where: { recordId_userId: { recordId: id, userId } },
      create: { recordId: id, userId },
      update: {},
    });
  }

  async unfavoriteRecord(userId: number, id: number) {
    const key = { recordId_userId: { recordId: id, userId } } as const;
    // Delete if exists; ignore if not
    try {
      await this.prisma.recordFavorite.delete({ where: key });
    } catch {
      // no-op
    }
    return { ok: true };
  }

  async getComments(id: number) {
    const exists = await this.prisma.record.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Record not found');
    return this.prisma.recordComment.findMany({
      where: { recordId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }

  async addComment(userId: number, id: number, type: string | undefined, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Comment must not be empty');
    const exists = await this.prisma.record.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Record not found');
    return this.prisma.recordComment.create({
      data: { recordId: id, authorId: userId, type: type ?? 'static', content: trimmed },
    });
  }

  async exportRecord(id: number) {
    const record = await this.prisma.record.findUnique({
      where: { id },
      include: { moves: true, bookmarks: true },
    });
    if (!record) throw new NotFoundException('Record not found');
    // Simple JSON export structure (can be extended to PGN/CSV later)
    return {
      meta: {
        id: record.id,
        opponent: record.opponent,
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        result: record.result,
        endReason: record.endReason,
        keyTags: record.keyTags,
      },
      moves: record.moves,
      bookmarks: record.bookmarks,
    };
  }

  async addBookmark(userId: number, id: number, step: number, label?: string, note?: string) {
    const record = await this.prisma.record.findUnique({ where: { id }, select: { ownerId: true } });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId) throw new ForbiddenException('Not allowed to modify bookmarks for this record');
    if (!Number.isInteger(step) || step < 0) throw new BadRequestException('Invalid step');
    const moveExists = await this.prisma.move.findUnique({
      where: { recordId_moveIndex: { recordId: id, moveIndex: step } },
      select: { id: true },
    });
    if (!moveExists) throw new NotFoundException('Move step not found');
    // Upsert to avoid duplicate error on unique(recordId, step)
    return this.prisma.bookmark.upsert({
      where: { recordId_step: { recordId: id, step } },
      create: { recordId: id, step, label: label ?? 'bookmark', note: note ?? '' },
      update: { label: label ?? 'bookmark', note: note ?? '' },
    });
  }

  async updateBookmark(userId: number, recordId: number, bookmarkId: number, label?: string, note?: string) {
    const record = await this.prisma.record.findUnique({ where: { id: recordId }, select: { ownerId: true } });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId) throw new ForbiddenException('Not allowed to modify bookmarks for this record');
    const bm = await this.prisma.bookmark.findUnique({ where: { id: bookmarkId }, select: { recordId: true } });
    if (!bm || bm.recordId !== recordId) throw new NotFoundException('Bookmark not found');
    return this.prisma.bookmark.update({
      where: { id: bookmarkId },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(note !== undefined ? { note } : {}),
      },
    });
  }

  async removeBookmark(userId: number, recordId: number, bookmarkId: number) {
    const record = await this.prisma.record.findUnique({ where: { id: recordId }, select: { ownerId: true } });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId) throw new ForbiddenException('Not allowed to modify bookmarks for this record');
    const bm = await this.prisma.bookmark.findUnique({ where: { id: bookmarkId }, select: { recordId: true } });
    if (!bm || bm.recordId !== recordId) return { ok: true };
    await this.prisma.bookmark.delete({ where: { id: bookmarkId } });
    return { ok: true };
  }

  async getRetentionPrefs(userId: number) {
    const pref = await this.prisma.userRecordPreference.findUnique({ where: { userId } });
    return { userId, retentionLimit: pref?.retentionLimit ?? 200 };
  }

  async updateRetentionPrefs(userId: number, prefs: any) {
    const limit = Number(prefs?.retentionLimit);
    if (!Number.isFinite(limit) || limit <= 0) throw new BadRequestException('Invalid retentionLimit');
    const updated = await this.prisma.userRecordPreference.upsert({
      where: { userId },
      create: { userId, retentionLimit: limit },
      update: { retentionLimit: limit },
    });
    return { userId: updated.userId, retentionLimit: updated.retentionLimit };
  }
}