import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { BattleModule } from './modules/battle/battle.module';
import { BoardModule } from './modules/board/board.module';
import { RecordModule } from './modules/record/record.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { CommunityModule } from './modules/community/community.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    BattleModule,
    MetricsModule,
    BoardModule,
    RecordModule,
    CommunityModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
