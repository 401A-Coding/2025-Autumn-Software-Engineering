import { IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { LayoutDto } from "./layout.dto";

export class UpdateBoardDto {
    @IsOptional()
    @IsString({ message: 'Board name must be a string' })
    name?: string;

    @IsOptional()
    @IsString({ message: 'Board description must be a string' })
    description?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => LayoutDto)
    layout?: LayoutDto;

    // TODO: Add proper validation for rules
    @IsOptional()
    rules?: {};

    @IsString({ message: "Preview must be a string" })
    preview?: string;
}
