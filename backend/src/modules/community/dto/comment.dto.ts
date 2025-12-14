import { IsInt, IsOptional, IsString } from 'class-validator';

export class PostCommentsQueryDto {
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  pageSize?: number = 20;
}

export class CommentCreateDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  step?: number;

  @IsString()
  content!: string;
}
