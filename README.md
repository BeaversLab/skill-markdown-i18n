# Markdown i18n Skill

Translate and synchronize markdown documentation across languages.

## Features

- **New document translation**: Translate from source to target language
- **Sync updates**: Update translations when source changes
- **Preserve technical content**: Code blocks, commands, URLs stay unchanged
- **Quality validation**: Automated structure and content checks
- **Translation plan**: YAML-based progress tracking with resume support

## Quick Install (Interactive)

```bash
# From npm (recommended)
npx skill-markdown-i18n

# Or clone and run locally
git clone https://github.com/BeaversLab/skill-markdown-i18n.git
cd skill-markdown-i18n
node install.js
```

The interactive installer will:
1. Ask whether to install globally or to current project
2. Let you select which CLIs to install for (Cursor, Claude Code, Codex, Gemini)
3. Automatically install dependencies and configure Codex if needed

## Manual Installation

### Cursor

```bash
# Personal (all projects)
cp -r markdown-i18n ~/.cursor/skills/

# Project-specific
cp -r markdown-i18n .cursor/skills/

# Install script dependencies
cd ~/.cursor/skills/markdown-i18n/scripts && npm install
```

### Claude Code

```bash
# Personal
cp -r markdown-i18n ~/.claude/skills/

# Project-specific
cp -r markdown-i18n .claude/skills/

# Install script dependencies
cd ~/.claude/skills/markdown-i18n/scripts && npm install
```

### Codex

```bash
# Global installation
cp -r markdown-i18n ~/.codex/skills/
cd ~/.codex/skills/markdown-i18n/scripts && npm install

# Project installation
cp -r markdown-i18n <project>/.codex/skills/
cd <project>/.codex/skills/markdown-i18n/scripts && npm install

# IMPORTANT: Enable skills in project config
# Create/edit <project>/.codex/config.toml:
```

```toml
[features]
skills = true
```

### Gemini

Copy `SKILL.md` content to your `.gemini/` config or reference in `GEMINI.md`.

## Usage Examples

### Translate New File

```
Translate docs/en/guide.md to Chinese, save to docs/zh/guide.md
```

### Sync After Source Update

```
The source file docs/en/guide.md was updated. 
Sync the Chinese translation at docs/zh/guide.md
```

### Batch Translate

```
Translate all markdown files in docs/en/ to docs/zh/
```

### Create Translation Plan (Required for Batch)

```bash
# Create plan before batch translation
# Output location:
#   - Project skill: <project_root>/.i18n/translation-plan.yaml
#   - Global skill:  <cwd>/.i18n/translation-plan.yaml
node scripts/create-plan.js docs/en docs/zh

# Or specify custom output location
node scripts/create-plan.js docs/en docs/zh --output custom/path/plan.yaml
```

### Update Plan Status

```bash
# Mark file as done
node scripts/update-plan.js .i18n/translation-plan.yaml docs/en/guide.md done

# Mark as in progress with notes
node scripts/update-plan.js .i18n/translation-plan.yaml docs/en/faq.md in_progress --notes "50%"
```

### Validate Translation

```bash
node scripts/validate.js docs/en/guide.md docs/zh/guide.md

# Validate entire directory
node scripts/validate.js --dir docs/en docs/zh
```

### Find Changed Sections

```bash
node scripts/diff-sections.js old-version.md new-version.md
```

## File Structure

```
markdown-i18n/
├── SKILL.md          # Main skill instructions
├── glossary.md       # Technical term translations
├── README.md         # This file
└── scripts/
    ├── package.json      # Dependencies (js-yaml)
    ├── create-plan.js    # Generate translation plan (YAML)
    ├── update-plan.js    # Update plan status
    ├── validate.js       # Validate translation quality
    └── diff-sections.js  # Identify changed sections
```

## Translation Plan (YAML)

For batch translations, a plan file is REQUIRED. The plan:
- Uses YAML format for easy parsing and editing
- Lists all files to translate with status
- Allows resuming after interruption
- Tracks progress with timestamps in log section

Plan location:
- **Project skill**: `<project_root>/.i18n/translation-plan.yaml`
- **Global skill**: `<current_working_directory>/.i18n/translation-plan.yaml` (can override with `--output`)

The `.i18n` directory is auto-created if it doesn't exist.

### Plan Format Example

```yaml
meta:
  created: '2025-01-31T10:30:00Z'
  source_dir: en/
  target_dir: zh/
  status: in_progress

summary:
  total: 15
  completed: 3
  remaining: 12

files:
  - source: en/guide.md
    target: zh/guide.md
    status: done
    notes: ''

log:
  - time: '2025-01-31T10:35:00Z'
    file: en/guide.md
    action: done
```

## Supported Languages

Primary: English (en) ↔ Chinese (zh)

Extensible to: Japanese (ja), Korean (ko), and others via glossary.md
