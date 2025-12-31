import { IsOptional, IsInt, Min, IsString } from 'class-validator';

export class BanUserDto {
    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    days?: number; // ban duration in days
}
