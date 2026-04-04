import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the package's files/ directory
const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_FILES_DIR = resolve(__dirname, '..', 'files');

// Logging helpers
export const log = {
  info:    (msg) => console.log(`  INFO: ${msg}`),
  success: (msg) => console.log(`  \u2713 ${msg}`),
  skip:    (msg) => console.log(`  \u2192 ${msg}`),
  dry:     (msg) => console.log(`  [dry-run] Would install: ${msg}`),
  error:   (msg) => console.error(`  ERROR: ${msg}`),
};

/**
 * Walk up from startDir looking for .specify/integration.json
 */
export function findProjectRoot(startDir) {
  let dir = resolve(startDir);
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, '.specify', 'integration.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

/**
 * Copy a file from src to destRelative (relative to projectRoot).
 * Respects dryRun and force flags.
 * Returns 'installed' | 'skipped' | 'dry-run'
 */
export function installFile(src, destRelative, projectRoot, { dryRun, force }) {
  const dest = join(projectRoot, destRelative);

  if (dryRun) {
    log.dry(destRelative);
    return 'dry-run';
  }

  if (existsSync(dest) && !force) {
    log.skip(`${destRelative} (already exists, use --force to overwrite)`);
    return 'skipped';
  }

  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  log.success(destRelative);
  return 'installed';
}
