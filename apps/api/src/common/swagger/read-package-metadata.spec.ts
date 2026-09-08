import { readPackageMetadata } from './read-package-metadata';

describe('readPackageMetadata', () => {
  const metadata = readPackageMetadata();

  it('reads the real package.json from any working directory', () => {
    expect(metadata.name).toBe('currency-converter-api');
  });

  it('exposes a semver-looking version and a description', () => {
    expect(metadata.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(metadata.description.length).toBeGreaterThan(0);
  });
});
