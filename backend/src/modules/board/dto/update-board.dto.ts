import {
  IsOptional,
  IsString,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LayoutDto } from './layout.dto';

export class UpdateBoardDto {
  @IsOptional()
  @IsString({ message: 'Board name must be a string' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Board description must be a string' })
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LayoutDto)
  layout?: LayoutDto;

  // TODO: Add proper validation for rules
  @IsOptional()
  // 使用 unknown 而不是 {}，避免空对象类型报警；后续可替换为更具体的规则 DTO
  rules?: unknown;

  @IsOptional()
  @IsString({ message: 'Preview must be a string' })
  preview?: string;

  @IsOptional()
  @IsBoolean({ message: 'isTemplate must be a boolean' })
  isTemplate?: boolean;
}
