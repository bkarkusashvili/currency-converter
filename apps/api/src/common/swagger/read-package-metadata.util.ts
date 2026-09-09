import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const packageMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
});

export type PackageMetadata = z.infer<typeof packageMetadataSchema>;

// Read at runtime instead of imported: pulling package.json into the program
// would widen the compiler's rootDir and move the entrypoint to dist/src/main.js.
// Both src/ and dist/ sit one level under the package root, so the relative
// path holds for ts-node, Jest and the compiled build alike.
export function readPackageMetadata(): PackageMetadata {
  const packageJsonPath = join(__dirname, '..', '..', '..', 'package.json');
  const contents: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  return packageMetadataSchema.parse(contents);
}
