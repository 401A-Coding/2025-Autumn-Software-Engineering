import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { RecordService } from './record.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('api/v1/records')
export class RecordController {
  constructor(private readonly recordService: RecordService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createRecordDto: CreateRecordDto) {
    return this.recordService.create(createRecordDto);
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

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateRecordDto: UpdateRecordDto) {
  //   return this.recordService.update(+id, updateRecordDto);
  // }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.recordService.remove(+id);
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  shareRecord(@Param('id') id: string) {
    return this.recordService.shareRecord(+id);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  favoriteRecord(@Param('id') id: string) {
    return this.recordService.favoriteRecord(+id);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  unfavoriteRecord(@Param('id') id: string) {
    return this.recordService.unfavoriteRecord(+id);
  }

  @Get(':id/comments')
  // 评论列表可公开浏览
  getComments(@Param('id') id: string) {
    return this.recordService.getComments(+id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(@Param('id') id: string, @Body('comment') comment: string) {
    return this.recordService.addComment(+id, comment);
  }

  @Get(':id/export')
  // 导出可公开；如需限制可加 @UseGuards(JwtAuthGuard)
  exportRecord(@Param('id') id: string) {
    return this.recordService.exportRecord(+id);
  }

  @Post(':id/bookmarks')
  @UseGuards(JwtAuthGuard)
  addBookmark(@Param('id') id: string) {
    return this.recordService.addBookmark(+id);
  }

  @Patch(':id/bookmarks')
  @UseGuards(JwtAuthGuard)
  updateBookmark(@Param('id') id: string, @Body('notes') notes: string) {
    return this.recordService.updateBookmark(+id, notes);
  }

  @Delete(':id/bookmarks')
  @UseGuards(JwtAuthGuard)
  removeBookmark(@Param('id') id: string) {
    return this.recordService.removeBookmark(+id);
  }

  // 个人对局记录保留条数设置
  @Get('prefs')
  @UseGuards(JwtAuthGuard)
  getRetentionPrefs() {
    return this.recordService.getRetentionPrefs();
  }

  // 个人对局记录保留条数修改
  @Patch('prefs')
  @UseGuards(JwtAuthGuard)
  updateRetentionPrefs(@Body('prefs') prefs: any) {
    return this.recordService.updateRetentionPrefs(prefs);
  }

}
