import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PostsQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  @IsIn(['record', 'board', 'clip', 'none'])
  type?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  authorId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['new', 'hot'])
  sort?: string = 'new';
}

export class PostCreateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  shareType?: string | null;

  @IsOptional()
  @IsInt()
  shareRefId?: number | null;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class PostPatchDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
