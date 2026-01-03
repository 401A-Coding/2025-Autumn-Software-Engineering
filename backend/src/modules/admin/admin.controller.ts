import {
  Controller,
  Get,
  Query,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CommunityService } from '../community/community.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AdminActionService } from './admin-action.service';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly actionService: AdminActionService,
    private readonly communityService: CommunityService,
  ) {}

  @Get('users')
  @Roles('ADMIN')
  async listUsers(@Query('q') q?: string) {
    return this.adminService.listUsers({ q });
  }

  @Patch('users/:id/role')
  @Roles('ADMIN')
  async updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    // Prevent admin from changing their own role
    if (req?.user?.sub === id) {
      try {
        await this.actionService.log(
          req.user.sub,
          'forbidden_self_action',
          'USER',
          id,
          { op: 'update_role' },
          req.ip,
          req.headers['user-agent'],
        );
      } catch {}
      throw new BadRequestException('不能修改自己的角色');
    }
    const result = await this.adminService.updateUserRole(id, dto);

    // write audit log
    try {
      await this.actionService.log(
        req.user.sub,
        'update_user_role',
        'USER',
        id,
        {
          newRole: dto.role,
        },
        req.ip,
        req.headers['user-agent'],
      );
    } catch (e) {
      // do not block main flow on audit errors
      console.error('Failed to write admin action log', e);
    }

    return result;
  }

  @Patch('users/:id/ban')
  @Roles('ADMIN')
  async banUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: import('./dto/ban-user.dto').BanUserDto,
    @Req() req: any,
  ) {
    // Prevent admin from banning themselves
    if (req?.user?.sub === id) {
      try {
        await this.actionService.log(
          req.user.sub,
          'forbidden_self_action',
          'USER',
          id,
          { op: 'ban_user' },
          req.ip,
          req.headers['user-agent'],
        );
      } catch {}
      throw new BadRequestException('不能封禁自己');
    }
    const result = await this.adminService.banUser(id, dto);
    try {
      await this.actionService.log(
        req.user.sub,
        'ban_user',
        'USER',
        id,
        dto,
        req.ip,
        req.headers['user-agent'],
      );
      // create moderator action so affected user can see reason
      await this.actionService.createModeratorAction(
        req.user.sub,
        'ban',
        'USER',
        id,
        dto.reason ?? undefined,
        { days: dto.days },
      );
    } catch (e) {
      console.error('Failed to write admin action log', e);
    }
    return result;
  }

  @Patch('users/:id/unban')
  @Roles('ADMIN')
  async unbanUser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    // Prevent admin from unbanning themselves (not necessary but consistent)
    if (req?.user?.sub === id) {
      try {
        await this.actionService.log(
          req.user.sub,
          'forbidden_self_action',
          'USER',
          id,
          { op: 'unban_user' },
          req.ip,
          req.headers['user-agent'],
        );
      } catch {}
      throw new BadRequestException('不能对自己执行此操作');
    }
    const result = await this.adminService.unbanUser(id);
    try {
      await this.actionService.log(
        req.user.sub,
        'unban_user',
        'USER',
        id,
        {},
        req.ip,
        req.headers['user-agent'],
      );
    } catch (e) {
      console.error('Failed to write admin action log', e);
    }
    return result;
  }

  @Get('posts')
  @Roles('ADMIN')
  async listPosts(@Query('q') q?: string, @Query('status') status?: string) {
    return this.adminService.listPosts({ q, status });
  }

  @Delete('posts/:id')
  @Roles('ADMIN')
  async removePost(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.adminService.removePost(id, req.user?.sub);
    try {
      await this.actionService.log(
        req.user.sub,
        'remove_post',
        'POST',
        id,
        {},
        req.ip,
        req.headers['user-agent'],
      );
      await this.actionService.createModeratorAction(
        req.user.sub,
        'remove',
        'POST',
        id,
        undefined,
        {},
      );
    } catch (e) {
      console.error('Failed to write admin action log', e);
    }
    return result;
  }

  @Delete('comments/:id')
  @Roles('ADMIN')
  async deleteComment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() body?: { reason?: string },
  ) {
    const reason = body?.reason;
    const r = await this.communityService.adminDeleteComment(
      req.user.sub,
      id,
      reason,
    );
    try {
      await this.actionService.log(
        req.user.sub,
        'remove_comment',
        'COMMENT',
        id,
        { reason },
        req.ip,
        req.headers['user-agent'],
      );
      await this.actionService.createModeratorAction(
        req.user.sub,
        'remove',
        'COMMENT',
        id,
        reason,
        {},
      );
    } catch (e) {
      console.error('Failed to write admin action log', e);
    }
    return r;
  }

  @Patch('posts/:id/restore')
  @Roles('ADMIN')
  async restorePost(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.adminService.restorePost(id);
    try {
      await this.actionService.log(
        req.user.sub,
        'restore_post',
        'POST',
        id,
        {},
        req.ip,
        req.headers['user-agent'],
      );
    } catch (e) {
      console.error('Failed to write admin action log', e);
    }
    return result;
  }

  @Get('logs')
  @Roles('ADMIN')
  async listLogs(@Query('adminId') adminId?: number) {
    return this.adminService.listLogs({ adminId });
  }

  @Get('reports')
  @Roles('ADMIN')
  async listReports(
    @Query('targetType') targetType?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const normalizedType = targetType
      ? String(targetType).toUpperCase()
      : undefined;
    return this.adminService.listReports({
      targetType: normalizedType,
      status,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 200,
    });
  }
}
