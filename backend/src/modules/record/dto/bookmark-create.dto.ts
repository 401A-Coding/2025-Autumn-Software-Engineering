import { IsInt, Min, IsString, IsNotEmpty } from 'class-validator';

export class BookmarkCreateDto {
    @IsInt()
    @Min(0)
    step!: number;

    @IsString()
    @IsNotEmpty()
    label!: string;

    @IsString()
    @IsNotEmpty()
    note!: string;
}
