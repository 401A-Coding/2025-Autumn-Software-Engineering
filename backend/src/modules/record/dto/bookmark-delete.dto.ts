import { IsInt, Min } from 'class-validator';

export class BookmarkDeleteDto {
    @IsInt()
    @Min(0)
    step!: number;
}
