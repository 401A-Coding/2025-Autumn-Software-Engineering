import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { instanceToPlain } from 'class-transformer';
import { Prisma } from '@prisma/client';

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) { }  // Assume prisma is properly injected
  create(createBoardDto: CreateBoardDto, ownerId?: number) {
    return this.prisma.board.create({
      data: {
        name: createBoardDto.name,
        description: createBoardDto.description,
        layout: instanceToPlain(createBoardDto.layout) as Prisma.InputJsonObject,
        rules: instanceToPlain(createBoardDto.rules) as Prisma.InputJsonObject,
        preview: createBoardDto.preview,
        ownerId: ownerId ?? undefined,
        isTemplate: createBoardDto.isTemplate ?? false,
      }
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

  async update(id: number, updateBoardDto: UpdateBoardDto) {
    // Build partial update payload, converting nested DTOs to JSON where needed
    const data: Prisma.BoardUpdateInput = {
      ...(updateBoardDto.name !== undefined ? { name: updateBoardDto.name } : {}),
      ...(updateBoardDto.description !== undefined ? { description: updateBoardDto.description } : {}),
      ...(updateBoardDto.layout !== undefined ? { layout: instanceToPlain(updateBoardDto.layout) as Prisma.InputJsonObject } : {}),
      ...(updateBoardDto.rules !== undefined ? { rules: updateBoardDto.rules as Prisma.InputJsonObject } : {}),
      ...(updateBoardDto.preview !== undefined ? { preview: updateBoardDto.preview } : {}),
      ...(updateBoardDto.isTemplate !== undefined ? { isTemplate: updateBoardDto.isTemplate } : {}),
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
