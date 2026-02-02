#!/usr/bin/env node
/**
 * Create a detailed sync plan based on Git diff with operation types.
 *
 * Usage:
 *   node git-diff-sync.js <source_file> <target_file> [git_ref]
 *
 * Compares the current working tree version of source_file with a git
 * reference (default: HEAD) to detect changes, then creates a detailed
 * execution plan with operation types (add/delete/modify/format).
 *
 * Examples:
 *   # Compare with HEAD (last commit)
 *   node git-diff-sync.js docs/en/guide.md docs/zh/guide.md
 *
 *   # Compare with specific commit
 *   node git-diff-sync.js docs/en/guide.md docs/zh/guide.md HEAD~1
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Execute git command and return output
 */
async function gitExec(args, cwd = process.cwd()) {
  try {
    const { stdout, stderr } = await execAsync(`git ${args}`, { cwd });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    throw new Error(`Git command failed: git ${args}\n${error.message}`);
  }
}

/**
 * Get git diff for a file with full context
 */
async function getGitDiff(filePath, gitRef = 'HEAD', cwd = process.cwd()) {
  const { stdout } = await gitExec(`diff ${gitRef} -- "${filePath}"`, cwd);
  return stdout;
}

/**
 * Parse git diff and extract detailed change information
 */
function parseGitDiffDetailed(diffOutput) {
  const lines = diffOutput.split('\n');
  const hunks = [];
  let currentHunk = null;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match hunk headers: @@ -old_start,old_count +new_start,new_count @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      // Save previous hunk if exists
      if (currentHunk && inHunk) {
        hunks.push(currentHunk);
      }

      // Start new hunk
      currentHunk = {
        old_start: parseInt(hunkMatch[1], 10),
        old_count: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
        new_start: parseInt(hunkMatch[3], 10),
        new_count: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
        deleted_lines: [],
        added_lines: [],
        context_lines: [],
        header: line
      };
      inHunk = true;
      continue;
    }

    // Parse hunk content lines
    if (inHunk && currentHunk) {
      if (line.startsWith('-')) {
        // Deleted line
        currentHunk.deleted_lines.push(line.substring(1));
      } else if (line.startsWith('+')) {
        // Added line
        currentHunk.added_lines.push(line.substring(1));
      } else if (line.startsWith(' ')) {
        // Context line (unchanged)
        currentHunk.context_lines.push(line.substring(1));
      } else if (line === '\\ No newline at end of file') {
        // Special marker, ignore but continue
        continue;
      } else if (line.startsWith('@@') || line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
        // Diff metadata, end current hunk
        if (currentHunk) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
        inHunk = false;
      }
    }
  }

  // Add last hunk
  if (currentHunk && inHunk) {
    hunks.push(currentHunk);
  }

  // Analyze operation type for each hunk
  return hunks.map(hunk => analyzeHunkOperation(hunk));
}

/**
 * Analyze hunk and determine operation type
 */
function analyzeHunkOperation(hunk) {
  const hasDeleted = hunk.deleted_lines.length > 0;
  const hasAdded = hunk.added_lines.length > 0;
  const hasOnlyWhitespaceChanges = checkWhitespaceOnlyChanges(hunk);

  let operation = 'modify';
  let description = 'Content modified';

  if (!hasDeleted && hasAdded) {
    operation = 'add';
    description = `Add ${hunk.added_lines.length} line(s)`;
  } else if (hasDeleted && !hasAdded) {
    operation = 'delete';
    description = `Delete ${hunk.deleted_lines.length} line(s)`;
  } else if (hasOnlyWhitespaceChanges) {
    operation = 'format';
    description = 'Format/whitespace change';
  } else if (hasDeleted && hasAdded) {
    operation = 'modify';
    description = `Replace ${hunk.deleted_lines.length} line(s) with ${hunk.added_lines.length} line(s)`;
  }

  return {
    ...hunk,
    operation,
    description,
    line_range: `Lines ${hunk.new_start}-${hunk.new_start + hunk.new_count - 1}`
  };
}

/**
 * Check if changes are only whitespace/formatting
 */
