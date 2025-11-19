import {
  IsOptional,
  IsString,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LayoutDto } from './layout.dto';
import { RulesDto } from './rules.dto';

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

  // 自定义规则的部分更新
  @IsOptional()
  @ValidateNested()
  @Type(() => RulesDto)
  rules?: Partial<RulesDto>;

  @IsOptional()
  @IsString({ message: 'Preview must be a string' })
  preview?: string;

  @IsOptional()
  @IsBoolean({ message: 'isTemplate must be a boolean' })
  isTemplate?: boolean;
}
