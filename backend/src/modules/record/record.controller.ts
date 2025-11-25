import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RecordService } from './record.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';

@Controller('api/v1/records')
export class RecordController {
  constructor(private readonly recordService: RecordService) { }

  @Post()
  create(@Body() createRecordDto: CreateRecordDto) {
    return this.recordService.create(createRecordDto);
  }

  @Get()
  findAll() {
    return this.recordService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recordService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateRecordDto: UpdateRecordDto) {
  //   return this.recordService.update(+id, updateRecordDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recordService.remove(+id);
  }

  @Post(':id/share')
  shareRecord(@Param('id') id: string) {
    return this.recordService.shareRecord(+id);
  }

  @Post(':id/favorite')
  favoriteRecord(@Param('id') id: string) {
    return this.recordService.favoriteRecord(+id);
  }

  @Delete(':id/favorite')
  unfavoriteRecord(@Param('id') id: string) {
    return this.recordService.unfavoriteRecord(+id);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.recordService.getComments(+id);
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body('comment') comment: string) {
    return this.recordService.addComment(+id, comment);
  }

  @Get(':id/export')
  exportRecord(@Param('id') id: string) {
    return this.recordService.exportRecord(+id);
  }

  @Post(':id/bookmarks')
  addBookmark(@Param('id') id: string) {
    return this.recordService.addBookmark(+id);
  }

  @Patch(':id/bookmarks')
  updateBookmark(@Param('id') id: string, @Body('notes') notes: string) {
    return this.recordService.updateBookmark(+id, notes);
  }

  @Delete(':id/bookmarks')
  removeBookmark(@Param('id') id: string) {
    return this.recordService.removeBookmark(+id);
  }

  @Get('prefs')
  getRetentionPrefs() {
    return this.recordService.getRetentionPrefs();
  }

  @Patch('prefs')
  updateRetentionPrefs(@Body('prefs') prefs: any) {
    return this.recordService.updateRetentionPrefs(prefs);
  }

}
