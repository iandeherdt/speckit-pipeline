#!/usr/bin/env node

import { install } from '../lib/installer.mjs';
import { update } from '../lib/update.mjs';
import { findProjectRoot } from '../lib/utils.mjs';

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const updateMode = args.includes('--update');

if (!command || command === 'help' || args.includes('--help')) {
  console.log(`
speckit-pipeline — Build/design pipeline for spec-kit projects

Usage:
  npx speckit-pipeline init [--dry-run] [--force | --update]

Commands:
  init       Install or update the pipeline in the current project

Options:
  --dry-run  Show what would be installed without writing files
  --force    Overwrite existing files (incl. constitution); first-install or
             reset workflow
  --update   Update pipeline files to the current package version, but only
             if the local copy is unmodified since the last install. Skips
             user-customized files and never touches the constitution,
             pipeline/procedures.md, environment-facts.md, or run-state.md.
  --help     Show this help message

Examples:
  npx speckit-pipeline init                  # first-time install (skip-if-exists)
  npx speckit-pipeline init --force          # reinstall everything from scratch
  npx speckit-pipeline init --update         # safe in-place upgrade
  npx speckit-pipeline init --update --dry-run   # preview the upgrade plan
`);
  process.exit(0);
}

if (command !== 'init') {
  console.error(`Unknown command: ${command}`);
  console.error('Run "npx speckit-pipeline --help" for usage.');
  process.exit(1);
}

if (updateMode && force) {
  console.error('--update and --force are mutually exclusive.');
  console.error('Use --force to overwrite everything, or --update to upgrade');
  console.error('only files that have not been locally modified.');
  process.exit(1);
}

const projectRoot = findProjectRoot(process.cwd());
if (!projectRoot) {
  console.error('ERROR: Could not find .specify/ directory.');
  console.error('Is spec-kit installed? Run spec-kit init first, then retry.');
  process.exit(1);
}

if (updateMode) {
  await update(projectRoot, { dryRun });
} else {
  await install(projectRoot, { dryRun, force });
}
