import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeText } from '../../../decorators/normalize-text.decorator';
import { ActionNoteDto } from '../../admin/dto/action-note.dto';

// Body tạo và đổi tên thể loại: { name, note? }
export class GenreFieldsDto extends ActionNoteDto {
  @NormalizeText()
  @MaxLength(100, { message: 'Tên thể loại quá dài' })
  @IsNotEmpty({ message: 'Tên thể loại không được để trống' })
  @IsString({ message: 'Tên thể loại không hợp lệ' })
  name: string;
}
