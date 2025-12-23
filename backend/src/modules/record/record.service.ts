import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateRecordDto) {
    // 基础校验（放宽 result / endReason；moves 可为空）
    if (!dto?.opponent || !dto?.startedAt || !dto?.endedAt) {
      throw new BadRequestException('Missing required record fields');
    }

    // Enforce retention limit only for non-favorites
    const pref = await this.prisma.userRecordPreference.findUnique({
      where: { userId },
    });
    const limit = pref?.retentionLimit ?? 30;
    const autoClean = pref?.autoCleanEnabled ?? true;

    const movesInput = (dto as any).moves ?? [];
    const bookmarksInput = (dto as any).bookmarks ?? [];

    let record: any;
    const baseData = {
      ownerId: userId,
      opponent: dto.opponent,
      startedAt: new Date(dto.startedAt),
      endedAt: new Date(dto.endedAt),
      result: dto.result ?? 'unknown',
      endReason: dto.endReason ?? 'unknown',
      keyTags: dto.keyTags ?? [],
      moves:
        Array.isArray(movesInput) && movesInput.length > 0
          ? {
              create: movesInput.map((m: any) => ({
                moveIndex: m.moveIndex,
                fromX: m.from?.x ?? m.fromX ?? 0,
                fromY: m.from?.y ?? m.fromY ?? 0,
                toX: m.to?.x ?? m.toX ?? 0,
                toY: m.to?.y ?? m.toY ?? 0,
                pieceType: m.piece?.type ?? m.pieceType ?? 'unknown',
                pieceSide: m.piece?.side ?? m.pieceSide ?? 'red',
                capturedType: m.capturedType ?? null,
                capturedSide: m.capturedSide ?? null,
                timeSpentMs: m.timeSpentMs ?? 0,
                san: m.san ?? null,
              })),
            }
          : undefined,
      bookmarks:
        Array.isArray(bookmarksInput) && bookmarksInput.length > 0
          ? {
              create: bookmarksInput.map((b: any) => ({
                step: b.step,
                label: b.label ?? 'bookmark',
                note: b.note ?? '',
              })),
            }
          : undefined,
    } as any;

    try {
      record = await this.prisma.record.create({
        data: {
          ...baseData,
          initialLayout: (dto as any).initialLayout ?? null,
          mode: (dto as any).mode ?? null,
          customLayout: (dto as any).customLayout ?? null,
          customRules: (dto as any).customRules ?? null,
        },
        include: { moves: true, bookmarks: true },
      });
    } catch (e: any) {
      // 兼容未迁移/未生成 Prisma Client 的情况：回退为不写 initialLayout 也能保存
      record = await this.prisma.record.create({
        data: baseData,
        include: { moves: true, bookmarks: true },
      });
      // 保留 initialLayout 在返回体中，供前端立即复盘使用（数据库可能还未存）
      record.initialLayout = (dto as any).initialLayout ?? null;
    }

    // Count and clean non-favorite records for this user if enabled
    if (autoClean) {
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
        if (ids.length)
          await this.prisma.record.deleteMany({ where: { id: { in: ids } } });
      }
    }

    return record;
  }

  async findAll() {
    // Basic list, newest first. Can be extended to paginate/filter later.
    const items = await this.prisma.record.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        favorites: true,
        shares: true,
      },
    });
    // Normalize ongoing records: treat 'unknown' as 'unfinished' for UI
    return items.map((r: any) => ({
      ...r,
      result: r.result === 'unknown' ? 'unfinished' : r.result,
    }));
  }

  async findAllPaginated(
    userId: number,
    page = 1,
    pageSize = 10,
    favorite?: boolean,
    result?: string,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where: any = { ownerId: userId };
    if (favorite === true) where.favorites = { some: { userId } };
    if (favorite === false) where.favorites = { none: { userId } };
    if (result) where.result = result;
    const [rawItems, total] = await Promise.all([
      this.prisma.record.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          owner: { select: { id: true, username: true, avatarUrl: true } },
          moves: true,
          favorites: true,
          shares: true,
        },
      }),
      this.prisma.record.count({ where }),
    ]);
    const items = rawItems.map((r: any) => ({
      ...r,
      result: r.result === 'unknown' ? 'unfinished' : r.result,
    }));
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
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
        favorites: true,
        shares: true,
      },
    });
    if (!record) throw new NotFoundException('Record not found');
    return {
      ...record,
      result:
        (record as any).result === 'unknown'
          ? 'unfinished'
          : (record as any).result,
    } as any;
  }

  async remove(userId: number, id: number) {
    const record = await this.prisma.record.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId)
      throw new ForbiddenException('Not allowed to delete this record');
    await this.prisma.record.delete({ where: { id } });
    return { ok: true };
  }

  async update(userId: number, id: number, patch: any) {
    const existing = await this.prisma.record.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!existing) throw new NotFoundException('Record not found');
    if (existing.ownerId !== userId)
      throw new ForbiddenException('Not allowed to update this record');

    const data: any = {};
    if (Array.isArray(patch?.keyTags)) {
      const tags = (patch.keyTags as any[])
        .map((t) => (typeof t === 'string' ? t.trim() : String(t)))
        .filter((t) => !!t);
      data.keyTags = tags;
    }
    if (patch?.result && typeof patch.result === 'string') {
      data.result = patch.result;
    }
    if (Object.keys(data).length === 0) return this.findOne(userId, id);

    const updated = await this.prisma.record.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        favorites: true,
        shares: true,
        moves: true,
        bookmarks: true,
      },
    });
    return {
      ...updated,
      result:
        (updated as any).result === 'unknown'
          ? 'unfinished'
          : (updated as any).result,
    } as any;
  }

  async shareRecord(
    userId: number,
    id: number,
    title?: string | null,
    tags?: string[],
  ) {
    const exists = await this.prisma.record.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Record not found');
    return this.prisma.recordShare.create({
      data: { recordId: id, userId, title: title ?? null, tags: tags ?? [] },
    });
  }

  async favoriteRecord(userId: number, id: number) {
    const exists = await this.prisma.record.findUnique({
      where: { id },
      select: { id: true },
    });
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
    const exists = await this.prisma.record.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Record not found');
    return this.prisma.recordComment.findMany({
      where: { recordId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async addComment(
    userId: number,
    id: number,
    type: string | undefined,
    content: string,
  ) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Comment must not be empty');
    const exists = await this.prisma.record.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Record not found');
    return this.prisma.recordComment.create({
      data: {
        recordId: id,
        authorId: userId,
        type: type ?? 'static',
        content: trimmed,
      },
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
        initialLayout: (record as any).initialLayout ?? null,
      },
      moves: record.moves,
      bookmarks: record.bookmarks,
    };
  }

  async addBookmark(
    userId: number,
    id: number,
    step: number,
    label?: string,
    note?: string,
  ) {
    const record = await this.prisma.record.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId)
      throw new ForbiddenException(
        'Not allowed to modify bookmarks for this record',
      );
    if (!Number.isInteger(step) || step < 0)
      throw new BadRequestException('Invalid step');
    // Allow bookmarking the final position: step can equal moves.length
    const movesCount = await this.prisma.move.count({
      where: { recordId: id },
    });
    if (step < 0 || step > movesCount)
      throw new BadRequestException('Invalid step');
    // Upsert to avoid duplicate error on unique(recordId, step)
    return this.prisma.bookmark.upsert({
      where: { recordId_step: { recordId: id, step } },
      create: {
        recordId: id,
        step,
        label: label ?? 'bookmark',
        note: note ?? '',
      },
      update: { label: label ?? 'bookmark', note: note ?? '' },
    });
  }

  async updateBookmark(
    userId: number,
    recordId: number,
    bookmarkId: number,
    label?: string,
    note?: string,
  ) {
    const record = await this.prisma.record.findUnique({
      where: { id: recordId },
      select: { ownerId: true },
    });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId)
      throw new ForbiddenException(
        'Not allowed to modify bookmarks for this record',
      );
    const bm = await this.prisma.bookmark.findUnique({
      where: { id: bookmarkId },
      select: { recordId: true },
    });
    if (!bm || bm.recordId !== recordId)
      throw new NotFoundException('Bookmark not found');
    return this.prisma.bookmark.update({
      where: { id: bookmarkId },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(note !== undefined ? { note } : {}),
      },
    });
  }

  async removeBookmark(userId: number, recordId: number, bookmarkId: number) {
    const record = await this.prisma.record.findUnique({
      where: { id: recordId },
      select: { ownerId: true },
    });
    if (!record) throw new NotFoundException('Record not found');
    if (record.ownerId !== userId)
      throw new ForbiddenException(
        'Not allowed to modify bookmarks for this record',
      );
    const bm = await this.prisma.bookmark.findUnique({
      where: { id: bookmarkId },
      select: { recordId: true },
    });
    if (!bm || bm.recordId !== recordId) return { ok: true };
    await this.prisma.bookmark.delete({ where: { id: bookmarkId } });
    return { ok: true };
  }

  async getRetentionPrefs(userId: number) {
    const pref = await this.prisma.userRecordPreference.findUnique({
      where: { userId },
    });
    return {
      userId,
      retentionLimit: pref?.retentionLimit ?? 30,
      autoCleanEnabled: pref?.autoCleanEnabled ?? true,
      updatedAt: (pref as any)?.updatedAt,
    };
  }

  async updateRetentionPrefs(userId: number, prefs: any) {
    const updates: Record<string, any> = {};
    // 接收 keepLimit 或 retentionLimit，统一映射为 retentionLimit
    if (prefs && ('keepLimit' in prefs || 'retentionLimit' in prefs)) {
      const rawLimit =
        'keepLimit' in prefs ? prefs.keepLimit : prefs.retentionLimit;
      const limit = Number(rawLimit);
      if (!Number.isFinite(limit) || limit <= 0)
        throw new BadRequestException('Invalid retentionLimit');
      updates.retentionLimit = limit;
    }
    if (prefs && 'autoCleanEnabled' in prefs) {
      const raw = prefs.autoCleanEnabled;
      const val =
        typeof raw === 'boolean'
          ? raw
          : typeof raw === 'string'
            ? raw.toLowerCase() === 'true'
            : undefined;
      if (val === undefined)
        throw new BadRequestException('Invalid autoCleanEnabled');
      updates.autoCleanEnabled = val;
    }
    const updated = await this.prisma.userRecordPreference.upsert({
      where: { userId },
      create: {
        userId,
        retentionLimit: updates.retentionLimit ?? 30,
        autoCleanEnabled: updates.autoCleanEnabled ?? true,
      },
      update: updates,
    });
    return {
      userId: updated.userId,
      retentionLimit: updated.retentionLimit,
      autoCleanEnabled: updated.autoCleanEnabled,
    };
  }
}
