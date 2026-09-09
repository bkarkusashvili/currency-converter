// Every sentence in `en.json` has to be reachable from the app. A key nothing
// renders is a sentence nobody reviewed and nobody translated for a reason —
// `rateHistory.day` shipped in the first draft of the rate-history panel and
// was never used — and the type-checker cannot see it, because `t()` takes the
// whole key space as its argument type.
//
// The check is deliberately blunt: a key counts as used when its full path
// appears anywhere in `src`, which covers `t('a.b')`, the typed key maps in
// `errorMessageKey.ts` and `provenance.ts`, and `i18nKey` props alike. Keys
// assembled at run time never appear whole, so those are listed in
// `i18n-allowlist.txt` beside this file, each with the reason it is there.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../src');

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

// An array is a leaf: the About page asks for `about.status.items` whole, with
// `returnObjects`, and its indices are never named.
const leaves = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? leaves(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const code = walk(src)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const allowed = new Set(
  readFileSync(join(here, 'i18n-allowlist.txt'), 'utf8')
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean),
);

const messages = JSON.parse(readFileSync(join(src, 'i18n/en.json'), 'utf8'));
const unused = leaves(messages).filter((key) => !allowed.has(key) && !code.includes(key));
const stale = [...allowed].filter((key) => code.includes(key));

if (unused.length > 0 || stale.length > 0) {
  for (const key of unused) {
    process.stderr.write(`unused message key: ${key}\n`);
  }
  for (const key of stale) {
    process.stderr.write(`allowlisted key is now referenced, drop it: ${key}\n`);
  }
  process.exit(1);
}

process.stdout.write(`check-i18n: ${String(leaves(messages).length)} keys, all referenced\n`);
