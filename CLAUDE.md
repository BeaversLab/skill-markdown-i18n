# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **skill package** for AI coding assistants (Cursor, Claude Code, Codex, Gemini) that provides markdown internationalization (i18n) capabilities. The skill translates and synchronizes markdown documentation across languages while preserving technical content like code blocks, commands, and URLs.

**Key insight:** This is NOT an application - it's a skill package that gets installed to various CLI tools' skill directories. The main deliverables are the skill definition (`SKILL.md`) and utility scripts.

## Common Commands

### Installation & Testing

```bash
# Install dependencies
pnpm install

# Test the skill functionality (basic validation)
pnpm test

# Run interactive installer (what users will run)
node install.js

# Or via npx (after publishing)
npx skill-markdown-i18n
```

### Utility Scripts (Located in `scripts/`)

These scripts are used by the skill workflow and by end users:

```bash
# Create initial translation plan (for new translations)
node scripts/create-plan.js <source_dir> <target_dir> [-o <output_file>]
# Example: node scripts/create-plan.js docs/en docs/zh

# Create Git-based sync plan (compare file versions using git diff)
node scripts/git-diff-sync.js <source_file> <target_file> [-r <git_ref>] [-o <output_file>]
# Example: node scripts/git-diff-sync.js docs/en/guide.md docs/zh/guide.md
# Example: node scripts/git-diff-sync.js docs/en/guide.md docs/zh/guide.md -r HEAD~1

# Create directory sync plan (detect changes between existing translations)
node scripts/sync-plan.js <source_dir> <target_dir> [-o <output_file>]
# Example: node scripts/sync-plan.js docs/en docs/zh

# Update translation plan status
node scripts/update-plan.js <plan_file> <source_file> <status> [--notes <text>]
# Example: node scripts/update-plan.js .i18n/translation-plan.yaml docs/en/guide.md done

# Validate translation quality
node scripts/validate.js <source.md> <target.md>
node scripts/validate.js --dir <source_dir> <target_dir>  # Validate all files

# Find changed sections between versions
node scripts/diff-sections.js <old_version.md> <new_version.md>
```

### Git Diff Sync Feature

The `git-diff-sync.js` script uses Git to compare file versions:

**Key features:**
- Uses `git diff` for precise line-level change detection
- Identifies affected markdown sections
- Generates targeted sync plan for only changed content
- Supports any Git reference (HEAD, HEAD~1, branches, commits)

**When to use:**
- Source file was updated in Git and you need to sync changes to translation
- Want to avoid re-translating the entire file
- Need precise change detection based on version control

**How it works:**
1. Runs `git diff <git_ref> -- <source_file>` to get changes
2. Parses diff hunks to identify changed line ranges
3. Maps changes to markdown sections (headings)
4. Creates sync plan with affected sections list

### Directory Sync Plan Feature

The `sync-plan.js` script compares two directories and detects:

1. **New files** (+) - Only in source (needs translation)
2. **Modified files** (*) - In both but content differs (needs sync)
3. **Deleted files** (-) - Only in target (review for deletion)
4. **Unchanged files** (=) - In both, same content (no action)

Uses MD5 hash for accurate content comparison (more reliable than timestamps).

### Package Management

```bash
# The project uses pnpm (not npm)
pnpm install          # Install dependencies
pnpm add <package>    # Add new dependency
```

## Project Structure

```
skill-markdown-i18n/
├── install.js           # Interactive installer (entry point for npx)
├── SKILL.md             # Main skill definition (used by AI assistants)
├── glossary.md          # Translation terminology conventions
├── README.md            # User-facing documentation
├── CLAUDE.md            # This file
├── package.json         # Project metadata and dependencies
└── scripts/             # Utility scripts for translation workflow
    ├── create-plan.js   # Generate YAML translation plans
    ├── update-plan.js   # Update plan file status
    ├── validate.js      # Validate translation quality
    └── diff-sections.js # Identify changed sections
```

## Architecture

### Skill Definition System

The core is `SKILL.md` which contains:
- **Frontmatter**: Metadata (name, description) for skill discovery
- **Instructions**: Detailed workflow for AI assistants to follow
- **Three workflow types**:
  1. **New document translation** (single or batch)
  2. **Sync updated documents** (incremental changes only)
  3. **Batch translation with resume** (requires YAML plan)

