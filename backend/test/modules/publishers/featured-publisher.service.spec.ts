import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { FeaturedPublisherService } from '../../../src/modules/publishers/featured-publisher.service';

describe('FeaturedPublisherService', () => {
  const query = jest.fn();
  const find = jest.fn();
  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const service = new FeaturedPublisherService(
    { query, manager: { find } } as unknown as DataSource,
    redis as unknown as Redis,
  );

  // Kim Đồng 5, Trẻ 3, Nhã Nam 2, Alpha 1 → cộng dồn 5, 8, 10, 11
  const WEIGHTS = [
    { id: 'kim-dong', weight: 5 },
    { id: 'tre', weight: 3 },
    { id: 'nha-nam', weight: 2 },
    { id: 'alpha', weight: 1 },
  ];
  const publisherOf = (id: string) => ({
    id,
    name: id,
    slug: id,
    logoPublicId: null,
  });

  // Thứ tự query: danh sách (id, weight) → chi tiết NXB trúng; sách lấy qua manager.find
  const mockDraw = (winner: string) =>
    query
      .mockResolvedValueOnce(WEIGHTS)
      .mockResolvedValueOnce([publisherOf(winner)]);

  beforeEach(() => {
    jest.resetAllMocks();
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    find.mockResolvedValue([]);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [0, 'kim-dong'], // vé 0
    [6.1 / 11, 'tre'], // vé 6,1: 5 chưa vượt, 8 vượt
    [9.4 / 11, 'nha-nam'],
    [10.6 / 11, 'alpha'],
  ])('random %f picks %s by cumulative weight', async (random, winner) => {
    redis.get.mockResolvedValue(null);
    jest.spyOn(Math, 'random').mockReturnValue(random);
    mockDraw(winner);

    await expect(service.get()).resolves.toMatchObject({
      publisher: { id: winner },
    });
    expect(query.mock.calls[1][1]).toEqual(['active', winner]);
    expect(redis.set).toHaveBeenCalledWith(
      'home:featured-publisher',
      winner,
      'EX',
      3600,
    );
  });

  it('uses the cached publisher while it is still eligible', async () => {
    redis.get.mockResolvedValue('tre');
    query.mockResolvedValueOnce([publisherOf('tre')]);

    await expect(service.get()).resolves.toMatchObject({
      publisher: { id: 'tre' },
    });
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('draws again when the cached publisher is no longer eligible', async () => {
    redis.get.mockResolvedValue('gone');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    query.mockResolvedValueOnce([]); // NXB đang lưu không còn đủ điều kiện
    mockDraw('kim-dong');

    await expect(service.get()).resolves.toMatchObject({
      publisher: { id: 'kim-dong' },
    });
    expect(redis.del).toHaveBeenCalledWith('home:featured-publisher');
  });

  it('keeps only authors from contributors', async () => {
    redis.get.mockResolvedValue('tre');
    query.mockResolvedValueOnce([publisherOf('tre')]);
    find.mockResolvedValue([
      {
        id: 'b1',
        slug: 'b1',
        title: 'B1',
        coverPublicId: null,
        contributors: [
          { name: 'Tác giả A', role: 'author' },
          { name: 'Dịch giả B', role: 'translator' },
          { name: 'Tác giả C', role: 'author' },
        ],
        ratingAvg: 4.5,
        ratingCount: 2,
      },
    ]);

    await expect(service.get()).resolves.toEqual({
      publisher: publisherOf('tre'),
      books: [
        {
          id: 'b1',
          slug: 'b1',
          title: 'B1',
          coverPublicId: null,
          authors: ['Tác giả A', 'Tác giả C'],
          ratingAvg: 4.5,
          ratingCount: 2,
        },
      ],
    });
  });

  it('returns {} when no publisher is eligible', async () => {
    redis.get.mockResolvedValue(null);
    query.mockResolvedValueOnce([]);

    await expect(service.get()).resolves.toEqual({});
    expect(redis.set).not.toHaveBeenCalled();
  });
});
