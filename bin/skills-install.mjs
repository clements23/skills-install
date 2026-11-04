#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const AGENTS = {
  claude: { label: 'Claude Code', home: () => join(homedir(), '.claude'), project: '.claude' },
  codex: { label: 'OpenAI Codex', home: () => join(homedir(), '.codex'), project: '.codex' },
  cursor: { label: 'Cursor', home: () => join(homedir(), '.cursor'), project: '.cursor' },
  gemini: { label: 'Gemini CLI', home: () => join(homedir(), '.gemini'), project: '.gemini' }
};

function usage() {
  console.log(`
skills-install <source> [options]

Install AI agent skills (SKILL.md packages) into Claude Code, Codex, Cursor or Gemini.

Sources:
  path/to/skill-dir      local directory containing SKILL.md
  path/to/SKILL.md       a single skill file
  owner/repo             GitHub repository shorthand
  https://github.com/o/r GitHub repository URL

Options:
  --agent <name>   target agent: claude, codex, cursor, gemini (default: auto-detect)
  --project        install into the current project instead of your home directory
  --all-agents     install into every detected agent
  --force          overwrite a skill that is already installed
  --dry-run        show what would be installed without copying
  -h, --help       show this help

Examples:
  npx skills-install clements23/agent-guardrail-skill
  npx skills-install ./my-skills --agent claude
  npx skills-install https://github.com/owner/repo --all-agents
`);
}

function parseArgs(argv) {
  const opts = { source: null, agent: null, project: false, allAgents: false, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') { usage(); process.exit(0); }
    else if (arg === '--agent') opts.agent = argv[++i];
    else if (arg === '--project') opts.project = true;
    else if (arg === '--all-agents') opts.allAgents = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--agent=')) opts.agent = arg.split('=')[1];
    else if (arg.startsWith('-')) { console.error(`Unknown option: ${arg}`); process.exit(1); }
    else if (!opts.source) opts.source = arg;
    else { console.error(`Unexpected argument: ${arg}`); process.exit(1); }
  }
  return opts;
}

function detectedAgents() {
  return Object.entries(AGENTS)
    .filter(([, cfg]) => existsSync(cfg.home()))
    .map(([name]) => name);
}

function resolveTargets(opts) {
  let names;
  if (opts.allAgents) names = detectedAgents();
  else if (opts.agent) {
    if (!AGENTS[opts.agent]) {
      console.error(`Unknown agent "${opts.agent}". Valid agents: ${Object.keys(AGENTS).join(', ')}`);
      process.exit(1);
    }
    names = [opts.agent];
  } else {
    names = detectedAgents();
    if (names.length === 0) {
      console.error('No supported agent found. Detected .claude, .codex, .cursor or .gemini in your home directory is required, or pass --agent explicitly.');
      process.exit(1);
    }
  }
  if (names.length === 0) {
    console.error('No supported agent detected. Pass --agent claude|codex|cursor|gemini explicitly.');
    process.exit(1);
  }
  return names.map((name) => {
    const cfg = AGENTS[name];
    const base = opts.project ? resolve(cfg.project) : cfg.home();
    return { name, label: cfg.label, skillsDir: join(base, 'skills') };
  });
}

function isGitHubSource(source) {
  return /^https?:\/\/(www\.)?github\.com\//.test(source) || /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source);
}

function githubCloneUrl(source) {
  const match = source.match(/github\.com\/([^/]+\/[^/#?]+)/);
  if (match) return `https://github.com/${match[1].replace(/\.git$/, '')}.git`;
  return `https://github.com/${source}.git`;
}

function fetchSource(source) {
  if (!isGitHubSource(source)) {
    const local = isAbsolute(source) ? source : resolve(process.cwd(), source);
    if (!existsSync(local)) {
      console.error(`Source not found: ${local}`);
      process.exit(1);
    }
    return { root: statSync(local).isDirectory() ? local : dirname(local), cleanup: null };
  }
  const tmp = mkdtempSync(join(tmpdir(), 'skills-install-'));
  const url = githubCloneUrl(source);
  const result = spawnSync('git', ['clone', '--depth', '1', '--quiet', url, join(tmp, 'repo')], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    console.error(`Failed to clone ${url}`);
    if (result.stderr) console.error(result.stderr.toString().trim());
    process.exit(1);
  }
  return { root: join(tmp, 'repo'), cleanup: tmp };
}

function findSkillDirs(root) {
  if (existsSync(join(root, 'SKILL.md'))) return [root];
  const nested = join(root, 'skills');
  if (existsSync(nested) && statSync(nested).isDirectory()) {
    const found = readdirSync(nested, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(nested, entry.name, 'SKILL.md')))
      .map((entry) => join(nested, entry.name));
    if (found.length > 0) return found;
  }
  const found = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'SKILL.md')))
    .map((entry) => join(root, entry.name));
  return found;
}

function skillName(dir) {
  const file = join(dir, 'SKILL.md');
  try {
    const content = readFileSync(file, 'utf8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
      const nameMatch = match[1].match(/^name:\s*["']?([^"'\r\n]+)/m);
      if (nameMatch) return nameMatch[1].trim();
    }
  } catch {}
  return basename(dir);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.source) { usage(); process.exit(1); }

  const targets = resolveTargets(opts);
  const { root, cleanup } = fetchSource(opts.source);
  const skills = findSkillDirs(root);

  if (skills.length === 0) {
    console.error('No SKILL.md found in the source. Expected a directory with SKILL.md, or a skills/ folder of skill packages.');
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
    process.exit(1);
  }

  console.log(`Installing ${skills.length} skill(s) for: ${targets.map((t) => t.label).join(', ')}\n`);

  let installed = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    mkdirSync(target.skillsDir, { recursive: true });
    for (const skillDir of skills) {
      const name = skillName(skillDir);
      const dest = join(target.skillsDir, name);
      if (existsSync(dest) && !opts.force) {
        console.log(`  skip    ${name} -> ${dest} (already installed, use --force to overwrite)`);
        skipped++;
        continue;
      }
      if (opts.dryRun) {
        console.log(`  would   ${name} -> ${dest}`);
        installed++;
        continue;
      }
      try {
        cpSync(skillDir, dest, { recursive: true });
        console.log(`  install ${name} -> ${dest}`);
        installed++;
      } catch (err) {
        console.error(`  fail    ${name}: ${err.message}`);
        failed++;
      }
    }
  }

  if (cleanup) rmSync(cleanup, { recursive: true, force: true });

  console.log(`\nDone. ${installed} installed, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();
