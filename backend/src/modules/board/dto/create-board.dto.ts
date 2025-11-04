import { IsOptional, IsString, Validate } from "class-validator";
import { IsEmptyObject } from 'src/common/validators/is-empty-object.validator';

export class CreateBoardDto {

    @IsString({ message: "name必须是string类型" })
    name!: string;

    @IsOptional()
    @IsString({ message: "description必须是string类型" })
    description?: string;

    @Validate(IsEmptyObject)
    layout!: {};

    @Validate(IsEmptyObject)
    rules!: {};
}
