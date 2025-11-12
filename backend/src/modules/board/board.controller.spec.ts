import { Test, TestingModule } from '@nestjs/testing';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

describe('BoardController', () => {
  let controller: BoardController;
  let service: BoardService;

  beforeEach(async () => {
    const prismaMock = {
      board: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardController],
      providers: [
        BoardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    controller = module.get<BoardController>(BoardController);
    service = module.get<BoardService>(BoardService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('update should forbid editing system template', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      ownerId: null,
      isTemplate: true,
    } as any);
    const dto: import('./dto/update-board.dto').UpdateBoardDto = { name: 'x' };
    type ReqT = Request & { user?: { sub: number } };
    const req = { user: { sub: 42 } } as unknown as ReqT;
    await expect(controller.update(1, dto, req)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('remove should forbid deleting system template', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      ownerId: null,
      isTemplate: true,
    } as any);
    type ReqT = Request & { user?: { sub: number } };
    const req = { user: { sub: 42 } } as unknown as ReqT;
    await expect(controller.remove(1, req)).rejects.toThrow(ForbiddenException);
  });

  it('update should forbid non-owner editing user template', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 2,
      ownerId: 100,
      isTemplate: true,
    } as any);
    const dto: import('./dto/update-board.dto').UpdateBoardDto = {
      description: 'tweak',
    };
    type ReqT = Request & { user?: { sub: number } };
    const req = { user: { sub: 101 } } as unknown as ReqT;
    await expect(controller.update(2, dto, req)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
