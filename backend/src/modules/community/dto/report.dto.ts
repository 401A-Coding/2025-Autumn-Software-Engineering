import { IsInt, IsOptional, IsString } from 'class-validator';

export class ReportCreateDto {
  @IsString()
  targetType!: string; // share|post|comment|record

  @IsInt()
  targetId!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
