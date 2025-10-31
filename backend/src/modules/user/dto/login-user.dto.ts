import { IsString, MinLength } from 'class-validator';

export class LoginUserDto {
  // 使用手机号登录
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
