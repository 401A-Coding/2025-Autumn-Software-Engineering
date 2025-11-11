import { Module } from '@nestjs/common';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { BattlesController } from './battles.controller';
import { ChessEngineService } from './engine.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
    }),
  ],
  controllers: [BattlesController],
  providers: [BattlesService, BattlesGateway, ChessEngineService],
  exports: [BattlesService],
})
export class BattleModule {}
