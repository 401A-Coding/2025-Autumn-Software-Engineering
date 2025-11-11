import { Injectable } from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { instanceToPlain } from 'class-transformer';
import { Prisma } from '@prisma/client';

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) { }  // Assume prisma is properly injected
  async create(createBoardDto: CreateBoardDto, ownerId?: number) {
    return this.prisma.board.create({
      data: {
        name: createBoardDto.name,
        description: createBoardDto.description,
        layout: instanceToPlain(createBoardDto.layout) as Prisma.InputJsonObject,
        rules: createBoardDto.rules as Prisma.InputJsonObject,
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

  findOne(id: number) {
    return `This action returns a #${id} board`;
  }

  update(id: number, updateBoardDto: UpdateBoardDto) {
    return `This action updates a #${id} board`;
  }

  remove(id: number) {
    return `This action removes a #${id} board`;
  }
}
