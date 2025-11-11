import { ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer'; // 用于嵌套对象的类型转换
import { PieceDto } from './piece.dto';

export class LayoutDto {
  @IsArray({ message: 'pieces 必须是数组' })
  @ValidateNested({ each: true }) // 对数组中的每个元素应用 PieceDto 验证
  @Type(() => PieceDto) // 配合 class-transformer 将元素转换为 PieceDto 实例
  pieces: PieceDto[];
}
