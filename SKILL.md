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

### No-Translate Configuration

**Control what should NOT be translated** using a configuration file.

Create `.i18n/no-translate.yaml` in your project root to specify:

1. **Headings to keep in English** (exact match or pattern)
2. **Terms to not translate** (product names, brand terms)
3. **Sections to skip** (entire sections)
4. **URL patterns to exclude** (links to external docs)

**Example configuration:**
```yaml
# .i18n/no-translate.yaml

headings:
  # Exact match
  - text: "API Reference"
    reason: "Industry standard term"

  # Pattern match (regex)
  - pattern: ".*Getting Started.*"
    reason: "Brand-specific phrase"

terms:
  - text: "Gateway"
    reason: "Product name"
    context: "always"

  - text: "CLI"
    reason: "Industry standard"
    context: "always"

sections:
  - title: "Changelog"
    reason: "Historical record"

urls:
  - pattern: "/api/.*"
    reason: "API documentation stays in English"
```

**How it works:**
- AI will check this file before translating
- Headings/terms matching the rules will be kept in English
- You can use exact text or regex patterns
- Includes `reason` field for documentation

**Why use this:**
- Product names should stay consistent
- Industry-standard terms (API, CLI) shouldn't be translated
- Brand phrases need to maintain original language
- Technical sections may need to stay in English

**Location:** `<project_root>/.i18n/no-translate.yaml`

If the file doesn't exist, AI will use judgment based on the glossary.

### Translation Consistency Configuration

**Ensure consistent terminology translation** across all documents using a configuration file.

Create `.i18n/translation-consistency.yaml` in your project root to specify:
1. **Standard term translations** for consistent vocabulary
2. **Multi-language mappings** (EN, ZH, JA, KO)
3. **Context-specific translations** (optional)

**Example configuration:**
```yaml
# .i18n/translation-consistency.yaml

translations:
  install:
    en: Install
    zh: 安装
    ja: インストール
    ko: 설치

  configuration:
    en: Configuration
    zh: 配置
    ja: 設定
    ko: 설정

  troubleshooting:
    en: Troubleshooting
    zh: 故障排查
    ja: トラブルシューティング
    ko: 문제 해결
```

**How it works:**
- AI checks this file before translating common terms
- Ensures "Install" is always translated as "安装" (not "安装程序" or "设置")
- Provides multi-language support for consistent global documentation
- Use lowercase keys for easier matching

**Why use this:**
- Maintain consistent terminology across all documentation
- Avoid confusion from multiple translations of the same term
- Professional-grade documentation quality
- Essential for multi-language projects

**Location:** `<project_root>/.i18n/translation-consistency.yaml`

If the file doesn't exist, AI will use judgment based on context.

### Plan File Location

The plan file is stored in the **project's `.i18n` directory**:

| Installation Type | Plan Location |
|-------------------|---------------|
| Project skill | `<project_root>/.i18n/translation-plan.yaml` |
| Global skill | `<current_working_directory>/.i18n/translation-plan.yaml` (can override with `--output`) |

**Why `.i18n` directory?**
- Centralized location for all i18n-related files
- Works consistently whether skill is installed globally or per-project
- The `.i18n` directory is auto-created if it doesn't exist

**Custom output location:**
You can specify a custom output path using the `--output` parameter:
```bash
node create-plan.js docs/en docs/zh --output custom/location/plan.yaml
```

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
1. Run: node create-plan.js docs/en docs/zh
   - For project skill: Creates <project_root>/.i18n/translation-plan.yaml
   - For global skill: Creates <cwd>/.i18n/translation-plan.yaml
2. Show plan summary to user
3. Ask: "Plan created with 15 files. Start translation?"
```

### Resuming a Plan

When user wants to continue:

```bash
# User request
"Continue translation" or "Resume i18n"

