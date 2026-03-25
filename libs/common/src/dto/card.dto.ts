import { IsCreditCard, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from "class-validator";

export class CardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  token?: string;

  @ValidateIf((card: CardDto) => !card.token)
  @IsString()
  @IsNotEmpty()
  cvc: string;
  
  @ValidateIf((card: CardDto) => !card.token)
  @IsNumber()
  exp_month: number;

  @ValidateIf((card: CardDto) => !card.token)
  @IsNumber()
  exp_year: number;
 
  @ValidateIf((card: CardDto) => !card.token)
  @IsCreditCard()
  number: string;
}