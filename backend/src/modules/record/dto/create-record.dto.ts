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
import { PieceDto } from '../../board/dto/piece.dto';

class PosDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}

// 复用棋子 DTO，享受后端统一归一化与校验

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

  @ValidateNested()
  @Type(() => PieceDto)
  piece!: PieceDto;

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

  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  keyTags!: string[];

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => MoveDto)
  moves!: MoveDto[];

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
