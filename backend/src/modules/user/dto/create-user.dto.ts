import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  type?: string; // 'phone' - for API v1 compatibility

  // 使用手机号注册
  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  code?: string; // SMS verification code (optional)

  @IsString()
  @MinLength(6)
  password!: string;
}
