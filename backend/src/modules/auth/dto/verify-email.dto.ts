import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsString({ message: 'Mã xác nhận không hợp lệ' })
  @IsNotEmpty({ message: 'Thiếu mã xác nhận' })
  token: string;
}
