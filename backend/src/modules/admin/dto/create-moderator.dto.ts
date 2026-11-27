import { NormalizeText } from '../../../decorators/normalize-text.decorator';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';
import { ActionNoteDto } from './action-note.dto';

// Admin không nhập mật khẩu: worker tự sinh rồi gửi qua email
export class CreateModeratorDto extends ActionNoteDto {
  @IsNormalizedEmail()
  email: string;

  @NormalizeText()
  @MaxLength(100, { message: 'Tên hiển thị quá dài' })
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString({ message: 'Tên hiển thị không hợp lệ' })
  name: string;
}
