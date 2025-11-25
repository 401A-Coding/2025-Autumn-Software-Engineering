import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { RecordService } from './record.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';
import { BookmarkCreateDto } from './dto/bookmark-create.dto';
import { BookmarkUpdateDto } from './dto/bookmark-update.dto';
import { BookmarkDeleteDto } from './dto/bookmark-delete.dto';

@Controller('api/v1/records')
export class RecordController {
  constructor(private readonly recordService: RecordService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createRecordDto: CreateRecordDto, @Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.create(userId, createRecordDto);
  }

  @Get()
  findAll() {
    return this.recordService.findAll();
  }

  @Get(':id')
  // 视业务是否需要公开对局详情，可选择加权限；这里默认公开
  findOne(@Param('id') id: string) {
    return this.recordService.findOne(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.remove(userId, +id);
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  shareRecord(@Param('id') id: string, @Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.shareRecord(userId, +id);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  favoriteRecord(@Param('id') id: string, @Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.favoriteRecord(userId, +id);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  unfavoriteRecord(@Param('id') id: string, @Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.unfavoriteRecord(userId, +id);
  }

  @Get(':id/comments')
  // 评论列表可公开浏览
  getComments(@Param('id') id: string) {
    return this.recordService.getComments(+id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(@Param('id') id: string, @Body('comment') comment: string, @Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.addComment(userId, +id, comment);
  }

  @Get(':id/export')
  // 导出可公开；如需限制可加 @UseGuards(JwtAuthGuard)
  exportRecord(@Param('id') id: string) {
    return this.recordService.exportRecord(+id);
  }

  @Post(':id/bookmarks')
  @UseGuards(JwtAuthGuard)
  addBookmark(
    @Param('id') id: string,
    @Body() dto: BookmarkCreateDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService.addBookmark(userId, +id, dto.step, dto.label, dto.note);
  }

  @Patch(':id/bookmarks/:bid')
  @UseGuards(JwtAuthGuard)
  updateBookmark(
    @Param('id') id: string,
    @Body() dto: BookmarkUpdateDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService.updateBookmark(userId, +id, dto.step, dto.note ?? '');
  }

  @Delete(':id/bookmarks/:bid')
  @UseGuards(JwtAuthGuard)
  removeBookmark(
    @Param('id') id: string,
    @Body() dto: BookmarkDeleteDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService.removeBookmark(userId, +id, dto.step);
  }

  // 个人对局记录保留条数设置
  @Get('prefs')
  @UseGuards(JwtAuthGuard)
  getRetentionPrefs(@Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.getRetentionPrefs(userId);
  }

  // 个人对局记录保留条数修改
  @Patch('prefs')
  @UseGuards(JwtAuthGuard)
  updateRetentionPrefs(@Body('prefs') prefs: any, @Req() req: Request & { user?: { sub: number } }) {
    const userId = req.user!.sub;
    return this.recordService.updateRetentionPrefs(userId, prefs);
  }

}
