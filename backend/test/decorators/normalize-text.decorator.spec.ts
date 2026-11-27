import { plainToInstance } from 'class-transformer';
import {
  NormalizeText,
  normalizeText,
} from '../../src/decorators/normalize-text.decorator';

describe('normalizeText', () => {
  it('turns decomposed (NFD) letters into composed (NFC) ones', () => {
    const nfd = 'Kỹ năng';

    expect(normalizeText(nfd)).toBe('Kỹ năng');
    expect(normalizeText(nfd)).toHaveLength(7);
  });

  it('drops zero-width and format characters without splitting the word', () => {
    expect(normalizeText('Kinh​tế﻿')).toBe('Kinhtế');
    expect(normalizeText('‮Văn học')).toBe('Văn học');
  });

  it('turns control characters into spaces, collapses spaces and trims', () => {
    expect(normalizeText('  Kinh\ttế\n  học\u0000 ')).toBe('Kinh tế học');
  });

  it('runs as a class-transformer decorator and leaves non-strings alone', () => {
    class Dto {
      @NormalizeText()
      name: unknown;
    }

    expect(plainToInstance(Dto, { name: ' Kỹ ' }).name).toBe('Kỹ');
    expect(plainToInstance(Dto, { name: 42 }).name).toBe(42);
  });
});
