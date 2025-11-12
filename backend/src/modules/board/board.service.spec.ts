import { Test, TestingModule } from '@nestjs/testing';
import { BoardService } from './board.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BoardService', () => {
  let service: BoardService;

  beforeEach(async () => {
    const prismaMock: Partial<PrismaService> = {
      // minimal board model stubs for tests

      board: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as unknown as PrismaService['board'],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<BoardService>(BoardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
