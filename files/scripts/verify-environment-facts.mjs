#!/usr/bin/env node
// Pre-handoff sanity check on pipeline/environment-facts.md.
//
// Run by:
//   - The developer subagent before it hands off to the evaluator.
//   - The build orchestrator after the developer returns and before
//     it invokes the evaluator (defense in depth).
//
// Catches a class of real bugs we've hit:
//   1. Orphan `next dev` processes left behind by an earlier cycle's
//      developer.
//   2. Wrong DB path recorded in environment-facts.md when two `.db`
//      files exist (Prisma resolves `file:./X` relative to the schema
//      file, NOT the project root).
//
// Exit 0 = all checks pass. Exit 1 = at least one failure (block handoff).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';

const cwd = process.cwd();
const ROOT = cwd;

let failures = 0;

function pass(msg) {
  process.stdout.write(`  ✓ ${msg}\n`);
}

function fail(msg, detail) {
  failures++;
  process.stdout.write(`  ✗ ${msg}\n`);
  if (detail) {
    for (const line of String(detail).split('\n')) {
      process.stdout.write(`      ${line}\n`);
    }
  }
}

function info(msg) {
  process.stdout.write(`  · ${msg}\n`);
}

// -----------------------------------------------------------------------
// Check 1 — No orphan dev servers
// -----------------------------------------------------------------------

function checkNoOrphanDevServers() {
  // Default pattern: next dev. Could be extended to read environment-facts
  // for the project's stop command, but starting simple.
  const patterns = ['next dev'];

  const orphans = [];
  for (const pattern of patterns) {
    try {
      const out = execSync(`pgrep -f ${JSON.stringify(pattern)} || true`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (out) {
        // Filter out our own process and the pgrep itself by checking the
        // command line; pgrep -f matches itself sometimes.
        const pids = out.split('\n').filter((p) => p && Number(p) !== process.pid);
        for (const pid of pids) {
          orphans.push({ pid: pid.trim(), pattern });
        }
      }
    } catch {
      // pgrep returned non-zero (no match) — fine.
    }
  }

  if (orphans.length === 0) {
    pass('No orphan dev servers running');
    return;
  }

  const detail = orphans
    .map((o) => `PID ${o.pid} (matched: ${o.pattern})`)
    .join('\n');
  fail(
    'Orphan dev server(s) detected — must be stopped before handoff',
    `${detail}\nStop with: pkill -f "next dev"`
  );
}

// -----------------------------------------------------------------------
// Check 2 — DB path consistency (Prisma sqlite case)
// -----------------------------------------------------------------------

function readEnvVar(envFilePath, varName) {
  if (!existsSync(envFilePath)) return null;
  const content = readFileSync(envFilePath, 'utf8');
  // Match: VARNAME=value or VARNAME="value" or VARNAME='value'
  const re = new RegExp(`^\\s*${varName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s#]*))`, 'm');
  const m = content.match(re);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

function getPrismaSqliteDbPath() {
  const schemaPath = join(ROOT, 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath)) return null;
  const schema = readFileSync(schemaPath, 'utf8');

  // Look for the datasource block
  const dsMatch = schema.match(/datasource\s+\w+\s*\{([\s\S]*?)\}/);
  if (!dsMatch) return null;
  const dsBody = dsMatch[1];

  const providerMatch = dsBody.match(/provider\s*=\s*"([^"]+)"/);
  const urlMatch = dsBody.match(/url\s*=\s*env\("([^"]+)"\)/);
  if (!providerMatch || !urlMatch) return null;
  if (providerMatch[1] !== 'sqlite') return null;
  const envVarName = urlMatch[1];

  // Try .env.local first, then .env
  const candidates = [join(ROOT, '.env.local'), join(ROOT, '.env')];
  let urlValue = null;
  let envFile = null;
  for (const candidate of candidates) {
    const v = readEnvVar(candidate, envVarName);
    if (v) {
      urlValue = v;
      envFile = candidate;
      break;
    }
  }
  if (!urlValue) return null;
  if (!urlValue.startsWith('file:')) {
    // Remote URL (Turso etc.) — skip.
    return { remote: true, urlValue, envFile };
  }

  // Prisma resolves `file:./X` relative to the schema directory.
  // file:/abs/path is absolute; file:./relative is relative to schema dir.
  const filePart = urlValue.slice('file:'.length);
  let resolvedPath;
  if (filePart.startsWith('/')) {
    resolvedPath = filePart;
  } else {
    resolvedPath = resolve(dirname(schemaPath), filePart);
  }
  return {
    remote: false,
    urlValue,
    envFile,
    schemaDir: dirname(schemaPath),
    resolvedPath,
  };
}

function findDbFiles() {
  const found = [];
  const seen = new Set();
  const dirs = [ROOT, join(ROOT, 'prisma')];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.db')) continue;
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (!st.isFile()) continue;
      } catch {
        continue;
      }
      if (seen.has(full)) continue;
      seen.add(full);
      found.push(full);
    }
  }
  return found;
}

