import { describe, expect, it } from 'vitest';
import { i18nInstance } from '..';

describe('i18n', () => {
  it('labels the document with the language it renders in', () => {
    expect(i18nInstance.resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('keeps the attribute in step when the language changes', async () => {
    await i18nInstance.changeLanguage('de');

    expect(document.documentElement.lang).toBe(i18nInstance.resolvedLanguage);

    await i18nInstance.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
