import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { BattleModule } from './modules/battle/battle.module';

@Module({
  imports: [PrismaModule, UserModule, BattleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
