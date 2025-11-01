import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

// New contract-first endpoints with unified envelope
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @HttpCode(200)
  async register(@Body() dto: CreateUserDto) {
    const tokens = await this.userService.register(dto);
    return { code: 0, message: '注册成功', data: tokens };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginUserDto) {
    const tokens = await this.userService.login(dto);
    return { code: 0, message: '登录成功', data: tokens };
  }
}
