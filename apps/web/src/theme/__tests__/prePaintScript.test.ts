import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE, THEME_PREFERENCES, THEME_STORAGE_KEY } from '../themePreference';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '../../../index.html'), 'utf8');
const securityHeaders = readFileSync(join(here, '../../../nginx/security-headers.conf'), 'utf8');

/**
 * The one duplicated thing in this feature: the script that runs before the
 * bundle cannot import from it. These assertions are what keeps the copy in
 * `index.html` reading the same key and writing the same attribute.
 */
describe('the pre-paint theme script', () => {
  it('reads the key the module writes', () => {
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });

  it('writes the attribute the stylesheet is keyed on, for the two explicit choices', () => {
    expect(html).toContain(`document.documentElement.setAttribute('${THEME_ATTRIBUTE}', theme)`);

    for (const preference of THEME_PREFERENCES.filter((value) => value !== 'system')) {
      expect(html).toContain(`theme === '${preference}'`);
    }

    // `system` is the absence of the attribute, so the script must not set it.
    expect(html).not.toContain("theme === 'system'");
  });

  it('runs before the bundle, which is the whole point of it', () => {
    expect(html.indexOf('localStorage.getItem')).toBeLessThan(html.indexOf('src/main.tsx'));
  });

  it('survives a browser that will not hand over storage at all', () => {
    expect(html).toMatch(/try \{[\s\S]*localStorage[\s\S]*\} catch/);
  });

  it("is the script the container's CSP allows, by the hash of exactly this text", () => {
    // `script-src` has no `unsafe-inline`, so this script runs only because its
    // own sha256 is named in nginx/security-headers.conf. Vite copies the tag
    // through untouched, so the served bytes are these bytes: edit the script
    // without re-hashing it and the theme stops being applied before the paint.
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];

    expect(script).toBeDefined();
    expect(securityHeaders).toContain(
      `'sha256-${createHash('sha256')
        .update(script ?? '')
        .digest('base64')}'`,
    );
  });
});
