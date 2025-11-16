import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export type DirectionName = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export class RaySpecDto {
  @IsOptional()
  @IsArray()
  @IsIn(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'], { each: true })
  directions?: DirectionName[];

  // 可选：使用向量描述方向
  @IsOptional()
  @IsArray()
  @IsArray({ each: true })
  vectors?: [number, number][];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSteps?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  requireScreensForMove?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  requireScreensForCapture?: number;

  @IsOptional()
  @IsBoolean()
  stopAtFirstBlocker?: boolean;
}

export class StepSpecDto {
  @IsArray()
  @IsNumber({}, { each: true })
  offset!: [number, number];

  @IsOptional()
  @IsArray()
  @IsArray({ each: true })
  requiredEmpty?: [number, number][];

  @IsOptional()
  @IsBoolean()
  allowCapture?: boolean;
}

export class MoveSpecDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RaySpecDto)
  @IsArray()
  rays?: RaySpecDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StepSpecDto)
  @IsArray()
  steps?: StepSpecDto[];

  // 直接来自 UI 的格子掩码（相对坐标）
  @IsOptional()
  @IsArray()
  @IsArray({ each: true })
  gridMask?: [number, number][];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxDestinations?: number;
}

export class ConstraintsSpecDto {
  @IsOptional()
  @IsEnum({
    none: 'none',
    insideOnly: 'insideOnly',
    outsideOnly: 'outsideOnly',
  })
  palace?: 'none' | 'insideOnly' | 'outsideOnly';

  @IsOptional()
  @IsEnum({
    none: 'none',
    cannotCross: 'cannotCross',
    mustCross: 'mustCross',
  })
  river?: 'none' | 'cannotCross' | 'mustCross';

  @IsOptional()
  @IsBoolean()
  forwardOnlyBeforeRiver?: boolean;

  @IsOptional()
  @IsBoolean()
  enableSidewaysAfterRiver?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBackwardAfterRiver?: boolean;
}

export class PieceRuleConfigDto {
  @IsEnum({ template: 'template', custom: 'custom' })
  ruleType!: 'template' | 'custom';

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoveSpecDto)
  movement?: MoveSpecDto;

  @IsOptional()
  @IsEnum({ sameAsMove: 'sameAsMove', separate: 'separate' })
  captureMode?: 'sameAsMove' | 'separate';

  @IsOptional()
  @ValidateNested()
  @Type(() => MoveSpecDto)
  capture?: MoveSpecDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConstraintsSpecDto)
  constraints?: ConstraintsSpecDto;
}

export type PieceType =
  | 'general'
  | 'advisor'
  | 'elephant'
  | 'horse'
  | 'chariot'
  | 'cannon'
  | 'soldier';

export class RulesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  ruleVersion?: number;

  @IsEnum({ empty: 'empty', standard: 'standard', template: 'template' })
  layoutSource!: 'empty' | 'standard' | 'template';

  @IsOptional()
  @IsInt()
  templateRefId?: number;

  @IsOptional()
  @IsEnum({ relativeToSide: 'relativeToSide', absolute: 'absolute' })
  coordinateSystem?: 'relativeToSide' | 'absolute';

  @IsOptional()
  @IsEnum({ analysis: 'analysis', localVersus: 'localVersus' })
  mode?: 'analysis' | 'localVersus';

  // 以记录映射的方式保存每种棋子的规则
  @IsObject()
  pieceRules!: Record<string, PieceRuleConfigDto>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  templatesUsed?: string[];
}

export function defaultRules(): RulesDto {
  return {
    ruleVersion: 1,
    layoutSource: 'empty',
    coordinateSystem: 'relativeToSide',
    mode: 'analysis',
    pieceRules: {},
    notes: '',
  };
}
