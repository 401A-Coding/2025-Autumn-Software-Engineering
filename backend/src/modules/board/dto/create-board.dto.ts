import { IsObject, IsOptional, IsString } from "class-validator";

export class CreateBoardDto {

    @IsString({ message: "name必须是string类型" })
    name!: string;

    @IsOptional()
    @IsString({ message: "description必须是string类型" })
    description?: string;

    @IsObject({ message: "layout必须是object类型" })
    layout!: Record<string, any>;

    @IsObject({ message: "rules必须是object类型" })
    rules!: Record<string, any>;
}
