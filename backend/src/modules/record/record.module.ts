import { Module } from '@nestjs/common';
import { RecordService } from './record.service';
import { RecordController } from './record.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
    }),
  ],
  controllers: [RecordController],
  providers: [RecordService, JwtAuthGuard],
  exports: [RecordService],
})
export class RecordModule {}
