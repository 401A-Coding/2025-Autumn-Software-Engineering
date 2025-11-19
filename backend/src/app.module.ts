import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { BattleModule } from './modules/battle/battle.module';
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [PrismaModule, UserModule, BattleModule, MetricsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
