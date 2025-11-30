import { Test, TestingModule } from '@nestjs/testing';
import { RecordService } from './record.service';
import { PrismaModule } from '../../prisma/prisma.module';

describe('RecordService', () => {
  let service: RecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [RecordService],
    }).compile();

    service = module.get<RecordService>(RecordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
