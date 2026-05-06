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
          `and append a new \`## <name>\` section before completing your task.\n` +
          `\n` +
          `---\n` +
          `\n` +
          `## Overlays blocking forms\n` +
          `\n` +
          `**When to use**: any time you're about to interact with a form\n` +
          `(login, signup, booking, search, etc.) on a page you haven't\n` +
          `verified is overlay-free.\n` +
          `\n` +
          `**Symptom if you skip this**: you fill credentials, click submit,\n` +
          `and either (a) nothing happens, (b) the page rerenders and your\n` +
          `field values clear, or (c) you land back on the same form. Cookie\n` +
          `consent banners, GDPR notices, age gates, push-notification prompts,\n` +
          `and modal popups all do this.\n` +
          `\n` +
          `**Steps**:\n` +
          `1. Take \`mcp__playwright__browser_snapshot\` BEFORE any form\n` +
          `   interaction. Look at the *whole* element tree, not just the form.\n` +
          `2. Scan the snapshot for buttons whose text matches (case-insensitive):\n` +
          `   \`accept\`, \`reject\`, \`allow\`, \`deny\`, \`got it\`, \`ok\`,\n` +
          `   \`i agree\`, \`continue\`, \`dismiss\`, \`close\`, \`cookie\`,\n` +
          `   \`privacy\`. Buttons near the top/bottom of the page or in a\n` +
          `   floating container are usually overlay controls.\n` +
          `3. Click the most permissive accept button. (For consent banners:\n` +
          `   "Accept All" > "Accept" > "Got it" > "OK". Avoid "Manage\n` +
          `   preferences" or "Reject All" — they may load a settings dialog.)\n` +
          `4. Take a fresh snapshot. The overlay should be gone.\n` +
          `5. NOW fill and submit the form.\n` +
          `\n` +
          `**Per-project**: once you've discovered the actual button text and\n` +
          `selector for this site, append a site-specific procedure (e.g.\n` +
          `\`## Cookie consent dismissal\`) with the exact element references\n` +
          `so future cycles skip the snapshot-and-scan step.\n`
      );
      log.success('pipeline/procedures.md (seeded with overlay meta-procedure)');
    } else {
      // Existing procedures.md is NEVER overwritten — discovered procedures
      // (login flows, etc.) survive upgrades. If the file predates the
      // overlay meta-procedure (1.4.1+), append it so the agent's grep
      // returns something useful. We append rather than rewrite so the
      // user's content stays exactly where they put it.
      const existing = readFileSync(proceduresPath, 'utf8');
      if (!existing.includes('## Overlays blocking forms')) {
        const appendix =
          `\n` +
          `---\n` +
          `\n` +
          `## Overlays blocking forms\n` +
          `\n` +
          `**When to use**: any time you're about to interact with a form\n` +
          `(login, signup, booking, search, etc.) on a page you haven't\n` +
          `verified is overlay-free.\n` +
          `\n` +
          `**Symptom if you skip this**: you fill credentials, click submit,\n` +
          `and either (a) nothing happens, (b) the page rerenders and your\n` +
          `field values clear, or (c) you land back on the same form. Cookie\n` +
          `consent banners, GDPR notices, age gates, push-notification prompts,\n` +
          `and modal popups all do this.\n` +
          `\n` +
          `**Steps**:\n` +
          `1. Take \`mcp__playwright__browser_snapshot\` BEFORE any form\n` +
          `   interaction. Look at the *whole* element tree, not just the form.\n` +
          `2. Scan the snapshot for buttons whose text matches (case-insensitive):\n` +
          `   \`accept\`, \`reject\`, \`allow\`, \`deny\`, \`got it\`, \`ok\`,\n` +
          `   \`i agree\`, \`continue\`, \`dismiss\`, \`close\`, \`cookie\`,\n` +
          `   \`privacy\`. Buttons near the top/bottom of the page or in a\n` +
          `   floating container are usually overlay controls.\n` +
          `3. Click the most permissive accept button. (For consent banners:\n` +
          `   "Accept All" > "Accept" > "Got it" > "OK". Avoid "Manage\n` +
          `   preferences" or "Reject All" — they may load a settings dialog.)\n` +
          `4. Take a fresh snapshot. The overlay should be gone.\n` +
          `5. NOW fill and submit the form.\n` +
          `\n` +
          `**Per-project**: once you've discovered the actual button text and\n` +
          `selector for this site, append a site-specific procedure (e.g.\n` +
          `\`## Cookie consent dismissal\`) with the exact element references\n` +
          `so future cycles skip the snapshot-and-scan step.\n`;
        writeFileSync(proceduresPath, existing.trimEnd() + appendix);
        log.success(
          'pipeline/procedures.md (preserved existing content; appended overlay meta-procedure)'
        );
      } else {
        log.skip('pipeline/procedures.md (already exists with overlay meta-procedure)');
      }
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
