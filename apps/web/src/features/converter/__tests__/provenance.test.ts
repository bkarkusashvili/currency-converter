import { describe, expect, it } from 'vitest';
import { conversionPath, sourceCopy, strategyCopy } from '../lib/provenance';

describe('strategyCopy', () => {
  it('translates the strategies the contract defines', () => {
    expect(strategyCopy('cross').valueKey).toBe('converter.strategy.cross.value');
    expect(strategyCopy('identity').valueKey).toBe('converter.strategy.identity.value');
    expect(strategyCopy('direct').valueKey).toBe('converter.strategy.direct.value');
  });

  it('falls back to neutral copy for a strategy it does not know', () => {
    expect(strategyCopy('triangular')).toEqual({
      valueKey: null,
      noteKey: 'converter.strategy.unknown.note',
      tone: 'neutral',
    });
  });
});

describe('sourceCopy', () => {
  it('gives stale cache a warning tone', () => {
    expect(sourceCopy('stale-cache').tone).toBe('warn');
    expect(sourceCopy('provider').tone).toBe('accent');
    expect(sourceCopy('cache').tone).toBe('neutral');
  });

  it('falls back to neutral copy for a source it does not know', () => {
    expect(sourceCopy('mirror')).toEqual({
      valueKey: null,
      noteKey: 'converter.source.unknown.note',
      tone: 'neutral',
    });
  });
});

describe('conversionPath', () => {
  it('draws the hop a cross rate takes', () => {
    expect(conversionPath('EUR', 'PLN', 'cross')).toEqual(['EUR', 'UAH', 'PLN']);
  });

  it('draws a single node for identity and two for anything else', () => {
    expect(conversionPath('USD', 'USD', 'identity')).toEqual(['USD']);
    expect(conversionPath('USD', 'UAH', 'direct')).toEqual(['USD', 'UAH']);
    expect(conversionPath('USD', 'UAH', 'triangular')).toEqual(['USD', 'UAH']);
  });
});
