import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PostCommentsQueryDto {
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
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

    @IsOptional()
    @IsInt()
    parentId?: number; // 用于楼中楼回复
}
