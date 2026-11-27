import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { NormalizeText } from '../../../decorators/normalize-text.decorator';
import { ContributorRole } from '../../books/entities/book.entity';

export const BOOK_TITLE_MAX_LENGTH = 500;
export const BOOK_DESCRIPTION_MAX_LENGTH = 5000;
export const CONTRIBUTORS_MAX = 20;
export const BOOK_GENRES_MAX = 10;

export class ContributorDto {
  @NormalizeText()
  @MaxLength(200, { message: 'Tên người đóng góp quá dài' })
  @IsNotEmpty({ message: 'Tên người đóng góp không được để trống' })
  @IsString({ message: 'Tên người đóng góp không hợp lệ' })
  name: string;

  @IsEnum(ContributorRole, { message: 'Vai trò người đóng góp không hợp lệ' })
  role: ContributorRole;
}

export const ContributorType = () => Type(() => ContributorDto);

export const TrimText = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export const LowercaseList = () =>
  Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item: unknown) =>
          typeof item === 'string' ? item.toLowerCase() : item,
        )
      : value,
  );

export const HasAuthor = () =>
  ValidateBy({
    name: 'hasAuthor',
    validator: {
      validate: (value: unknown) =>
        Array.isArray(value) &&
        value.some(
          (item: unknown) =>
            (item as { role?: unknown } | null)?.role ===
            ContributorRole.AUTHOR,
        ),
      defaultMessage: () => 'Cần ít nhất một tác giả',
    },
  });

export const IsNotFutureYear = () =>
  ValidateBy({
    name: 'isNotFutureYear',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'number' && value <= new Date().getFullYear(),
      defaultMessage: () => 'Năm xuất bản không được lớn hơn năm hiện tại',
    },
  });
