import { IsInt, Min, IsString, IsOptional } from 'class-validator';

export class BookmarkUpdateDto {
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
