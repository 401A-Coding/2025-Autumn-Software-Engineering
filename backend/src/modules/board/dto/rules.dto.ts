import { IsInt } from "class-validator";

export class RulesDto {
    // Define the properties of the rules DTO here
    @IsInt({ message: 'rules.id must be an integer' })
    id: number;
}