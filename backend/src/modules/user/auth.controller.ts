import { Controller, Post, Body, HttpCode, Headers } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// New contract-first endpoints with unified envelope
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly userService: UserService) { }

  @Post('register')
  @HttpCode(200)
  async register(@Body() dto: CreateUserDto) {
    return this.userService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginUserDto) {
    return this.userService.login(dto);
  }

  @Post('sms')
  @HttpCode(200)
  sendSms() {
    // TODO: Implement SMS service integration
    // For now, return a mock response
    return {
      requestId: `sms_${Date.now()}`,
      expireIn: 300,
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('authorization') authorization?: string) {
    await this.userService.logoutByAccessToken(authorization);
    return {};
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.userService.refresh(dto.refreshToken);
  }

  @Post('request-reset')
  @HttpCode(200)
  async requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.userService.requestPasswordReset(dto.phone);
  }

  @Post('reset')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto) {
    return this.userService.resetPassword(dto.phone, dto.requestId, dto.newPassword);
  }
}
