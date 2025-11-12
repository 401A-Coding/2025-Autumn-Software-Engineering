/* eslint-disable @typescript-eslint/no-require-imports */
import type { PrismaService as PrismaServiceT } from './prisma.service';
import { Test, TestingModule } from '@nestjs/testing';

// Mock PrismaClient to avoid requiring a generated @prisma/client during unit tests on environments
// where prisma generate may not have run (e.g., CI/Windows with locked files).
jest.mock('@prisma/client', () => ({ PrismaClient: class {} }), {
  virtual: true,
});

// Use require after jest.mock so that PrismaService loads with the mocked PrismaClient
const { PrismaService } = require('./prisma.service') as {
  PrismaService: new (...args: any[]) => PrismaServiceT;
};

describe('PrismaService', () => {
  let service: PrismaServiceT;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaServiceT>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
