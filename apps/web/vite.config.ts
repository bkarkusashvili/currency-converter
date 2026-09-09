import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The floor every metric has to clear, on all four. It is deliberately below
// what the suite actually reaches — see the README's table for that — because
// this is the line a change may not cross, not a record of where the suite
// stands: pinning it to the current number turns every honest refactor that
// deletes a covered branch into a red build.
const COVERAGE_THRESHOLD = 90;

// The persisted query cache is busted by this, so the version the package
// declares is what a release changes to discard caches written against an
// older API contract.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // strictPort: 5173 is one of the origins the API allows, so a silent fall
  // back to 5174 would turn a port clash into an opaque CORS failure.
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/test/**', 'src/main.tsx'],
      thresholds: {
        statements: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        lines: COVERAGE_THRESHOLD,
      },
    },
  },
});
