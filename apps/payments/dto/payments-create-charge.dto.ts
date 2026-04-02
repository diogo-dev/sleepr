import { IsEmail } from "class-validator";
import { CreateChargeDto } from "@app/common";

export class PaymentsCreateChargeDto extends CreateChargeDto {
  @IsEmail()
  email: string;
} 