function checkDbPathConsistency() {
  const prisma = getPrismaSqliteDbPath();
  if (!prisma) {
    info('No Prisma sqlite datasource detected — skipping DB path check');
    return;
  }
  if (prisma.remote) {
    info(`Remote DATABASE_URL (${prisma.urlValue.slice(0, 20)}…) — skipping path check`);
    return;
  }

  const dbFiles = findDbFiles();
  if (dbFiles.length === 0) {
    info('Prisma resolves to a sqlite path but no .db files exist yet — first migration will create it');
    return;
  }

  // The resolvedPath is what the running app uses.
  const liveDb = prisma.resolvedPath;

  // Verify the resolved file actually exists (or could exist).
  const liveDbExists = existsSync(liveDb);
  if (!liveDbExists) {
    info(
      `Prisma resolves DATABASE_URL=${prisma.urlValue} to ${rel(liveDb)} ` +
        `but that file doesn't exist yet — migrations will create it`
    );
  }

  // If only one .db file exists, no ambiguity.
  if (dbFiles.length === 1) {
    if (resolve(dbFiles[0]) === resolve(liveDb)) {
      pass(`Single .db file matches Prisma's resolution: ${rel(liveDb)}`);
    } else {
      fail(
        `The only .db file (${rel(dbFiles[0])}) is not what Prisma uses (${rel(liveDb)})`,
        `DATABASE_URL=${prisma.urlValue} in ${rel(prisma.envFile)}\n` +
          `Prisma resolves relative to the schema dir: ${rel(prisma.schemaDir)}/`
      );
    }
    return;
  }

  // Multiple .db files — env-facts.md must disambiguate.
  const envFactsPath = join(ROOT, 'pipeline', 'environment-facts.md');
  if (!existsSync(envFactsPath)) {
    fail(
      `Multiple .db files exist (${dbFiles.map(rel).join(', ')}) but pipeline/environment-facts.md doesn't exist yet to record which is live`,
      `Prisma resolves to: ${rel(liveDb)}\n` +
        `Record this in pipeline/environment-facts.md before handoff.`
    );
    return;
  }

  const envFacts = readFileSync(envFactsPath, 'utf8');
  const lines = envFacts.split('\n');

  const livePattern = /(live|actual|real|the\s+app\s+uses|prisma\s+uses|running\s+app)/i;
  const liveRel = rel(liveDb);

  // For each line that asserts a "live" db, take the FIRST .db path
  // mentioned on that line as the asserted-live path. This avoids
  // false positives from explanatory parentheticals like
  // "(Prisma resolves file:./dev.db relative to schema dir)".
  const claims = [];
  for (const line of lines) {
    if (!livePattern.test(line)) continue;
    const first = firstDbPathOnLine(line, dbFiles);
    if (first) claims.push({ line: line.trim(), path: first });
  }

  if (claims.length === 0) {
    fail(
      `Multiple .db files exist but pipeline/environment-facts.md doesn't identify which one is live`,
      `Prisma's resolved path: ${liveRel}\n` +
        `Found .db files: ${dbFiles.map(rel).join(', ')}\n` +
        `Add a line like: "The live app database is ${liveRel}".`
    );
    return;
  }

  for (const claim of claims) {
    if (resolve(claim.path) !== resolve(liveDb)) {
      fail(
        `pipeline/environment-facts.md contradicts Prisma's resolution`,
        `Claimed live: ${rel(claim.path)}\n` +
          `Prisma resolves to: ${liveRel}\n` +
          `DATABASE_URL=${prisma.urlValue} from ${rel(prisma.envFile)}\n` +
          `Resolved relative to: ${rel(prisma.schemaDir)}/\n` +
          `Offending line: ${claim.line}`
      );
      return;
    }
  }

  pass(
    `Multiple .db files disambiguated correctly — live: ${liveRel}`
  );
}

/**
 * Find the earliest .db file mention on a line. Returns the absolute path
 * from `candidates`, or null. Distinguishes `prisma/dev.db` from `./dev.db`
 * even though they share the same basename.
 */
function firstDbPathOnLine(line, candidates) {
  let bestIdx = Infinity;
  let bestPath = null;
  for (const candidate of candidates) {
    const r = rel(candidate);
    let idx;
    if (r.includes('/')) {
      idx = line.indexOf(r);
    } else {
      const escaped = r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|[^/\\w])(?:\\.\\/)?${escaped}\\b`);
      const m = re.exec(line);
      idx = m ? m.index : -1;
    }
    if (idx >= 0 && idx < bestIdx) {
      bestIdx = idx;
      bestPath = candidate;
    }
  }
  return bestPath;
}

function rel(absPath) {
  if (absPath.startsWith(ROOT + '/')) return absPath.slice(ROOT.length + 1);
  if (absPath === ROOT) return '.';
  return absPath;
}

// -----------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------

process.stdout.write('verify-environment-facts:\n');
checkNoOrphanDevServers();
checkDbPathConsistency();

if (failures > 0) {
  process.stdout.write(`\n${failures} check(s) failed — fix before handoff.\n`);
  process.exit(1);
}
process.stdout.write('\nAll checks passed.\n');
process.exit(0);
