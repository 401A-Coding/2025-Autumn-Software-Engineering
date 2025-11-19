import { Module } from '@nestjs/common';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { BattlesController } from './battles.controller';
import { ChessEngineService } from './engine.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
    }),
  ],
  controllers: [BattlesController],
  providers: [BattlesService, BattlesGateway, ChessEngineService, JwtAuthGuard],
  exports: [BattlesService],
})
export class BattleModule {}
