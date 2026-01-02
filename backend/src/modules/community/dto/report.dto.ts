import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';

export class ReportCreateDto {
  @IsString()
  @IsIn(['post', 'comment', 'record'])
  targetType!: string; // expected: 'post' | 'comment' | 'record' (lowercase)

  @IsInt()
  targetId!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
