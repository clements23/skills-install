# skills-install: One Command to Install AI Agent Skills for Claude Code, Codex, Cursor and Gemini

[![npm](https://img.shields.io/npm/v/skills-install?color=blue&label=skills-install)](https://www.npmjs.com/package/skills-install)
[![node](https://img.shields.io/node/v/skills-install)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

`skills-install` is a zero-dependency CLI that installs [AI agent skills](https://github.com/clements23/agent-guardrail-skill) into any supported coding agent. It auto-detects which agent you use, pulls a skill from GitHub or your local filesystem, and drops it in the right skills directory.

```bash
npx skills-install owner/repo
```

That is it. No config files, no manual path guessing, no per-agent install docs.

## Why skills-install

Every AI agent (Claude Code, Codex, Cursor, Gemini CLI) now supports skills, but every one of them stores them in a different place:

| Agent | Default skills directory |
| --- | --- |
| Claude Code | `~/.claude/skills/` |
| OpenAI Codex | `~/.codex/skills/` |
| Cursor | `~/.cursor/skills/` |
| Gemini CLI | `~/.gemini/skills/` |

Skill authors publish one repo and users are left figuring out four different install commands. `skills-install` solves that with a single command that works for all of them.

## Install

Requires Node.js 18 or newer.

```bash
npm install -g skills-install
```

Or run it ad hoc with `npx skills-install` (no install needed).

## Usage

```bash
# Install from a GitHub repository (shorthand or full URL)
skills-install clements23/agent-guardrail-skill
skills-install https://github.com/owner/repo

# Install from a local directory or a single SKILL.md file
skills-install ./my-skills
skills-install ./my-skills/seo-audit/SKILL.md

# Pick your agent explicitly
skills-install owner/repo --agent claude

# Install into the current project instead of your home directory
skills-install owner/repo --project

# Install into every agent you have installed
skills-install owner/repo --all-agents

# Preview without copying anything
skills-install owner/repo --dry-run
```

## How auto-detection works

`skills-install` checks your home directory for `~/.claude`, `~/.codex`, `~/.cursor` and `~/.gemini`. Whichever agents it finds become the install targets. If you have more than one, the skill is installed into all of them unless you pass `--agent`.

## What gets installed

The source is scanned for skill packages in this order:

1. A `SKILL.md` at the repository root (installed as one skill).
2. A `skills/` folder containing subfolders with `SKILL.md` files (each subfolder is one skill).
3. Any top-level subfolder containing a `SKILL.md`.

The skill name is read from the `name:` field in the YAML frontmatter of `SKILL.md`, falling back to the folder name.

## Related projects

- [agent-guardrail-skill](https://github.com/clements23/agent-guardrail-skill): a drop-in safety skill that stops agents from running destructive commands.
- [skill-doctor](https://github.com/clements23/skill-doctor): lints and audits `SKILL.md` files before you publish them.
- [claude-skills-leaderboard](https://github.com/clements23/claude-skills-leaderboard): live ranking of the most starred Claude skill repositories on GitHub.
- [marketing-agency-skills](https://github.com/clements23/marketing-agency-skills): production-ready skills for SEO audits, client reports and ad analysis.

## FAQ

**Does it work offline?**
Yes, for local paths and folders. GitHub sources need a network connection and `git` on your PATH.

**Does it overwrite existing skills?**
No. Existing skills are skipped unless you pass `--force`.

**Can I publish my own skills?**
Yes. Add a `SKILL.md` with `name` and `description` frontmatter to a GitHub repo, then anyone can install it with `skills-install yourname/yourrepo`.

## License

MIT. See [LICENSE](LICENSE).
