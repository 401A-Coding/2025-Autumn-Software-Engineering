import { IsString } from 'class-validator';

export class SmsRequestDto {
  @IsString()
  phone!: string;
}
