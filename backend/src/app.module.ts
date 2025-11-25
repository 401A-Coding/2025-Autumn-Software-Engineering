import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { BattleModule } from './modules/battle/battle.module';
import { BoardModule } from './modules/board/board.module';
import { RecordModule } from './modules/record/record.module';

@Module({
  imports: [PrismaModule, UserModule, BattleModule, BoardModule, RecordModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
