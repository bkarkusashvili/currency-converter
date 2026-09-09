// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Every feature module under src/modules and every package under src/common
// publishes an index.ts, and that index is the only way in from outside it.
// The names below are those directories; the two patterns per name are
// "one level inside it" and "any level below that", which together are
// everything except the directory itself.
const PACKAGES = [
  // src/modules/*
  'conversion',
  'currencies',
  'health',
  'history',
  'rates',
  // src/common/* ('conversion' is above and covers common/conversion too)
  'currency',
  'errors',
  'filters',
  'guards',
  'http',
  'logging',
  'money',
  'resilience',
  'swagger',
  'throttling',
  'utils',
  'validation',
  'warnings',
];

const BOUNDARY_MESSAGE =
  "Cross-boundary imports go through the package's index.ts " +
  "(e.g. '../rates', not '../rates/domain/exchange-rate.types'). " +
  'Inside a package, import the file directly.';

const boundaryPatterns = PACKAGES.flatMap((name) => [
  `**/${name}/*`,
  `**/${name}/*/**`,
]);

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // The module-boundary rule (§9). A feature module's internals and a
    // common/* package's internals are private to it: everything else reaches
    // them through the index.ts that names the public surface, so what one
    // module may use of another is a list in one file rather than whatever a
    // relative path happens to reach.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: boundaryPatterns, message: BOUNDARY_MESSAGE }] },
      ],
    },
  },
  {
    // Nothing under common/ knows a feature module exists, index or not (§9).
    files: ['src/common/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: boundaryPatterns, message: BOUNDARY_MESSAGE },
            {
              group: ['**/modules/**'],
              message:
                'common/ is shared vocabulary: it must not import from a feature module.',
            },
          ],
        },
      ],
    },
  },
  {
    // Non-null assertions are a legitimate shorthand once a test has already
    // asserted the value is present; they stay banned in application code.
    // The boundary rule is off here for the same reason: a fake or a fixture
    // one suite reaches for is not part of a module's published surface.
    files: ['**/*.spec.ts', '**/__tests__/**', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
