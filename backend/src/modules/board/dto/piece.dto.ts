import { IsIn, IsNumber, IsString } from 'class-validator';

export class PieceDto {
  @IsString()
  @IsIn(
    [
      'general', // 将/帅
      'advisor', // 士/仕
      'elephant', // 象/相
      'horse', // 马
      'chariot', // 车
      'cannon', // 炮
      'soldier', // 卒/兵
    ],
    { message: 'Invalid piece type' },
  )
  type!: string;

  @IsString()
  @IsIn(['red', 'black'], { message: "Color must be either 'red' or 'black'" })
  color!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}
