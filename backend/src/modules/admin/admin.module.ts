import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminActionService } from './admin-action.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommunityModule } from '../community/community.module';

@Module({
    imports: [
        PrismaModule,
        CommunityModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'dev-secret',
            signOptions: { expiresIn: '4h' },
        }),
    ],
    controllers: [AdminController],
    providers: [AdminService, AdminActionService],
    exports: [AdminService, AdminActionService],
})
export class AdminModule { }
