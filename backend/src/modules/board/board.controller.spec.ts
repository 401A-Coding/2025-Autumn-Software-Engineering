import { Test, TestingModule } from '@nestjs/testing';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BoardController', () => {
  let controller: BoardController;

  beforeEach(async () => {
    const prismaMock: Partial<PrismaService> = {
      board: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as unknown as PrismaService['board'],
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardController],
      providers: [
        BoardService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<BoardController>(BoardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
