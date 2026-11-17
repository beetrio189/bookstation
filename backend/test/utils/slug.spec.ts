import { nextFreeSlug, slugify } from '../../src/utils/slug';

describe('slugify', () => {
  it.each([
    ['Nhà xuất bản Kim Đồng', 'nha-xuat-ban-kim-dong'],
    ['  NXB Trẻ!!  ', 'nxb-tre'],
    ['Alpha & Omega (2026)', 'alpha-omega-2026'],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name, 'fallback')).toBe(slug);
  });

  it('uses the fallback when nothing is left', () => {
    expect(slugify('!!! ???', 'nha-xuat-ban')).toBe('nha-xuat-ban');
  });

  it('caps the length without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(199)} b`, 'x');

    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('nextFreeSlug', () => {
  it('keeps the base when it is free', () => {
    expect(nextFreeSlug('kim-dong', [])).toBe('kim-dong');
  });

  it('adds the first free number', () => {
    expect(nextFreeSlug('kim-dong', ['kim-dong', 'kim-dong-2'])).toBe(
      'kim-dong-3',
    );
    expect(nextFreeSlug('kim-dong', ['kim-dong', 'kim-dong-3'])).toBe(
      'kim-dong-2',
    );
  });
});
