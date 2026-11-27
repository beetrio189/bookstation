import { QueryFailedError, Repository } from 'typeorm';
import { SystemLog } from '../../../src/modules/system-logs/entities/system-log.entity';
import { SystemActionType } from '../../../src/utils/enums/system-action-type.enum';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import { GenresService } from '../../../src/modules/genres/genres.service';

describe('GenresService', () => {
  const queryBuilder: Record<string, jest.Mock> = {
    getCount: jest.fn(),
    getRawMany: jest.fn(),
  };
  for (const method of [
    'select',
    'addSelect',
    'where',
    'orderBy',
    'addOrderBy',
    'offset',
    'limit',
    'andWhere',
  ]) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }
  queryBuilder.clone = jest.fn(() => queryBuilder);

  const manager = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };
  manager.transaction.mockImplementation((run: (m: unknown) => unknown) =>
    run(manager),
  );
  const service = new GenresService({
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager,
  } as unknown as Repository<Genre>);
  const ACTOR = 'user-1';
  const createdAt = new Date('2026-11-24T00:00:00.000Z');
  const uniqueViolation = () =>
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('dup'), { code: '23505' }),
    );

  const ITEMS = [{ id: 'genre-1', name: 'Kinh tế', slug: 'kinh-te' }];

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.getCount.mockResolvedValue(41);
    queryBuilder.getRawMany.mockResolvedValue(ITEMS);
  });

  it('pages the genres sorted by name only', async () => {
    await expect(service.list({ page: 3, limit: 20, q: '' })).resolves.toEqual({
      items: ITEMS,
      page: 3,
      limit: 20,
      total: 41,
      totalPages: 3,
    });

    expect(queryBuilder.where).not.toHaveBeenCalled();
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('genre.name', 'ASC');
    expect(queryBuilder.offset).toHaveBeenCalledWith(40);
    expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    expect(queryBuilder.addSelect).not.toHaveBeenCalledWith(
      expect.stringContaining('book_genres'),
      'bookCount',
    );
  });

  it('filters by an accent-insensitive substring with LIKE characters escaped', async () => {
    await service.list({ page: 1, limit: 20, q: '50%_tre' });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'f_unaccent(genre.name) ILIKE f_unaccent(:like)',
      { like: '%50\\%\\_tre%' },
    );
  });

  it('adds bookCount and createdAt for the admin page', async () => {
    await service.list({ page: 1, limit: 20, q: '' }, true);

    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('FROM book_genres'),
      'bookCount',
    );
    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      'genre.created_at',
      'createdAt',
    );
  });

  describe('write', () => {
    beforeEach(() => {
      manager.findOneOrFail.mockResolvedValue({ name: 'Quản trị viên' });
      queryBuilder.getRawMany.mockResolvedValue([]);
    });

    it('creates a genre with a slug from its name and logs it', async () => {
      manager.save.mockImplementation((genre: object) => ({
        ...genre,
        id: 'genre-1',
        createdAt,
      }));

      await expect(
        service.create(ACTOR, { name: 'Kỹ năng sống', note: '' }),
      ).resolves.toEqual({
        id: 'genre-1',
        name: 'Kỹ năng sống',
        slug: 'ky-nang-song',
        createdAt,
      });
      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.GENRE_CREATION,
          targetId: 'genre-1',
          targetName: 'Kỹ năng sống',
        }),
      );
    });

    it('numbers the slug when it is already taken', async () => {
      queryBuilder.getRawMany.mockResolvedValue([
        { slug: 'kinh-te' },
        { slug: 'kinh-te-2' },
      ]);
      manager.save.mockImplementation((genre: object) => ({
        ...genre,
        id: 'genre-2',
        createdAt,
      }));

      await expect(
        service.create(ACTOR, { name: 'Kinh tế', note: '' }),
      ).resolves.toMatchObject({ slug: 'kinh-te-3' });
      expect(queryBuilder.where).toHaveBeenCalledWith('genre.slug ~ :pattern', {
        pattern: '^kinh-te(-[0-9]+)?$',
      });
    });

    it('turns a duplicate name or slug into 409', async () => {
      manager.save.mockRejectedValue(uniqueViolation());

      await expect(
        service.create(ACTOR, { name: 'kinh te', note: '' }),
      ).rejects.toMatchObject({ code: 3008 });
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('renames, regenerates the slug ignoring its own, and logs the new name', async () => {
      manager.findOne.mockResolvedValue({
        id: 'genre-1',
        name: 'Kinh tế',
        slug: 'kinh-te',
      });
      manager.save.mockImplementation((genre: object) => ({
        ...genre,
        updatedAt: createdAt,
      }));

      await expect(
        service.update(ACTOR, 'genre-1', {
          name: 'Kinh doanh',
          note: 'Đổi tên',
        }),
      ).resolves.toEqual({
        id: 'genre-1',
        name: 'Kinh doanh',
        slug: 'kinh-doanh',
        updatedAt: createdAt,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'genre.id <> :exceptId',
        { exceptId: 'genre-1' },
      );
      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.GENRE_UPDATE,
          targetName: 'Kinh doanh',
          note: 'Đổi tên',
        }),
      );
    });

    it('does nothing when the name is unchanged', async () => {
      manager.findOne.mockResolvedValue({
        id: 'genre-1',
        name: 'Kinh tế',
        slug: 'kinh-te',
        updatedAt: createdAt,
      });

      await service.update(ACTOR, 'genre-1', { name: 'Kinh tế', note: '' });

      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('returns 404 when renaming or deleting an unknown genre', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.update(ACTOR, 'genre-x', { name: 'A', note: '' }),
      ).rejects.toMatchObject({ code: 1003 });
      await expect(service.remove(ACTOR, 'genre-x', '')).rejects.toMatchObject({
        code: 1003,
      });
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('deletes the genre and logs its name', async () => {
      manager.findOne.mockResolvedValue({ id: 'genre-1', name: 'Kinh tế' });

      await expect(service.remove(ACTOR, 'genre-1', 'Trùng')).resolves.toEqual(
        {},
      );
      expect(manager.delete).toHaveBeenCalledWith(Genre, { id: 'genre-1' });
      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.GENRE_DELETION,
          targetId: 'genre-1',
          targetName: 'Kinh tế',
          note: 'Trùng',
        }),
      );
    });
  });
});
