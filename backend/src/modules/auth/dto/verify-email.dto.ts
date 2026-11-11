import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class VerifyEmailDto {
  @IsUUID('all', { message: 'Mã xác nhận không hợp lệ' })
  uid: string;

  @IsString({ message: 'Mã xác nhận không hợp lệ' })
  @IsNotEmpty({ message: 'Thiếu mã xác nhận' })
  token: string;
}
