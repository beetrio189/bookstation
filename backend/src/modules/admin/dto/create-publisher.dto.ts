import { NormalizeText } from '../../../decorators/normalize-text.decorator';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';
import { RequiredNoteDto } from './required-note.dto';

/**
 * Không nhập mật khẩu (worker tự sinh rồi gửi email). Ghi chú bắt buộc: email
 * đơn đăng ký và ngày gửi, vì giấy tờ của NXB chỉ nằm trong hộp thư.
 * Trường lạ (subscriptionTier...) bị ValidationPipe bỏ đi.
 */
export class CreatePublisherDto extends RequiredNoteDto {
  @IsNormalizedEmail()
  email: string;

  @NormalizeText()
  @MaxLength(255, { message: 'Tên nhà xuất bản quá dài' })
  @IsNotEmpty({ message: 'Tên nhà xuất bản không được để trống' })
  @IsString({ message: 'Tên nhà xuất bản không hợp lệ' })
  publisherName: string;
}
