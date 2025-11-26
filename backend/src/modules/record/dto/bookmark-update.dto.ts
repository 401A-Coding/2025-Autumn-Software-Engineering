import { IsString, IsOptional } from 'class-validator';

export class BookmarkUpdateDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
