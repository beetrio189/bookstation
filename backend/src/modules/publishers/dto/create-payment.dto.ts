import { IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID(undefined, { message: 'Gói không hợp lệ' })
  planId: string;
}
