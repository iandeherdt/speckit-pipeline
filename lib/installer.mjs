import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { installFile, log, PACKAGE_FILES_DIR } from './utils.mjs';
import { mergeLaunchJson, mergeSettingsJson, mergeClaudeMd } from './merge.mjs';
import { generateManifest } from './manifest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const AGENTS = [
  'developer.md',
  'evaluator.md',
  'designer.md',
  'design-critique.md',
];

const SKILLS = [
  { src: 'skills/build/SKILL.md', dest: '.claude/skills/build/SKILL.md' },
  { src: 'skills/design/SKILL.md', dest: '.claude/skills/design/SKILL.md' },
];

const SCRIPTS = [
  { src: 'scripts/trace-hook.mjs', dest: '.claude/scripts/trace-hook.mjs' },
  { src: 'scripts/trace-summarise.mjs', dest: '.claude/scripts/trace-summarise.mjs' },
  { src: 'scripts/verify-environment-facts.mjs', dest: '.claude/scripts/verify-environment-facts.mjs' },
];

export async function install(projectRoot, { dryRun, force }) {
  console.log('');
  const banner = `speckit-pipeline v${pkg.version}`;
  console.log(banner);
  console.log('='.repeat(banner.length));
  console.log('');
  console.log(`Project: ${projectRoot}`);
  console.log('');

  // 1. Install agents
  console.log('Installing agents...');
  for (const agent of AGENTS) {
    installFile(
      join(PACKAGE_FILES_DIR, 'agents', agent),
      join('.claude', 'agents', agent),
      projectRoot,
      { dryRun, force }
    );
  }
  console.log('');

  // 2. Install skills
  console.log('Installing skills...');
  for (const skill of SKILLS) {
    installFile(
      join(PACKAGE_FILES_DIR, skill.src),
      skill.dest,
      projectRoot,
      { dryRun, force }
    );
  }
  console.log('');

  // 2b. Install pipeline trace scripts
  console.log('Installing trace scripts...');
  for (const script of SCRIPTS) {
    installFile(
      join(PACKAGE_FILES_DIR, script.src),
      script.dest,
      projectRoot,
      { dryRun, force }
    );
  }
  console.log('');

  // 3. Configure project
  console.log('Configuring project...');
  mergeLaunchJson(
    projectRoot,
    join(PACKAGE_FILES_DIR, 'launch.json'),
    { dryRun, force }
  );
  mergeSettingsJson(projectRoot, { dryRun, force });
  mergeClaudeMd(
    projectRoot,
    join(PACKAGE_FILES_DIR, 'templates', 'claude-md-section.md'),
    { dryRun }
  );

  // 4. Install constitution
  console.log('Installing constitution...');
  const constitutionDest = join(projectRoot, '.specify', 'memory', 'constitution.md');
  const isBlankTemplate = existsSync(constitutionDest) &&
    readFileSync(constitutionDest, 'utf8').includes('[PROJECT_NAME] Constitution');
  installFile(
    join(PACKAGE_FILES_DIR, 'templates', 'constitution.md'),
    join('.specify', 'memory', 'constitution.md'),
    projectRoot,
    { dryRun, force: force || isBlankTemplate }
  );
  if (isBlankTemplate && !force) {
    log.info('Replaced blank spec-kit template with pipeline constitution');
  }
  console.log('');

  // 5. Add Playwright MCP server (used by evaluator and design-critique for browser testing)
  console.log('Configuring MCP servers...');
  if (dryRun) {
    log.dry('claude mcp add playwright (project scope)');
  } else {
    try {
      const result = execSync('claude mcp list 2>&1', { cwd: projectRoot, encoding: 'utf8' });
      if (result.includes('playwright')) {
        log.skip('Playwright MCP already configured');
      } else {
        execSync(
          'claude mcp add --scope project playwright -- npx @playwright/mcp@latest --isolated',
          { cwd: projectRoot, stdio: 'pipe' }
        );
        log.success('Added Playwright MCP server (project scope)');
      }
    } catch (err) {
      log.warn('Could not add Playwright MCP — add it manually:');
      log.warn('  claude mcp add playwright -- npx @playwright/mcp@latest --isolated');
    }
  }
  console.log('');

  // Create output directories and seed an empty procedures cache
  if (dryRun) {
    log.dry('pipeline/feedback/ (output directory)');
    log.dry('pipeline/traces/ (output directory)');
    log.dry('pipeline/procedures.md (empty cache)');
  } else {
    mkdirSync(join(projectRoot, 'pipeline', 'feedback'), { recursive: true });
    log.success('pipeline/feedback/ (output directory)');
    mkdirSync(join(projectRoot, 'pipeline', 'traces'), { recursive: true });
    log.success('pipeline/traces/ (output directory)');
    const proceduresPath = join(projectRoot, 'pipeline', 'procedures.md');
    if (!existsSync(proceduresPath)) {
      writeFileSync(
        proceduresPath,
        `# Procedures\n\n` +
          `Multi-step UI flows (login, logout, etc.) discovered by the\n` +
          `evaluator and design-critique subagents. Each procedure has a\n` +
          `\`## <name>\` heading; subagents grep by name before executing\n` +
          `a flow that might already be documented:\n\n` +
          `\`\`\`bash\n` +
          `grep -A 30 '^## Login' pipeline/procedures.md\n` +
          `\`\`\`\n\n` +
          `If the procedure exists, follow it. If not, discover the flow\n` +
          `and append a new \`## <name>\` section before completing your task.\n`
      );
      log.success('pipeline/procedures.md (empty cache)');
    } else {
      log.skip('pipeline/procedures.md (already exists)');
    }
  }
  console.log('');

  // 4. Generate manifest
  console.log('Generating manifest...');
  generateManifest(projectRoot, { dryRun });
  console.log('');

  if (dryRun) {
    console.log('Dry run complete. No files were modified.');
  } else {
    console.log('Installation complete.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run spec-kit planning:  /speckit-constitution \u2192 /speckit-specify \u2192 /speckit-plan \u2192 /speckit-tasks');
    console.log('  2. Run the design loop:    /design');
    console.log('  3. Run the build loop:     /build');
  }
}
