import { IsString, MinLength, IsOptional } from 'class-validator';

export class LoginUserDto {
  @IsOptional()
  @IsString()
  type?: string; // 'phone' - for API v1 compatibility

  // 使用手机号登录
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
