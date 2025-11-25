import { Injectable } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';

@Injectable()
export class RecordService {
  create(userId: number, createRecordDto: CreateRecordDto) {
    return { msg: 'Create record', userId, dto: createRecordDto };
  }

  findAll() {
    return { msg: 'List records' };
  }

  findOne(id: number) {
    return { msg: 'Get record detail', id };
  }

  // update(userId: number, id: number, updateRecordDto: UpdateRecordDto) {
  //   return { msg: 'Update record', userId, id, dto: updateRecordDto };
  // }

  remove(userId: number, id: number) {
    return { msg: 'Remove record', userId, id };
  }

  shareRecord(userId: number, id: number) {
    return { msg: 'Share record', userId, id };
  }

  favoriteRecord(userId: number, id: number) {
    return { msg: 'Favorite record', userId, id };
  }

  unfavoriteRecord(userId: number, id: number) {
    return { msg: 'Unfavorite record', userId, id };
  }

  getComments(id: number) {
    return { msg: 'Get comments', id };
  }

  addComment(userId: number, id: number, comment: string) {
    return { msg: 'Add comment', userId, id, comment };
  }

  exportRecord(id: number) {
    return { msg: 'Export record', id };
  }

  addBookmark(userId: number, id: number) {
    return { msg: 'Add bookmark', userId, id };
  }

  updateBookmark(userId: number, id: number, notes: string) {
    return { msg: 'Update bookmark', userId, id, notes };
  }

  removeBookmark(userId: number, id: number) {
    return { msg: 'Remove bookmark', userId, id };
  }

  getRetentionPrefs(userId: number) {
    return { msg: 'Get retention prefs', userId };
  }

  updateRetentionPrefs(userId: number, prefs: any) {
    return { msg: 'Update retention prefs', userId, prefs };
  }
}