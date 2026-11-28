import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  Matches,
} from 'class-validator';
import { SearchPageQuery } from '../../../utils/dto/search-page.query';

export const UNCATEGORIZED = 'none';

export class ListPublisherBooksQuery extends SearchPageQuery {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @Matches(
    /^(none|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
    { each: true, message: 'Thể loại không hợp lệ' },
  )
  @ArrayUnique({ message: 'Thể loại bị trùng' })
  @ArrayMaxSize(10, { message: 'Chọn tối đa 10 thể loại' })
  @IsArray({ message: 'Thể loại không hợp lệ' })
  @IsOptional()
  genres: string[] = [];
}
