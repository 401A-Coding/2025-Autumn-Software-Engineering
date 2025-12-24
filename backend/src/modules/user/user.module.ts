import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret', // 建议改为 @nestjs/config
      signOptions: { expiresIn: '4h' },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [UserService, JwtAuthGuard],
})
export class UserModule { }
