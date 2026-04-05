import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { log } from './utils.mjs';

const TRACKED_FILES = [
  '.claude/agents/developer.md',
  '.claude/agents/evaluator.md',
  '.claude/agents/designer.md',
  '.claude/agents/design-critique.md',
  '.claude/skills/build/SKILL.md',
  '.claude/skills/design/SKILL.md',
  '.specify/memory/constitution.md',
];

/**
 * Generate manifest.json with SHA-256 checksums of installed files.
 */
export function generateManifest(projectRoot, { dryRun }) {
  const manifestPath = join(projectRoot, '.specify', 'extensions', 'pipeline', 'manifest.json');

  if (dryRun) {
    log.dry('.specify/extensions/pipeline/manifest.json');
    return;
  }

  const files = {};
  for (const file of TRACKED_FILES) {
    const fullPath = join(projectRoot, file);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath);
      const hash = createHash('sha256').update(content).digest('hex');
      files[file] = hash;
    }
  }

  const manifest = {
    extension: 'pipeline',
    version: '1.0.0',
    installed_at: new Date().toISOString(),
    files,
  };

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  log.success('manifest.json (generated with checksums)');
}
