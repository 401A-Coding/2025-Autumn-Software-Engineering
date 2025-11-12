import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { instanceToPlain } from 'class-transformer';
import { Prisma } from '@prisma/client';

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) {} // Assume prisma is properly injected
  /**
   * 返回中国象棋“标准开局”的只读定义（不落库）。
   * 结构与 Board Editor 的 LayoutDto/PieceDto 保持一致：
   * - layout: { pieces: { type, side, x, y }[] }
   * - rules: 暂以 { id: 1 } 作为占位符
   */
  standard() {
    const pieces = [
      // 黑方（上）
      { type: 'chariot', side: 'black', x: 0, y: 0 },
      { type: 'chariot', side: 'black', x: 8, y: 0 },
      { type: 'horse', side: 'black', x: 1, y: 0 },
      { type: 'horse', side: 'black', x: 7, y: 0 },
      { type: 'elephant', side: 'black', x: 2, y: 0 },
      { type: 'elephant', side: 'black', x: 6, y: 0 },
      { type: 'advisor', side: 'black', x: 3, y: 0 },
      { type: 'advisor', side: 'black', x: 5, y: 0 },
      { type: 'general', side: 'black', x: 4, y: 0 },
      { type: 'cannon', side: 'black', x: 1, y: 2 },
      { type: 'cannon', side: 'black', x: 7, y: 2 },
      { type: 'soldier', side: 'black', x: 0, y: 3 },
      { type: 'soldier', side: 'black', x: 2, y: 3 },
      { type: 'soldier', side: 'black', x: 4, y: 3 },
      { type: 'soldier', side: 'black', x: 6, y: 3 },
      { type: 'soldier', side: 'black', x: 8, y: 3 },
      // 红方（下）
      { type: 'chariot', side: 'red', x: 0, y: 9 },
      { type: 'chariot', side: 'red', x: 8, y: 9 },
      { type: 'horse', side: 'red', x: 1, y: 9 },
      { type: 'horse', side: 'red', x: 7, y: 9 },
      { type: 'elephant', side: 'red', x: 2, y: 9 },
      { type: 'elephant', side: 'red', x: 6, y: 9 },
      { type: 'advisor', side: 'red', x: 3, y: 9 },
      { type: 'advisor', side: 'red', x: 5, y: 9 },
      { type: 'general', side: 'red', x: 4, y: 9 },
      { type: 'cannon', side: 'red', x: 1, y: 7 },
      { type: 'cannon', side: 'red', x: 7, y: 7 },
      { type: 'soldier', side: 'red', x: 0, y: 6 },
      { type: 'soldier', side: 'red', x: 2, y: 6 },
      { type: 'soldier', side: 'red', x: 4, y: 6 },
      { type: 'soldier', side: 'red', x: 6, y: 6 },
      { type: 'soldier', side: 'red', x: 8, y: 6 },
    ];
    return {
      name: '标准开局',
      description: '中国象棋标准开局布局',
      layout: { pieces },
      rules: { id: 1 },
      preview: '',
      isTemplate: true,
    };
  }
  create(createBoardDto: CreateBoardDto, ownerId?: number) {
    return this.prisma.board.create({
      data: {
        name: createBoardDto.name,
        description: createBoardDto.description,
        layout: instanceToPlain(
          createBoardDto.layout,
        ) as Prisma.InputJsonObject,
        rules: instanceToPlain(
          createBoardDto.rules ?? {},
        ) as Prisma.InputJsonObject,
        preview: createBoardDto.preview,
        ownerId: ownerId ?? undefined,
        isTemplate: createBoardDto.isTemplate ?? false,
      },
    });
  }

  findTemplates() {
    return this.prisma.board.findMany({
      where: { isTemplate: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findMine(ownerId: number) {
    return this.prisma.board.findMany({
      where: { ownerId, isTemplate: false },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const board = await this.prisma.board.findUnique({
      where: { id },
    });
    if (!board) {
      throw new NotFoundException(`Board ${id} not found`);
    }
    return board;
  }

  async findMinePaginated(ownerId: number, page = 1, pageSize = 10) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.board.findMany({
        where: { ownerId, isTemplate: false },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.board.count({ where: { ownerId, isTemplate: false } }),
    ]);
    return { items, page: Math.max(page, 1), pageSize: take, total };
  }

  async update(id: number, updateBoardDto: UpdateBoardDto) {
    // Build partial update payload, converting nested DTOs to JSON where needed
    const data: Prisma.BoardUpdateInput = {
      ...(updateBoardDto.name !== undefined
        ? { name: updateBoardDto.name }
        : {}),
      ...(updateBoardDto.description !== undefined
        ? { description: updateBoardDto.description }
        : {}),
      ...(updateBoardDto.layout !== undefined
        ? {
            layout: instanceToPlain(
              updateBoardDto.layout,
            ) as Prisma.InputJsonObject,
          }
        : {}),
      ...(updateBoardDto.rules !== undefined
        ? { rules: updateBoardDto.rules as Prisma.InputJsonObject }
        : {}),
      ...(updateBoardDto.preview !== undefined
        ? { preview: updateBoardDto.preview }
        : {}),
      ...(updateBoardDto.isTemplate !== undefined
        ? { isTemplate: updateBoardDto.isTemplate }
        : {}),
    };
    return await this.prisma.board.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return await this.prisma.board.delete({ where: { id } });
  }
}
