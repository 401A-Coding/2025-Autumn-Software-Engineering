import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
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
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;
    return this.recordService.findAllPaginated(p, ps);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
    @Param('bid') bid: string,
    @Body() dto: BookmarkUpdateDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService.updateBookmark(userId, +id, +bid, dto.label, dto.note);
  }

  @Delete(':id/bookmarks/:bid')
  @UseGuards(JwtAuthGuard)
  removeBookmark(
    @Param('id') id: string,
    @Param('bid') bid: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const userId = req.user!.sub;
    return this.recordService.removeBookmark(userId, +id, +bid);
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
