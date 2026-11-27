import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { NormalizeText } from '../../../decorators/normalize-text.decorator';
import { ActionNoteDto } from '../../admin/dto/action-note.dto';
import { COVER_PUBLIC_ID_PATTERN } from '../../books/cover.constants';
import {
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_GENRES_MAX,
  BOOK_TITLE_MAX_LENGTH,
  ContributorDto,
  ContributorType,
  CONTRIBUTORS_MAX,
  HasAuthor,
  IsNotFutureYear,
  LowercaseList,
  TrimText,
} from './book-fields';

export class BookDto extends ActionNoteDto {
  @NormalizeText()
  @MaxLength(BOOK_TITLE_MAX_LENGTH, { message: 'Tên sách quá dài' })
  @IsNotEmpty({ message: 'Tên sách không được để trống' })
  @IsString({ message: 'Tên sách không hợp lệ' })
  title: string;

  @TrimText()
  @MaxLength(BOOK_DESCRIPTION_MAX_LENGTH, { message: 'Giới thiệu quá dài' })
  @IsString({ message: 'Giới thiệu không hợp lệ' })
  @IsOptional()
  description?: string;

  @HasAuthor()
  @ValidateNested({ each: true })
  @ContributorType()
  @ArrayMaxSize(CONTRIBUTORS_MAX, {
    message: `Tối đa ${CONTRIBUTORS_MAX} người đóng góp`,
  })
  @ArrayMinSize(1, { message: 'Cần ít nhất một tác giả' })
  @IsArray({ message: 'Người đóng góp không hợp lệ' })
  contributors: ContributorDto[];

  @IsNotFutureYear()
  @Min(1, { message: 'Năm xuất bản không hợp lệ' })
  @IsInt({ message: 'Năm xuất bản không hợp lệ' })
  @IsOptional()
  publishedYear?: number;

  @LowercaseList()
  @IsUUID('all', { each: true, message: 'Thể loại không hợp lệ' })
  @ArrayUnique({ message: 'Thể loại bị trùng' })
  @ArrayMaxSize(BOOK_GENRES_MAX, {
    message: `Chọn tối đa ${BOOK_GENRES_MAX} thể loại`,
  })
  @ArrayMinSize(1, { message: 'Chọn ít nhất một thể loại' })
  @IsArray({ message: 'Thể loại không hợp lệ' })
  genreIds: string[];

  @Matches(COVER_PUBLIC_ID_PATTERN, { message: 'Ảnh bìa không hợp lệ' })
  @IsOptional()
  coverPublicId?: string;
}
