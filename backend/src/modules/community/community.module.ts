import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '30m' },
    }),
  ],
  controllers: [CommunityController],
  providers: [CommunityService, JwtAuthGuard],
})
export class CommunityModule {}
