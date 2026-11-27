import { NormalizeText } from '../../decorators/normalize-text.decorator';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchPageQuery {
  @Type(() => Number)
  @IsInt({ message: 'Số trang không hợp lệ' })
  @Min(1, { message: 'Số trang không hợp lệ' })
  page: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'Số dòng mỗi trang không hợp lệ' })
  @Min(1, { message: 'Số dòng mỗi trang không hợp lệ' })
  @Max(100, { message: 'Số dòng mỗi trang không hợp lệ' })
  limit: number = 20;

  @NormalizeText()
  @MaxLength(100, { message: 'Từ khóa quá dài' })
  @IsString({ message: 'Từ khóa không hợp lệ' })
  q: string = '';
}