# Agent response
1. Look for existing translation-plan.yaml in .i18n directory
2. Read current status (parse YAML)
3. Find next pending file (status != done)
4. Continue translation
5. Update plan after each file (modify YAML and save)
```

## Workflow Types

### 0. Sync Updated Document (Git-based)

Source file was updated in Git, target needs incremental sync:

```
Task Progress:
- [ ] Read .i18n/no-translate.yaml (if exists)
- [ ] Run git-diff-sync to detect changes
- [ ] Review affected sections in source
- [ ] For each changed section:
    - [ ] Check if heading is in no-translate list
    - [ ] If YES: Keep in English (don't translate)
    - [ ] If NO: Translate only changed parts
    - [ ] Merge into existing target
    - [ ] Preserve unchanged content
- [ ] Validate structure and links
- [ ] Update plan status if applicable
```

### 1. Sync Existing Translations (Directory-based)

Detect changes between source and target directories:

```
Task Progress:
- [ ] Run sync-plan to detect changes
- [ ] Review detected changes:
  - [ ] New files (in source only) → translate
  - [ ] Modified files (content changed) → sync changes
  - [ ] Deleted files (in target only) → review and delete if needed
- [ ] Execute sync actions
- [ ] Validate results
```

### 2. Translate New Document (Single File)

For single file, plan is optional. For multiple files, plan is REQUIRED.

```
Task Progress:
- [ ] Read .i18n/no-translate.yaml (if exists)
- [ ] Read source document
- [ ] Identify preserve elements
- [ ] For each section:
    - [ ] Check if heading is in no-translate list
    - [ ] If YES: Keep heading in English
    - [ ] If NO: Translate heading
    - [ ] Translate content (skip terms in no-translate list)
- [ ] Adjust locale-specific links
- [ ] Validate output
- [ ] Update plan status (if plan exists)
```

### 3. Translate New Documents (Batch) - REQUIRES PLAN

```
Task Progress:
- [ ] Create/load translation plan
- [ ] For each pending file in plan:
    - [ ] Translate file
    - [ ] Validate output
    - [ ] Mark as done in plan
- [ ] Report final summary
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

2. **Internal links** - Adjust locale prefix based on target language:

   **Rule:** Internal site links should use the target language prefix

   ```markdown
   # EN source
   [Install Guide](/en/install)
   [API Reference](/api/overview)
   [Getting Started](/en/get-started)

   # ZH target
   [安装指南](/zh/install)
   [API 参考](/zh/api/overview)
   [入门指南](/zh/get-started)
   ```

   **Link transformation patterns:**
   - `/en/*` → `/zh/*` (replace source locale with target)
   - `/xxx` (no locale) → `/zh/xxx` (add target locale prefix)
   - External URLs → Keep unchanged

   **Examples:**
   ```markdown
   # Source (EN)
   - See [Install](/en/install) for details
   - Check [API docs](/api) reference
   - Visit [https://example.com](https://example.com)

   # Target (ZH)
   - 查看[安装](/zh/install)了解详情
   - 检查 [API 文档](/zh/api)参考
   - 访问 [https://example.com](https://example.com)
   ```

3. **Section headings** - Translate text, keep anchors working

   **IMPORTANT:** Check `.i18n/no-translate.yaml` first!

   Headings in the no-translate list should be kept in English.

   **Decision flow:**
   ```
   1. Check if heading is in .i18n/no-translate.yaml
      → If YES: Keep in English
      → If NO: Proceed to step 2

   2. Is it a product/brand name?
      → If YES: Keep in English
      → If NO: Proceed to step 3

   3. Is it an industry-standard term (API, CLI, OAuth)?
      → If YES: Keep in English
      → If NO: Translate to target language
   ```

   **Examples:**
   ```markdown
   # Keep in English (in no-translate.yaml)
   ## API Reference
   ### CLI Commands

   # Translate
   ## 安装指南
   ### 配置选项
   ```

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

## Example: Full Translation with Link Localization

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

See [configuration](/en/config) for options.

For more details:
- [Installation Guide](/en/install)
- [API Documentation](/api/reference)
- [External Resource](https://developer.mozilla.com)
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

更多详情：
- [安装指南](/zh/install)
- [API 文档](/zh/api/reference)
- [外部资源](https://developer.mozilla.org)
```

**Key transformations:**
- `/en/config` → `/zh/config` (replace locale)
- `/api/reference` → `/zh/api/reference` (add locale prefix)
- `https://developer.mozilla.org` → unchanged (external URL)

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
| `create-plan.js` | Generate initial translation plan | `node scripts/create-plan.js docs/en docs/zh [-o path.yaml]` |
| `git-diff-sync.js` | Create Git-based sync plan | `node scripts/git-diff-sync.js docs/en/guide.md docs/zh/guide.md [-r REF]` |
| `sync-plan.js` | Create directory sync plan | `node scripts/sync-plan.js docs/en docs/zh [-o path.yaml]` |
| `update-plan.js` | Update file status in plan | `node scripts/update-plan.js .i18n/translation-plan.yaml docs/en/guide.md done` |
| `validate.js` | Validate translation quality | `node scripts/validate.js source.md target.md` |
| `diff-sections.js` | Find changed sections | `node scripts/diff-sections.js old.md new.md` |

### create-plan.js

Generate an initial translation plan for all files in source directory:

The script automatically detects whether the skill is installed globally or per-project:

- **Project skill**: Creates plan at `<project_root>/.i18n/translation-plan.yaml`
- **Global skill**: Creates plan at `<cwd>/.i18n/translation-plan.yaml` (can override with `-o`)

```bash
# Basic usage (auto-detects output location)
node scripts/create-plan.js docs/en docs/zh

# Custom output location
node scripts/create-plan.js docs/en docs/zh -o /path/to/custom-plan.yaml
```

### sync-plan.js

Create a sync plan by comparing source and target directories to detect changes:

**Detects four types of changes:**
- `+ New files` - Only exist in source (needs translation)
- `* Modified files` - Exist in both but content differs (needs sync)
- `- Deleted files` - Only exist in target (review for deletion)
- `= Unchanged files` - Exist in both with same content (no action needed)

```bash
# Basic sync (compares docs/en with docs/zh)
node scripts/sync-plan.js docs/en docs/zh

# Custom output location
node scripts/sync-plan.js docs/en docs/zh -o custom/sync-plan.yaml
```

**Output includes:**
- File status (pending/needs_update/deleted/done)
- Change type (NEW/MODIFIED/DELETED/UNCHANGED)
- Content hashes for comparison
- Actionable summary

**Example output:**
```
Scanning directories...
  Source: docs/en
  Target: docs/zh

Comparing files...
  + NEW: guide/new-feature.md
  * MODIFIED: guide/intro.md
  - DELETED: guide/old-feature.md

✓ Sync plan created: .i18n/translation-plan.yaml

Summary:
  New files:      1
  Modified files: 1
  Deleted files:  1
  Unchanged:      10
  Total:          13

Actions needed: 3
```

### git-diff-sync.js

Create a sync plan based on Git diff for a single file:

**Compares file versions using Git:**
- Uses `git diff` to detect precise line-level changes
- Identifies which markdown sections are affected
- Generates targeted sync plan for only changed content

```bash
# Compare with last commit (HEAD)
node scripts/git-diff-sync.js docs/en/guide.md docs/zh/guide.md

# Compare with specific commit
node scripts/git-diff-sync.js docs/en/guide.md docs/zh/guide.md -r HEAD~1

# Compare with specific branch
node scripts/git-diff-sync.js docs/en/guide.md docs/zh/guide.md -r main

# Custom output location
node scripts/git-diff-sync.js docs/en/guide.md docs/zh/guide.md -o custom/git-sync.yaml
```

**Output includes:**
- Git diff hunks (line ranges of changes)
- Affected markdown sections
- Source and target commit hashes (for viewing diff later)
- Instructions for incremental sync
- Target file existence check

**Example output:**
```
Analyzing Git changes...
  Source file: docs/en/guide.md
  Target file: docs/zh/guide.md
  Git reference: HEAD
  Working directory: /project

Resolving commit hashes...
  Source commit: a1b2c3d4e5f6...
  Target commit: 9f8e7d6c5b4a...
  View diff: git diff 9f8e7d6c5b4a a1b2c3d4e5f6 -- docs/en/guide.md

Getting Git diff...
  Found 2 change hunk(s)

✓ Changes detected in 1 section(s):
  - Getting Started

✓ Sync plan created: .i18n/git-sync-plan.yaml

Next steps:
  1. Review the plan file for detailed change information
  2. Process changes by operation type
  3. View diff: git diff 9f8e7d6c5b4a a1b2c3d4e5f6 -- "docs/en/guide.md"
  4. Validate: node scripts/validate.js "docs/en/guide.md" "docs/zh/guide.md"
```

**Viewing the diff later:**
The plan file includes `source_commit` and `target_commit` in the `meta` section, so you can always view the exact diff that generated the plan:
```bash
# From the plan file
git diff <target_commit> <source_commit> -- <source_file>

# Example
git diff 9f8e7d6c5b4a a1b2c3d4e5f6 -- docs/en/guide.md
```

**Use case:** When a source file is updated in Git and you need to sync only the changes to the translation, rather than re-translating the entire file.

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Not started (new file to translate) |
| `in_progress` | Currently working |
| `done` | Completed (unchanged) |
| `needs_update` | File modified in source, needs sync |
| `deleted` | Source file deleted, review target for deletion |
| `skipped` | Intentionally skipped |

## Additional Resources

- For terminology glossary, see [glossary.md](glossary.md)
