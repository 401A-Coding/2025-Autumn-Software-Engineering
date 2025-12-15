import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { RecordService } from './record.service';
import { CreateRecordDto } from './dto/create-record.dto';
// import { UpdateRecordDto } from './dto/update-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';
import { BookmarkCreateDto } from './dto/bookmark-create.dto';
import { BookmarkUpdateDto } from './dto/bookmark-update.dto';
import { BookmarkDeleteDto } from './dto/bookmark-delete.dto';

@Controller('api/v1/records')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createRecordDto: CreateRecordDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    // 返回完整的 record，以与前端 OpenAPI 契约对齐
    return this.recordService
      .create(userId, createRecordDto)
      .then((record) => ({ code: 0, message: 'success', data: record }));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .update(userId, +id, body)
      .then((data) => ({ code: 0, message: 'success', data }));
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('favorite') favorite?: string,
    @Query('result') result?: string,
    @Req() req?: Request & { user?: { sub: number } },
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;
    const fav =
      typeof favorite === 'string'
        ? favorite.toLowerCase() === 'true'
          ? true
          : favorite.toLowerCase() === 'false'
            ? false
            : undefined
        : undefined;
    const userId = req!.user!.sub;
    return this.recordService
      .findAllPaginated(userId, p, ps, fav, result)
      .then((res) => ({ code: 0, message: 'success', data: res }));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .findOne(userId, +id)
      .then((data) => ({ code: 0, message: 'success', data }));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .remove(userId, +id)
      .then(() => ({ code: 0, message: 'success', data: {} }));
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  shareRecord(
    @Param('id') id: string,
    @Body('title') title: string | undefined,
    @Body('tags') tags: string[] | undefined,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .shareRecord(userId, +id, title, tags)
      .then((share) => ({
        code: 0,
        message: 'success',
        data: { shareId: share.id },
      }));
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  favoriteRecord(
    @Param('id') id: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .favoriteRecord(userId, +id)
      .then(() => ({ code: 0, message: 'success', data: {} }));
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  unfavoriteRecord(
    @Param('id') id: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .unfavoriteRecord(userId, +id)
      .then(() => ({ code: 0, message: 'success', data: {} }));
  }

  @Get(':id/comments')
  // 评论列表可公开浏览
  getComments(@Param('id') id: string) {
    return this.recordService
      .getComments(+id)
      .then((data) => ({ code: 0, message: 'success', data }));
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(
    @Param('id') id: string,
    @Body('type') type: string | undefined,
    @Body('content') content: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .addComment(userId, +id, type, content)
      .then((c) => ({
        code: 0,
        message: 'success',
        data: { commentId: c.id },
      }));
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard)
  exportRecord(@Param('id') id: string) {
    return this.recordService
      .exportRecord(+id)
      .then((data) => ({ code: 0, message: 'success', data }));
  }

  @Post(':id/bookmarks')
  @UseGuards(JwtAuthGuard)
  addBookmark(
    @Param('id') id: string,
    @Body() dto: BookmarkCreateDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .addBookmark(userId, +id, dto.step, dto.label, dto.note)
      .then((bm) => ({ code: 0, message: 'success', data: { id: bm.id } }));
  }

  @Patch(':id/bookmarks/:bid')
  @UseGuards(JwtAuthGuard)
  updateBookmark(
    @Param('id') id: string,
    @Param('bid') bid: string,
    @Body() dto: BookmarkUpdateDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .updateBookmark(userId, +id, +bid, dto.label, dto.note)
      .then(() => ({ code: 0, message: 'success', data: {} }));
  }

  @Delete(':id/bookmarks/:bid')
  @UseGuards(JwtAuthGuard)
  removeBookmark(
    @Param('id') id: string,
    @Param('bid') bid: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService
      .removeBookmark(userId, +id, +bid)
      .then(() => ({ code: 0, message: 'success', data: {} }));
  }

  // 个人对局记录保留条数设置
  @Get('prefs')
  @UseGuards(JwtAuthGuard)
  getRetentionPrefs(@Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    // 将后端字段映射为 keepLimit 以与前端契约一致
    return this.recordService.getRetentionPrefs(userId).then((data) => ({
      code: 0,
      message: 'success',
      data: {
        keepLimit: (data as any).retentionLimit ?? 30,
        autoCleanEnabled: (data as any).autoCleanEnabled ?? true,
        updatedAt: (data as any).updatedAt,
      },
    }));
  }

  // 个人对局记录保留条数修改
  @Patch('prefs')
  @UseGuards(JwtAuthGuard)
  updateRetentionPrefs(
    @Body() prefs: any,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    // 接受 { keepLimit?: number, autoCleanEnabled?: boolean } 直接体
    return this.recordService
      .updateRetentionPrefs(userId, prefs)
      .then((data) => ({
        code: 0,
        message: 'success',
        data: {
          keepLimit: (data as any).retentionLimit,
          autoCleanEnabled: (data as any).autoCleanEnabled,
        },
      }));
  }
}
