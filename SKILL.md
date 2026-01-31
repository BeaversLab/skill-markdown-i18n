---
name: markdown-i18n
description: Translate and sync markdown documentation between languages (EN↔ZH). Handles new document translation and incremental sync when source updates. Preserves code blocks, frontmatter structure, links, and variables. Use when translating docs, localizing markdown, syncing i18n files, or when the user mentions translation, localization, or multilingual documentation.
---

# Markdown i18n

Translate markdown documentation between languages while preserving structure and technical content.

## Installation

### Quick Install (Interactive)

```bash
npx skill-markdown-i18n
```

The installer will prompt you to:
1. Choose scope: Global (all projects) or Project (current directory)
2. Select CLIs: Cursor, Claude Code, Codex, Gemini

### Supported CLI Environments

| CLI | Skill Location | Notes |
|-----|----------------|-------|
| **Cursor** | `~/.cursor/skills/` or `.cursor/skills/` | Uses `@skill-name` to invoke |
| **Claude Code** | `~/.claude/skills/` or `.claude/skills/` | Auto-discovered from CLAUDE.md |
| **Codex** | `~/.codex/skills/` or `.codex/skills/` | Requires config.toml with `skills = true` |
| **Gemini** | Project `.gemini/` or `GEMINI.md` | Reference in context |

### Codex Configuration

For project-level Codex skills to auto-load, ensure `.codex/config.toml` exists:

```toml
[features]
skills = true
```

The interactive installer handles this automatically.

## Translation Plan (Required for Batch Translation)

**IMPORTANT**: Before translating new documents, you MUST create a translation plan first.

### Plan File Location

The plan file should be stored in the **project's** skill folder, even if this skill is installed globally:

| CLI | Plan Location |
|-----|---------------|
| Cursor | `<project>/.cursor/skills/markdown-i18n/translation-plan.yaml` |
| Claude Code | `<project>/.claude/skills/markdown-i18n/translation-plan.yaml` |
| Codex | `<project>/.codex/skills/markdown-i18n/translation-plan.yaml` |
| Gemini | `<project>/.gemini/markdown-i18n/translation-plan.yaml` |

### Plan File Format (YAML)

```yaml
meta:
  created: '2025-01-31T10:30:00Z'
  source_dir: en/
  target_dir: zh/
  status: in_progress  # not_started | in_progress | completed

summary:
  total: 15
  completed: 3
  remaining: 12

files:
  - source: en/start/getting-started.md
    target: zh/start/getting-started.md
    status: done  # pending | in_progress | done | skipped
    notes: ''

  - source: en/help/faq.md
    target: zh/help/faq.md
    status: in_progress
    notes: 'Large file, 50% complete'

  - source: en/help/troubleshooting.md
    target: zh/help/troubleshooting.md
    status: pending
    notes: ''

log:
  - time: '2025-01-31T10:35:00Z'
    file: en/start/getting-started.md
    action: done
    notes: ''
```

### Plan Workflow

```
Step 1: Create Plan
- [ ] Scan source directory for all .md files
- [ ] Check which targets already exist
- [ ] Generate plan file with all pending files
- [ ] Save plan to project skill folder

Step 2: Execute Plan
- [ ] Read plan file
- [ ] Find next pending/in_progress file
- [ ] Translate file
- [ ] Update plan status to done
- [ ] Repeat until all done

Step 3: Resume (after interruption)
- [ ] Read existing plan file
- [ ] Find first non-done file
- [ ] Continue from there
```

### Creating a Plan

When user requests batch translation, FIRST create the plan:

```bash
# User request
"Translate all files in docs/en/ to docs/zh/"

# Agent response
1. Scan docs/en/ for all .md files
2. Create .codex/skills/markdown-i18n/translation-plan.yaml
3. Show plan summary to user
4. Ask: "Plan created with 15 files. Start translation?"
```

### Resuming a Plan

When user wants to continue:

```bash
# User request
"Continue translation" or "Resume i18n"

# Agent response
1. Look for existing translation-plan.yaml in project skill folder
2. Read current status (parse YAML)
3. Find next pending file (status != done)
4. Continue translation
5. Update plan after each file (modify YAML and save)
```

## Workflow Types

### 1. Translate New Document (Single File)

For single file, plan is optional. For multiple files, plan is REQUIRED.

```
Task Progress:
- [ ] Read source document
- [ ] Identify preserve elements
- [ ] Translate content
- [ ] Adjust locale-specific links
- [ ] Validate output
- [ ] Update plan status (if plan exists)
```

### 2. Translate New Documents (Batch) - REQUIRES PLAN

```
Task Progress:
- [ ] Create/load translation plan
- [ ] For each pending file in plan:
    - [ ] Translate file
    - [ ] Validate output
    - [ ] Mark as done in plan
- [ ] Report final summary
```

### 3. Sync Updated Document

Source was updated, target needs sync.

```
Task Progress:
- [ ] Diff source vs previous version
- [ ] Identify changed sections
- [ ] Translate only changed parts
- [ ] Merge into target
- [ ] Validate output
```

