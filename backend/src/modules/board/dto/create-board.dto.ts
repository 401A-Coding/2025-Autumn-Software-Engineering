import { IsOptional, IsString, ValidateNested, IsBoolean } from "class-validator";
import { LayoutDto } from "./layout.dto";
import { Type } from "class-transformer";

export class CreateBoardDto {

    @IsString({ message: "Board name must be a string" })
    name!: string;

    @IsOptional()
    @IsString({ message: "Board description must be a string" })
    description?: string;

    @ValidateNested()
    @Type(() => LayoutDto)
    layout!: LayoutDto;

    // TODO: Add proper validation for rules
    rules!: {};

    @IsString({ message: "Preview must be a string" })
    preview?: string;

    @IsOptional()
    @IsBoolean({ message: "isTemplate must be a boolean" })
    isTemplate?: boolean;
}
