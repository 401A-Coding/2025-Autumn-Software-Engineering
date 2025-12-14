import { ValidateNested, IsArray, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer'; // 用于嵌套对象的类型转换
import { PieceDto } from './piece.dto';

export class LayoutDto {
  @IsArray({ message: 'pieces 必须是数组' })
  @ValidateNested({ each: true }) // 对数组中的每个元素应用 PieceDto 验证
  @Type(() => PieceDto) // 配合 class-transformer 将元素转换为 PieceDto 实例
  pieces!: PieceDto[];

  // 记录先手（残局/自定义棋局），可选
  @IsOptional()
  @IsIn(['red', 'black'], { message: 'turn 必须是 red 或 black' })
  turn?: 'red' | 'black';
}