## Translation Rules

### Always Preserve (DO NOT translate)

1. **Code blocks** - Keep exactly as-is:
   ```bash
   openclaw status --all  # ← preserve entire block
   ```

2. **Technical commands/paths** in inline code:
   - `openclaw config get agents.defaults.models`
   - `/install#nodejs--npm-path-sanity`

3. **URLs** - Keep domain/path unchanged:
   - `https://openclaw.bot/install.sh`

4. **Variables/placeholders**:
   - `{{variable_name}}`
   - `$ENVIRONMENT_VAR`

### Translate with Care

1. **Frontmatter** - Translate values, keep keys:
   ```yaml
   # EN
   summary: "Troubleshooting hub: symptoms → checks → fixes"
   
   # ZH
   summary: "故障排查枢纽：症状 → 检查 → 修复"
   ```

2. **Internal links** - Add locale prefix:
   ```markdown
   # EN
   [Install](/install#nodejs--npm-path-sanity)
   
   # ZH  
   [安装](/zh/install#nodejs--npm-path-sanity)
   ```

3. **Section headings** - Translate text, keep anchors working

### Technical Terms Strategy

| Term | EN | ZH | Note |
|------|----|----|------|
| Gateway | Gateway | Gateway | Keep English |
| CLI | CLI | CLI | Keep English |
| OAuth | OAuth | OAuth | Keep English |
| allowlist | allowlist | allowlist | Keep English in code context |
| verbose | verbose | verbose | Keep in flag context |

## Quality Checks

After translation, verify:

### Completeness Check
```
- [ ] Same number of headings (## / ###)
- [ ] Same number of code blocks
- [ ] Same number of list items
- [ ] Same number of links
- [ ] Frontmatter keys match
```

### Format Consistency
```
- [ ] Code blocks have same language tags
- [ ] Links are valid (locale prefix added)
- [ ] No broken markdown syntax
- [ ] Proper spacing around code blocks
```

### Content Integrity
```
- [ ] Commands in code blocks unchanged
- [ ] URLs unchanged
- [ ] Variables/placeholders unchanged
- [ ] Technical terms consistent
```

## Example: Full Translation

**Source (EN):**
```markdown
---
summary: "Quick start guide"
---

# Getting Started

Run the installer:

\`\`\`bash
curl -fsSL https://example.com/install.sh | bash
\`\`\`

See [configuration](/config) for options.
```

**Target (ZH):**
```markdown
---
summary: "快速入门指南"
---

# 入门指南

运行安装器：

\`\`\`bash
curl -fsSL https://example.com/install.sh | bash
\`\`\`

参见[配置](/zh/config)了解选项。
```

## Sync Workflow Detail

When source document is updated:

1. **Identify changes** - Compare current source with previous version
2. **Map to target sections** - Find corresponding sections in target
3. **Translate deltas** - Only translate new/changed content
4. **Preserve existing translations** - Don't re-translate unchanged parts
5. **Merge carefully** - Insert translated changes at correct positions

### Handling Structural Changes

| Change Type | Action |
|-------------|--------|
| New section added | Translate and insert at same position |
| Section removed | Remove from target |
| Section reordered | Reorder target to match |
| Content updated | Re-translate that section only |

## CLI-Specific Notes

### Cursor / Claude Code
```bash
# Translate single file
"Translate en/help/troubleshooting.md to zh/help/troubleshooting.md"

# Sync after update
"Source en/help/troubleshooting.md was updated, sync zh version"

# Batch translate
"Translate all files in en/start/ to zh/start/"
```

### Codex
```bash
codex "translate docs/en/guide.md to Chinese, output to docs/zh/guide.md"
```

### Gemini
Reference this skill in your prompt or GEMINI.md for consistent translation behavior.

## Configuration (Optional)

If your project has a translation config, respect it:

```yaml
# .i18n.yml or similar
source_locale: en
target_locales: [zh, ja, ko]
link_prefix:
  zh: /zh
  ja: /ja
  ko: /ko
preserve_patterns:
  - "{{.*}}"
  - "\\$[A-Z_]+"
```

## Utility Scripts (Node.js)

First install dependencies in the scripts folder:
```bash
cd <skill-path>/scripts && npm install
```

| Script | Purpose | Usage |
|--------|---------|-------|
| `create-plan.js` | Generate translation plan | `node scripts/create-plan.js docs/en docs/zh -o translation-plan.yaml` |
| `update-plan.js` | Update file status in plan | `node scripts/update-plan.js translation-plan.yaml docs/en/guide.md done` |
| `validate.js` | Validate translation quality | `node scripts/validate.js source.md target.md` |
| `diff-sections.js` | Find changed sections | `node scripts/diff-sections.js old.md new.md` |

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `in_progress` | Currently working |
| `done` | Completed |
| `skipped` | Intentionally skipped |

## Additional Resources

- For terminology glossary, see [glossary.md](glossary.md)
