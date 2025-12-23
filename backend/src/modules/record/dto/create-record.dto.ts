import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsIn,
  IsObject,
} from 'class-validator';
// 注意：棋步中的棋子仅需要标识阵营与类型，不需要坐标

class PosDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}

// 复用棋子 DTO，享受后端统一归一化与校验

class MovePieceDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  side?: string; // 'red' | 'black'
}

class MoveDto {
  @IsInt()
  @Min(0)
  moveIndex!: number;

  @ValidateNested()
  @Type(() => PosDto)
  from!: PosDto;

  @ValidateNested()
  @Type(() => PosDto)
  to!: PosDto;

  // 对于移动记录，仅需要棋子阵营/类型，坐标由 from/to 表达
  @IsOptional()
  @ValidateNested()
  @Type(() => MovePieceDto)
  piece?: MovePieceDto;

  @IsOptional()
  @IsString()
  capturedType?: string;

  @IsOptional()
  @IsString()
  capturedSide?: string; // typically 'red' | 'black'

  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentMs?: number;
}

class BookmarkDto {
  @IsInt()
  @Min(0)
  step!: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateRecordDto {
  @IsString()
  @IsNotEmpty()
  opponent!: string;

  @Type(() => Date)
  @IsDate()
  startedAt!: Date;

  @Type(() => Date)
  @IsDate()
  endedAt!: Date;

  @IsString()
  @IsOptional()
  result?: string;

  @IsOptional()
  @IsString()
  endReason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  keyTags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => MoveDto)
  moves?: MoveDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookmarkDto)
  bookmarks?: BookmarkDto[];

  // 起始布局（残局/自定义棋局用）：{ pieces: [{ type, side, x, y }] }
  @IsOptional()
  @IsObject()
  initialLayout?: any;

  // 对战模式：standard=标准对战，custom=自定义规则对战
  @IsOptional()
  @IsString()
  @IsIn(['standard', 'custom'])
  mode?: 'standard' | 'custom';

  // 自定义对战的完整棋盘布局（二维数组格式）
  @IsOptional()
  customLayout?: any;

  // 自定义规则（CustomRuleSet 格式）
  @IsOptional()
  customRules?: any;
}
