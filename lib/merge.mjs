import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { log } from './utils.mjs';

/**
 * Merge launch.json configurations.
 * If target doesn't exist, copy wholesale.
 * If target exists, add missing configurations by name.
 */
export function mergeLaunchJson(projectRoot, srcPath, { dryRun, force }) {
  const dest = join(projectRoot, '.claude', 'launch.json');

  if (dryRun) {
    log.dry('.claude/launch.json');
    return;
  }

  mkdirSync(dirname(dest), { recursive: true });

  if (!existsSync(dest)) {
    writeFileSync(dest, readFileSync(srcPath, 'utf8'));
    log.success('.claude/launch.json (created)');
    return;
  }

  let target;
  try {
    target = JSON.parse(readFileSync(dest, 'utf8'));
  } catch {
    log.error('.claude/launch.json exists but contains invalid JSON — skipping merge');
    return;
  }

  let source;
  try {
    source = JSON.parse(readFileSync(srcPath, 'utf8'));
  } catch {
    log.error('Package launch.json is invalid — this is a bug');
    return;
  }

  if (!target.configurations) target.configurations = [];
  const existingNames = new Set(target.configurations.map(c => c.name));

  let added = 0;
  for (const config of source.configurations || []) {
    if (!existingNames.has(config.name)) {
      target.configurations.push(config);
      added++;
    } else if (force) {
      const idx = target.configurations.findIndex(c => c.name === config.name);
      target.configurations[idx] = config;
      added++;
    }
  }

  if (added > 0) {
    writeFileSync(dest, JSON.stringify(target, null, 2) + '\n');
    log.success(`.claude/launch.json (${added} configuration(s) added)`);
  } else {
    log.skip('.claude/launch.json (all configurations already present)');
  }
}

/**
 * Merge settings.json permissions.
 * If target doesn't exist, create with defaults.
 * If target exists, add missing permission entries.
 */
export function mergeSettingsJson(projectRoot, { dryRun, force }) {
  const dest = join(projectRoot, '.claude', 'settings.json');

  const requiredPermissions = [
    'Bash(*)',
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Agent',
  ];

  if (dryRun) {
    log.dry('.claude/settings.json');
    return;
  }

  mkdirSync(dirname(dest), { recursive: true });

  if (!existsSync(dest)) {
    const settings = { permissions: { allow: requiredPermissions } };
    writeFileSync(dest, JSON.stringify(settings, null, 2) + '\n');
    log.success('.claude/settings.json (created)');
    return;
  }

  let settings;
  try {
    settings = JSON.parse(readFileSync(dest, 'utf8'));
  } catch {
    log.error('.claude/settings.json exists but contains invalid JSON — skipping merge');
    return;
  }

  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.allow) settings.permissions.allow = [];

  const existing = new Set(settings.permissions.allow);
  let added = 0;

  for (const perm of requiredPermissions) {
    if (!existing.has(perm)) {
      settings.permissions.allow.push(perm);
      added++;
    }
  }

  if (added > 0) {
    writeFileSync(dest, JSON.stringify(settings, null, 2) + '\n');
    log.success(`.claude/settings.json (${added} permission(s) added)`);
  } else {
    log.skip('.claude/settings.json (all permissions already present)');
  }
}

/**
 * Append pipeline section to CLAUDE.md.
 * If file doesn't exist, create from template.
 * If exists, append only if section not already present.
 */
export function mergeClaudeMd(projectRoot, templatePath, { dryRun }) {
  const dest = join(projectRoot, 'CLAUDE.md');
  const template = readFileSync(templatePath, 'utf8');

  if (dryRun) {
    log.dry('CLAUDE.md');
    return;
  }

  if (!existsSync(dest)) {
    writeFileSync(dest, template);
    log.success('CLAUDE.md (created)');
    return;
  }

  const content = readFileSync(dest, 'utf8');
  if (content.includes('## Build Pipeline')) {
    log.skip('CLAUDE.md (Build Pipeline section already present)');
    return;
  }

  writeFileSync(dest, content.trimEnd() + '\n\n' + template);
  log.success('CLAUDE.md (appended Build Pipeline section)');
}
