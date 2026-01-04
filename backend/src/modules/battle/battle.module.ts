import { Module, forwardRef } from '@nestjs/common';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { BattlesController } from './battles.controller';
import { ChessEngineService } from './engine.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MetricsModule } from '../metrics/metrics.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RecordModule } from '../record/record.module';
import { BoardModule } from '../board/board.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
    }),
    PrismaModule,
    MetricsModule,
    EventEmitterModule.forRoot(),
    forwardRef(() => RecordModule),
    BoardModule,
  ],
  controllers: [BattlesController],
  providers: [BattlesService, BattlesGateway, ChessEngineService, JwtAuthGuard],
  exports: [BattlesService],
})
export class BattleModule {}