### Translation Plan System (Critical for Batch Operations)

Batch translations **require** a YAML plan file that:
- Lives in the `.i18n` directory at project root
- Tracks all files to translate with status (pending/in_progress/done/skipped)
- Enables resumption after interruption
- Stores progress with timestamps

**Output location rules:**
- **Project skill**: `<project_root>/.i18n/translation-plan.yaml`
- **Global skill**: `<current_working_directory>/.i18n/translation-plan.yaml` (default, can override with `--output`)

The `create-plan.js` script auto-detects installation type and creates the `.i18n` directory if needed.

### Installation Architecture

`install.js` is an interactive installer that:
1. Prompts for installation scope (global/project)
2. Lets users select target CLIs (Cursor/Claude/Codex/Gemini)
3. Copies skill files to appropriate directories
4. Handles Codex-specific config.toml requirements
5. Runs `npm install` in skill directory for dependencies

The skill can be installed:
- **Globally**: `~/.cli/skills/markdown-i18n/` (available to all projects)
- **Locally**: `<project>/.cli/skills/markdown-i18n/` (project-specific)

Key: Translation plan files are ALWAYS stored in the project folder, even when the skill is installed globally.

### Translation Rules (Preserved vs Translated)

**Always preserve (DO NOT translate):**
- Code blocks (entire content)
- Inline code with technical commands/paths
- URLs (domain and path)
- Variables/placeholders (`{{var}}`, `$ENV_VAR`)
- Command-line flags (`--verbose`)

**Translate with care:**
- Frontmatter values (keys stay in English)
- Internal links (add locale prefix: `/install` → `/zh/install`)
- Section headings (preserve anchor functionality)

### Glossary System

`glossary.md` defines:
- **Keep in English**: Technical terms (API, CLI, OAuth, Gateway, webhook, etc.)
- **Translate consistently**: Common terms (Install→安装, Configuration→配置, etc.)
- **Context-dependent**: Terms that change based on usage context

Supports EN↔ZH primarily, extensible to JA (Japanese), KO (Korean).

## Code Conventions

### Node.js ES Modules

All scripts use ES modules (`import`/`export`), not CommonJS:
```javascript
import fs from 'fs/promises';
import path from 'path';
```

Package.json has `"type": "module"`.

### Script Patterns

Utility scripts follow this pattern:
1. Shebang: `#!/usr/bin/env node`
2. Import dependencies
3. Helper functions
4. Argument parsing
5. Main async function
6. Error handling with `process.exit(1)`

### YAML Handling

Uses `js-yaml` library for plan file operations:
- `yaml.dump()` - Write plan with proper formatting (indent: 2, lineWidth: -1)
- `yaml.load()` - Read and parse plan files

## Working with Translation Plans

When modifying plan-related code (`create-plan.js`, `update-plan.js`):
- Plan structure: `{ meta, summary, files[], log[] }`
- Status values: `pending`, `in_progress`, `done`, `skipped`
- Always update both `files[].status` and `summary` when changing status
- Log entries should be ISO 8601 timestamps

## Multi-CLI Compatibility

This skill targets four different AI coding assistants:
1. **Cursor**: Uses `@skill-name` invocation, stores skills in `~/.cursor/skills/`
2. **Claude Code**: Auto-discovers from `.claude/skills/`
3. **Codex**: Requires `config.toml` with `[features] skills = true`
4. **Gemini**: Manual reference in `.gemini/` or `GEMINI.md`

When making changes, ensure compatibility across all four environments.

## Package Publishing

The `package.json` `bin` field makes `install.js` executable via npx:
```json
"bin": {
  "skill-markdown-i18n": "./install.js"
}
```

This enables: `npx skill-markdown-i18n`

## Important Constraints

1. **Never translate code blocks** - This is the most critical rule
2. **Translation plans live in `.i18n/` directory** - Auto-created at project root or cwd
3. **Codex needs config.toml** - Without `[features] skills = true`, skills won't load
4. **Scripts use pnpm** - Not npm, for dependency management
5. **ES modules only** - No CommonJS require/module.exports
