import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Folder boundaries. `api/`, `components/`, `lib/`, `i18n/` and each folder
// under `features/` publish an index.ts, and that index is the only way in
// from outside. Inside one, files import each other directly.
//
// The specifiers here are relative, so what identifies a cross-folder import
// is the number of `../` it takes to climb back to `src/`: at that depth
// `components` is the shared folder, and one level shallower it is the
// feature's own. Hence a config per depth rather than one pattern.
const SHARED_FOLDERS = ['api', 'components', 'i18n', 'lib', 'theme'];
const FEATURES = ['about', 'converter'];

const BOUNDARY_MESSAGE =
  "Cross-folder imports go through the folder's index.ts " +
  "(e.g. '../../api', not '../../api/http/request'). " +
  'Inside a folder, import the file directly.';

/**
 * @param {number} depth how many `../` reach `src/` from the linted file
 * @returns {string[]} the specifiers that would reach inside another folder
 */
function crossFolderPatterns(depth) {
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const patterns = SHARED_FOLDERS.flatMap((name) => [`${up}${name}/*`, `${up}${name}/*/**`]);

  // A feature's index is `features/<name>`, so only what is below it is out
  // of bounds — including from a sibling feature, one level shallower.
  patterns.push(`${up}features/*/*`, `${up}features/*/*/**`);
  if (depth > 0) {
    const sibling = '../'.repeat(depth - 1);
    patterns.push(...FEATURES.flatMap((name) => [`${sibling}${name}/*`, `${sibling}${name}/*/**`]));
  }

  return patterns;
}

// The deepest file in `src/` today sits four folders down, but a rule that
// stops one level below where the tree happens to end fails open rather than
// loudly: a file added at depth 5 could reach `api/http/request` and lint
// would pass. The list runs past any depth this app has a reason to grow to,
// and a config for a depth nothing occupies costs nothing to carry.
const boundaryConfigs = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((depth) => ({
  files: [`src/${'*/'.repeat(depth)}*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: [{ group: crossFolderPatterns(depth), message: BOUNDARY_MESSAGE }] },
    ],
  },
}));

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  ...boundaryConfigs,
  {
    // The boundary rule is off in the suites for the same reason it is off in
    // the API's: a fake or a render helper one suite reaches for is not part
    // of a folder's published surface.
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