function checkWhitespaceOnlyChanges(hunk) {
  if (hunk.deleted_lines.length !== hunk.added_lines.length) {
    return false;
  }

  for (let i = 0; i < hunk.deleted_lines.length; i++) {
    const deleted = hunk.deleted_lines[i];
    const added = hunk.added_lines[i];

    // Compare trimmed content
    if (deleted.trim() !== added.trim()) {
      return false;
    }
  }

  return true;
}

/**
 * Get file content at specific git reference
 */
async function getFileAtRef(filePath, gitRef, cwd = process.cwd()) {
  const { stdout } = await gitExec(`show ${gitRef}:"${filePath}"`, cwd);
  return stdout;
}

/**
 * Read file content
 */
async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Parse markdown into sections
 */
function parseMarkdownSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = { title: '(untitled)', start: 0, level: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection.start < i) {
        currentSection.end = i - 1;
        currentSection.content = lines.slice(currentSection.start, i).join('\n');
        sections.push({ ...currentSection });
      }

      // Start new section
      currentSection = {
        title: headingMatch[2],
        start: i,
        level: headingMatch[1].length
      };
    }
  }

  // Add last section
  if (currentSection.start < lines.length) {
    currentSection.end = lines.length - 1;
    currentSection.content = lines.slice(currentSection.start).join('\n');
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Find which sections contain the changed hunks
 */
function findAffectedSections(hunks, sections) {
  const affected = new Map();

  for (const hunk of hunks) {
    // Skip if hunk doesn't have required properties
    if (!hunk || typeof hunk.new_start === 'undefined') {
      console.error('Invalid hunk:', hunk);
      continue;
    }

    for (const section of sections) {
      // Check if hunk overlaps with section
      if (hunk.new_start >= section.start && hunk.new_start <= section.end + 1) {
        if (!affected.has(section.title)) {
          affected.set(section.title, []);
        }
        affected.get(section.title).push(hunk);
        break;
      }
    }
  }

  // Convert to array
  return Array.from(affected.entries()).map(([sectionTitle, sectionHunks]) => {
    // Get operation types safely
    const operationTypes = sectionHunks
      .map(h => h.operation || 'unknown')
      .filter((op, index, self) => self.indexOf(op) === index);

    return {
      section_title: sectionTitle,
      hunks: sectionHunks,
      operation_types: operationTypes,
      total_changes: sectionHunks.length
    };
  });
}

/**
 * Detect installation type
 */
async function detectInstallationType() {
  const cwd = process.cwd();
  const skillDir = __dirname;

  const projectSkillPatterns = [
    '.claude/skills',
    '.cursor/skills',
    '.codex/skills',
    '.gemini/skills'
  ];

  for (const pattern of projectSkillPatterns) {
    const patternIndex = skillDir.indexOf(path.sep + pattern);
    if (patternIndex !== -1) {
      const projectRoot = skillDir.substring(0, patternIndex);
      const i18nDir = path.join(projectRoot, '.i18n');

      return {
        isProjectSkill: true,
        projectRoot: projectRoot,
        defaultOutputPath: path.join(i18nDir, 'git-sync-plan.yaml')
      };
    }
  }

  const i18nDir = path.join(cwd, '.i18n');
  return {
    isProjectSkill: false,
    projectRoot: null,
    defaultOutputPath: path.join(i18nDir, 'git-sync-plan.yaml')
  };
}

/**
 * Generate execution instructions based on operation types
 */
function generateExecutionInstructions(plan) {
  const instructions = [
    '1. Review the affected sections and operation types',
    '2. For each section, process changes in order:',
    '   - ADD: Translate new lines and insert at target',
    '   - DELETE: Remove corresponding lines from target',
    '   - MODIFY: Translate changes and update target',
    '   - FORMAT: Adjust formatting (spacing, indentation)',
    '3. Preserve code blocks, URLs, and technical terms',
    '4. Validate structure and links',
    '5. Run validation: node scripts/validate.js source.md target.md'
  ];

  const operationStats = {
    add: 0,
    delete: 0,
    modify: 0,
    format: 0
  };

  plan.changes.forEach(change => {
    operationStats[change.operation]++;
  });

  return {
    steps: instructions,
    operation_summary: operationStats,
    tips: [
      'For ADD operations: Focus on translating new content',
      'For DELETE operations: Ensure target deletion is safe',
      'For MODIFY operations: Compare old and new, translate only deltas',
      'For FORMAT operations: Adjust spacing without changing content'
    ]
  };
}

/**
 * Create git diff sync plan with detailed operations
 */
async function createGitDiffSyncPlan(sourceFile, targetFile, gitRef, outputPath, cwd = process.cwd()) {
  console.log(`Analyzing Git changes...`);
  console.log(`  Source file: ${sourceFile}`);
  console.log(`  Target file: ${targetFile}`);
  console.log(`  Git reference: ${gitRef}`);
  console.log(`  Working directory: ${cwd}`);

  // Check if we're in a git repository
  try {
    await gitExec('rev-parse --git-dir', cwd);
  } catch {
    throw new Error('Not in a Git repository. Please run this command from within a Git repository.');
  }

  // Get git diff
  console.log(`\nGetting Git diff...`);
  const diffOutput = await getGitDiff(sourceFile, gitRef, cwd);

  if (!diffOutput) {
    console.log(`✓ No changes detected in ${sourceFile} compared to ${gitRef}`);
    console.log(`  File is up to date.`);

    // Create empty plan indicating no changes
    const plan = {
      meta: {
        created: new Date().toISOString(),
        source_file: sourceFile,
        target_file: targetFile,
        git_ref: gitRef,
        type: 'git-diff-sync',
        format_version: '2.0',
        status: 'completed'
      },
      summary: {
        has_changes: false,
        message: 'No changes detected'
      },
      changes: [],
      affected_sections: [],
      execution: null
    };

    await writePlan(plan, outputPath);
    return;
  }

  // Parse diff with detailed operation information
  console.log(`  Parsing diff with operation types...`);
  const hunks = parseGitDiffDetailed(diffOutput);
  console.log(`  Found ${hunks.length} change hunk(s)`);

  // Get current content
  const newContent = await readFile(sourceFile);
  if (!newContent) {
    throw new Error(`Source file not found: ${sourceFile}`);
  }

  // Parse sections from new content
  const sections = parseMarkdownSections(newContent);

  // Find affected sections with their hunks
  const affectedSections = findAffectedSections(hunks, sections);

  console.log(`\n✓ Changes detected in ${affectedSections.length} section(s):`);
  affectedSections.forEach(section => {
    const ops = section.operation_types.join(', ');
    console.log(`  - ${section.section_title} (${ops})`);
  });

  // Check if target file exists
  const targetContent = await readFile(targetFile);
  const targetExists = !!targetContent;

  if (!targetExists) {
    console.log(`\n⚠️  Warning: Target file does not exist: ${targetFile}`);
    console.log(`   Full translation will be needed.`);
  }

  // Create execution instructions
  const execution = generateExecutionInstructions({ changes: hunks });

  // Create sync plan with operation types
  const plan = {
    meta: {
      created: new Date().toISOString(),
      source_file: sourceFile,
      target_file: targetFile,
      git_ref: gitRef,
      type: 'git-diff-sync',
      format_version: '2.0',
      status: 'pending'
    },
    summary: {
      has_changes: true,
      total_hunks: hunks.length,
      affected_sections: affectedSections.length,
      target_exists: targetExists,
      operations: execution.operation_summary
    },
    changes: hunks.map((hunk, index) => ({
      hunk_index: index,
      operation: hunk.operation,
      description: hunk.description,
      line_range: hunk.line_range,
      old_start: hunk.old_start,
      old_count: hunk.old_count,
      new_start: hunk.new_start,
      new_count: hunk.new_count,
      deleted_lines: hunk.deleted_lines,
      added_lines: hunk.added_lines,
      context_lines: hunk.context_lines,
      header: hunk.header
    })),
    affected_sections: affectedSections.map(section => ({
      section_title: section.section_title,
      operation_types: section.operation_types,
      total_changes: section.total_changes,
      hunks: section.hunks.map(h => ({
        hunk_index: h.hunk_index,
        operation: h.operation,
        description: h.description
      }))
    })),
    execution
  };

  await writePlan(plan, outputPath);
}

/**
 * Write plan to file
 */
async function writePlan(plan, outputPath) {
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  const yamlContent = yaml.dump(plan, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });

  await fs.writeFile(outputPath, yamlContent, 'utf-8');

  console.log(`\n✓ Sync plan created: ${outputPath}`);

  if (plan.summary.has_changes) {
    console.log(`\nOperation Summary:`);
    const ops = plan.summary.operations;
    if (ops.add > 0) console.log(`  ADD: ${ops.add} change(s) - translate and insert`);
    if (ops.delete > 0) console.log(`  DELETE: ${ops.delete} change(s) - remove from target`);
    if (ops.modify > 0) console.log(`  MODIFY: ${ops.modify} change(s) - translate changes`);
    if (ops.format > 0) console.log(`  FORMAT: ${ops.format} change(s) - adjust formatting`);

    console.log(`\nNext steps:`);
    console.log(`  1. Review the plan file for detailed change information`);
    console.log(`  2. Process changes by operation type`);
    console.log(`  3. Validate: node scripts/validate.js "${plan.meta.source_file}" "${plan.meta.target_file}"`);
  } else {
    console.log(`\nNo action needed - file is up to date.`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let sourceFile, targetFile, gitRef = 'HEAD', outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i];
    } else if (args[i] === '--ref' || args[i] === '-r') {
      gitRef = args[++i];
    } else if (!sourceFile) {
      sourceFile = args[i];
    } else if (!targetFile) {
      targetFile = args[i];
    }
  }

  if (!sourceFile || !targetFile) {
    console.log('Usage: node git-diff-sync.js <source_file> <target_file> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  source_file       Path to source file (e.g., docs/en/guide.md)');
    console.log('  target_file       Path to target translation file (e.g., docs/zh/guide.md)');
    console.log('');
    console.log('Options:');
    console.log('  --ref, -r     Git reference to compare with (default: HEAD)');
    console.log('                 Examples: HEAD~1, main, origin/main, abc123');
    console.log('  --output, -o   Custom output path (optional)');
    console.log('');
    console.log('Output location (default):');
    console.log('  - Project skill:  <project_root>/.i18n/git-sync-plan.yaml');
    console.log('  - Global skill:   <cwd>/.i18n/git-sync-plan.yaml');
    console.log('');
    console.log('Operation types detected:');
    console.log('  ADD     - New lines added (needs translation)');
    console.log('  DELETE  - Lines removed (needs deletion from target)');
    console.log('  MODIFY  - Lines changed (needs delta translation)');
    console.log('  FORMAT  - Whitespace/formatting only (no translation needed)');
    console.log('');
    console.log('Examples:');
    console.log('  # Compare current file with last commit');
    console.log('  node git-diff-sync.js docs/en/guide.md docs/zh/guide.md');
    console.log('');
    console.log('  # Compare with specific commit');
    console.log('  node git-diff-sync.js docs/en/guide.md docs/zh/guide.md --ref HEAD~1');
    process.exit(1);
  }

  // Detect installation type
  const { isProjectSkill, projectRoot, defaultOutputPath } = await detectInstallationType();
  const finalOutputPath = outputPath || defaultOutputPath;

  // Show what's happening
  if (isProjectSkill) {
    console.log(`✓ Project skill detected`);
    console.log(`  Project root: ${projectRoot}`);
  } else {
    console.log(`✓ Global skill detected`);
    console.log(`  Current directory: ${process.cwd()}`);
  }

  if (!outputPath) {
    console.log(`  Output path: ${finalOutputPath}`);
  } else {
    console.log(`  Output path (custom): ${finalOutputPath}`);
  }

  console.log(``);

  await createGitDiffSyncPlan(sourceFile, targetFile, gitRef, finalOutputPath);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
