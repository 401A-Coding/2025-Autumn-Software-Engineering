import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @HttpCode(200)
  async me(@Headers('authorization') authorization?: string) {
    return this.userService.getMe(authorization);
  }

  @Patch('me')
  @HttpCode(200)
  async updateMe(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateUserDto,
  ) {
    // 支持 avatarUrl/password 以及 nickname（映射到 username）
    return this.userService.updateMe(authorization, dto);
  }

  @Post('me/avatar')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!file || !file.buffer || !file.mimetype) {
      throw new BadRequestException('缺少文件');
    }
    // 将文件转为 data URL，直接存入 avatarUrl，避免静态存储配置
    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    await this.userService.updateMe(authorization, { avatarUrl: dataUrl });
    return { url: dataUrl };
  }
}
