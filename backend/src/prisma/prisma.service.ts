import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // cast `this` to a safe shape so TypeScript doesn't treat $connect as an unsafe "error" type
    await (this as unknown as { $connect: () => Promise<void> }).$connect();
  }

  async onModuleDestroy() {
    // cast `this` to a safe shape so TypeScript doesn't treat $disconnect as an unsafe "error" type
    await (
      this as unknown as { $disconnect: () => Promise<void> }
    ).$disconnect();
  }
}
