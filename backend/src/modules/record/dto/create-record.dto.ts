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
  @IsString()
  @IsIn([
    'general', // 将/帅
    'advisor', // 士/仕
    'elephant', // 象/相
    'horse', // 马
    'chariot', // 车
    'cannon', // 炮
    'soldier', // 卒/兵
  ])
  @IsNotEmpty()
  type!: string;

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

  @IsInt()
  @Min(0)
  timeSpentMs!: number;
}

class BookmarkDto {
  @IsInt()
  @Min(0)
  id!: number;

  @IsInt()
  @Min(0)
  step!: number;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  note!: string;

  @Type(() => Date)
  @IsDate()
  createdAt!: Date;

  @Type(() => Date)
  @IsDate()
  updatedAt!: Date;
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
  @IsNotEmpty()
  result!: string;

  @IsString()
  @IsNotEmpty()
  endReason!: string;

  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  keyTags!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MoveDto)
  moves!: MoveDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookmarkDto)
  bookmarks?: BookmarkDto[];
}
