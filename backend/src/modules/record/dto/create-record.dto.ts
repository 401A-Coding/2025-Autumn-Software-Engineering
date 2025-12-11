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

class PosDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}

class PieceDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'general',
    'advisor',
    'elephant',
    'horse',
    'chariot',
    'cannon',
    'soldier',
  ])
  type?: string;

  @IsString()
  @IsIn(['red', 'black'])
  side!: 'red' | 'black';
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
}
