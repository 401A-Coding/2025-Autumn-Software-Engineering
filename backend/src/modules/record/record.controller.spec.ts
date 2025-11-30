import { Test, TestingModule } from '@nestjs/testing';
import { RecordController } from './record.controller';
import { RecordService } from './record.service';
import { PrismaService } from '../../prisma/prisma.service';

// 关键：完全 mock 掉 JwtAuthGuard 所在的模块，不让 Nest 用真实类
jest.mock('../../common/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

describe('RecordController', () => {
  let controller: RecordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordController],
      providers: [
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: RecordService,
          useValue: {
            // 只提供最基础的空实现，这个测试不会真正调用它们
            create: jest.fn(),
            findAllPaginated: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            shareRecord: jest.fn(),
            favoriteRecord: jest.fn(),
            unfavoriteRecord: jest.fn(),
            getComments: jest.fn(),
            addComment: jest.fn(),
            exportRecord: jest.fn(),
            addBookmark: jest.fn(),
            updateBookmark: jest.fn(),
            removeBookmark: jest.fn(),
            getRetentionPrefs: jest.fn(),
            updateRetentionPrefs: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RecordController>(RecordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
