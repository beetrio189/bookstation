import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { isUniqueViolation } from '../../utils/database-errors';
import { SearchPageQuery } from '../../utils/dto/search-page.query';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { escapeLike } from '../../utils/escape-like';
import { nextFreeSlug, slugify } from '../../utils/slug';
import { writeSystemLog } from '../admin/write-system-log';
import { GenreFieldsDto } from './dto/genre-fields.dto';
import { Genre } from './entities/genre.entity';

const SLUG_FALLBACK = 'the-loai';

export interface GenreCreated {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface GenreUpdated {
  id: string;
  name: string;
  slug: string;
  updatedAt: Date;
}

export interface GenreItem {
  id: string;
  name: string;
  slug: string;
  bookCount?: number;
  createdAt?: Date;
}

export interface GenrePage {
  items: GenreItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class GenresService {
  constructor(
    @InjectRepository(Genre)
    private readonly genresRepository: Repository<Genre>,
  ) {}

  /** Lọc tên chứa q (không phân biệt dấu), chỉ xếp theo tên; withStats cho trang quản trị */
  async list(
    { page, limit, q }: SearchPageQuery,
    withStats = false,
  ): Promise<GenrePage> {
    const query = this.genresRepository
      .createQueryBuilder('genre')
      .select('genre.id', 'id')
      .addSelect('genre.name', 'name')
      .addSelect('genre.slug', 'slug');

    if (withStats) {
      query
        .addSelect(
          '(SELECT count(*)::int FROM book_genres bg WHERE bg.genre_id = genre.id)',
          'bookCount',
        )
        .addSelect('genre.created_at', 'createdAt');
    }

    if (q) {
      query.where('f_unaccent(genre.name) ILIKE f_unaccent(:like)', {
        like: `%${escapeLike(q)}%`,
      });
    }

    const total = await query.clone().getCount();
    const items = await query
      .orderBy('genre.name', 'ASC')
      .addOrderBy('genre.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<GenreItem>();

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Slug sinh từ tên; trùng tên (bỏ hoa thường, dấu) hoặc slug → 409 do DB báo */
  async create(
    actorId: string,
    { name, note }: GenreFieldsDto,
  ): Promise<GenreCreated> {
    try {
      const genre = await this.genresRepository.manager.transaction(
        async (manager) => {
          const created = await manager.save(
            manager.create(Genre, {
              name,
              slug: await this.freeSlug(manager, name),
            }),
          );

          await writeSystemLog(manager, actorId, {
            actionType: SystemActionType.GENRE_CREATION,
            targetId: created.id,
            targetName: name,
            note,
          });

          return created;
        },
      );

      return {
        id: genre.id,
        name: genre.name,
        slug: genre.slug,
        createdAt: genre.createdAt,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.GENRE_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  /** Đổi tên thì slug sinh lại (link cũ hỏng, chấp nhận); tên không đổi thì không ghi gì */
  async update(
    actorId: string,
    id: string,
    { name, note }: GenreFieldsDto,
  ): Promise<GenreUpdated> {
    try {
      const genre = await this.genresRepository.manager.transaction(
        async (manager) => {
          const current = await this.lockGenre(manager, id);

          if (current.name === name) {
            return current;
          }

          current.name = name;
          current.slug = await this.freeSlug(manager, name, id);
          const saved = await manager.save(current);

          await writeSystemLog(manager, actorId, {
            actionType: SystemActionType.GENRE_UPDATE,
            targetId: id,
            targetName: name,
            note,
          });

          return saved;
        },
      );

      return {
        id: genre.id,
        name: genre.name,
        slug: genre.slug,
        updatedAt: genre.updatedAt,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.GENRE_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  /** Xóa hẳn; book_genres CASCADE nên sách chỉ mất thể loại này (có thể thành chưa phân loại) */
  async remove(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    await this.genresRepository.manager.transaction(async (manager) => {
      const genre = await this.lockGenre(manager, id);

      await manager.delete(Genre, { id });

      await writeSystemLog(manager, actorId, {
        actionType: SystemActionType.GENRE_DELETION,
        targetId: id,
        targetName: genre.name,
        note,
      });
    });

    return {};
  }

  private async lockGenre(manager: EntityManager, id: string): Promise<Genre> {
    const genre = await manager.findOne(Genre, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!genre) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return genre;
  }

  private async freeSlug(
    manager: EntityManager,
    name: string,
    exceptId?: string,
  ): Promise<string> {
    const base = slugify(name, SLUG_FALLBACK);
    const query = manager
      .createQueryBuilder(Genre, 'genre')
      .select('genre.slug', 'slug')
      .where('genre.slug ~ :pattern', { pattern: `^${base}(-[0-9]+)?$` });

    if (exceptId) {
      query.andWhere('genre.id <> :exceptId', { exceptId });
    }

    const taken = await query.getRawMany<{ slug: string }>();

    return nextFreeSlug(
      base,
      taken.map(({ slug }) => slug),
    );
  }
}
