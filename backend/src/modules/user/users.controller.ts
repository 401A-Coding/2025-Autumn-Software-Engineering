import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user?: { sub: number } }) {
    return this.userService.getMeByUserId(req.user!.sub);
  }

  @Get('me/moderation')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async getMyModeration(@Req() req: Request & { user?: { sub: number } }) {
    const actions = await this.userService.getModerationActionsForUser(
      req.user!.sub,
    );
    return { code: 0, message: 'success', data: actions };
  }

  // 搜索用户（必须在 :id 路由之前）
  @Get('search-by-name')
  @HttpCode(200)
  async searchUsers(@Query('q') q: string) {
    if (!q || q.trim().length === 0) {
      return { code: 0, message: 'success', data: [] };
    }
    const users = await this.userService.searchUsers(q);
    return { code: 0, message: 'success', data: users };
  }

  // 获取指定用户的公开信息（仅返回非敏感字段）
  @Get(':id')
  @HttpCode(200)
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getPublicProfileById(id);
  }

  @Patch('me')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @Req() req: Request & { user?: { sub: number } },
    @Body() dto: UpdateUserDto,
  ) {
    // 支持 avatarUrl/password 以及 nickname（映射到 username）
    return this.userService.updateMeByUserId(req.user!.sub, dto);
  }

  @Post('me/avatar')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Req() req: Request & { user?: { sub: number } },
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!file || !file.buffer || !file.mimetype) {
      throw new BadRequestException('缺少文件');
    }
    // 将文件转为 data URL，直接存入 avatarUrl，避免静态存储配置
    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    await this.userService.updateMeByUserId(req.user!.sub, {
      avatarUrl: dataUrl,
    });
    return { url: dataUrl };
  }
}
