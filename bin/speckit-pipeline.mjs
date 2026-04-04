#!/usr/bin/env node

import { install } from '../lib/installer.mjs';
import { findProjectRoot } from '../lib/utils.mjs';

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (!command || command === 'help' || args.includes('--help')) {
  console.log(`
speckit-pipeline — Build/design pipeline for spec-kit projects

Usage:
  npx speckit-pipeline init [--dry-run] [--force]

Commands:
  init       Install the pipeline into the current project

Options:
  --dry-run  Show what would be installed without writing files
  --force    Overwrite existing files (default: skip if exists)
  --help     Show this help message
`);
  process.exit(0);
}

if (command !== 'init') {
  console.error(`Unknown command: ${command}`);
  console.error('Run "npx speckit-pipeline --help" for usage.');
  process.exit(1);
}

const projectRoot = findProjectRoot(process.cwd());
if (!projectRoot) {
  console.error('ERROR: Could not find .specify/ directory.');
  console.error('Is spec-kit installed? Run spec-kit init first, then retry.');
  process.exit(1);
}

await install(projectRoot, { dryRun, force });
