import { IsOptional, IsString, MinLength, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'avatarUrl must be a URL' })
  avatarUrl?: string | null;
}
