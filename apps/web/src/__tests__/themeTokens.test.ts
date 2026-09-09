import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { THEME_COLORS } from '../theme';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');

/** Comments carry semicolons of their own, and this reads declarations by them. */
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose selector matches, as a map. */
function declarations(selector: string): Record<string, string> {
  const start = withoutComments.indexOf(`${selector} {`);
  expect(start, `no rule for ${selector}`).toBeGreaterThan(-1);

  const open = withoutComments.indexOf('{', start);
  let depth = 0;
  let end = open;

  while (end < withoutComments.length) {
    if (withoutComments[end] === '{') {
      depth += 1;
    } else if (withoutComments[end] === '}') {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
    end += 1;
  }

  const entries = withoutComments
    .slice(open + 1, end)
    .split(';')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--') || line.startsWith('color-scheme'))
    .map((line) => line.split(/:\s*/) as [string, string]);

  return Object.fromEntries(entries);
}

/**
 * The design's colour sheet, reprinted from board `1n`. §2.1 says nothing
 * changes, and this is what says so: a token quietly re-tuned during a
 * redesign fails here rather than in a contrast audit later.
 */
const LIGHT = {
  '--surface': '#f3f5f3',
  '--surface-raised': '#ffffff',
  '--surface-sunken': '#e8ece9',
  '--ink': '#14191b',
  '--ink-muted': '#576265',
  '--ink-faint': '#5f6b6e',
  '--line': '#dbe1dd',
  '--line-strong': '#86938d',
  '--accent': '#0a7264',
  '--accent-hover': '#096659',
  '--accent-contrast': '#ffffff',
  '--accent-soft': '#dcefea',
  '--warn': '#855200',
  '--warn-soft': '#f8ebd4',
  '--danger': '#a12c2c',
  '--danger-soft': '#f9e5e5',
};

const DARK = {
  '--surface': '#0d1113',
  '--surface-raised': '#151a1c',
  '--surface-sunken': '#0a0e0f',
  '--ink': '#e8edeb',
  '--ink-muted': '#9aa5a4',
  '--ink-faint': '#8b9897',
  '--line': '#242b2d',
  '--line-strong': '#5a6b64',
  '--accent': '#2ecfb2',
  '--accent-hover': '#52e0c6',
  '--accent-contrast': '#06211c',
  '--accent-soft': '#123029',
  '--warn': '#eab551',
  '--warn-soft': '#33280f',
  '--danger': '#f08a8a',
  '--danger-soft': '#3a1d1d',
};

const SYSTEM_DARK = ":root:not([data-theme='light'])";
const PICKED_DARK = ":root[data-theme='dark']";

describe('the token sheet', () => {
  it('still declares the palette the design reprints, colour for colour', () => {
    expect(declarations(':root')).toMatchObject(LIGHT);
    expect(declarations(SYSTEM_DARK)).toMatchObject(DARK);
  });

  it('keeps the two dark blocks identical, which is the price of writing them twice', () => {
    expect(declarations(PICKED_DARK)).toEqual(declarations(SYSTEM_DARK));
  });

  it('adds the two elevation tokens the design uses and index.css did not have', () => {
    expect(declarations(':root')['--shadow']).toBe('0 16px 40px rgba(20, 25, 27, 0.14)');
    expect(declarations(':root')['--shadow-sm']).toBe('0 2px 8px rgba(20, 25, 27, 0.08)');
    expect(declarations(PICKED_DARK)['--shadow']).toBe('0 16px 40px rgba(0, 0, 0, 0.6)');
    expect(declarations(PICKED_DARK)['--shadow-sm']).toBe('0 2px 8px rgba(0, 0, 0, 0.4)');
  });

  it('switches color-scheme with the palette, so form controls follow it', () => {
    expect(declarations(':root')['color-scheme']).toBe('light');
    expect(declarations(SYSTEM_DARK)['color-scheme']).toBe('dark');
    expect(declarations(PICKED_DARK)['color-scheme']).toBe('dark');
  });

  it('gives the browser chrome the same two surfaces the page uses', () => {
    expect(THEME_COLORS.light).toBe(LIGHT['--surface']);
    expect(THEME_COLORS.dark).toBe(DARK['--surface']);
  });
});

describe('the shell', () => {
  it('is the design’s 1120px, with 24px of inline padding above the breakpoint', () => {
    expect(css).toMatch(/\.shell \{[^}]*max-width: 70rem;/);
    expect(css).toMatch(/\.shell \{[^}]*padding-inline: 1rem;/);
    expect(css).toMatch(/@media \(min-width: 40rem\) \{[\s\S]*padding-inline: 1\.5rem;/);
  });
});
