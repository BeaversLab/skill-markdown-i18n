#!/usr/bin/env node
/**
 * Create a sync plan by comparing two directories and detecting changes.
 *
 * Usage:
 *   node sync-plan.js <source_dir> <target_dir> [--output <plan_file>]
 *
 * Features:
 *   - Detects new files (in source only)
 *   - Detects deleted files (in target only)
 *   - Detects modified files (exist in both, but source changed)
 *   - Detects unchanged files (exist in both, not modified)
 *
 * Output location:
 *   - Project skill: <project_root>/.i18n/translation-plan.yaml
 *   - Global skill: <cwd>/.i18n/translation-plan.yaml (default, can override with --output)
 *
 * Example:
 *   node sync-plan.js docs/en docs/zh
 *   node sync-plan.js docs/en docs/zh --output custom/sync-plan.yaml
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculate file content hash for comparison
 */
async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Get file stats including mtime and hash
 */
async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const hash = await getFileHash(filePath);
    return {
      mtime: stats.mtime,
      size: stats.size,
      hash
    };
  } catch {
    return null;
  }
}

/**
 * Find all markdown files in a directory
 */
async function findMarkdownFiles(dir, baseDir = dir) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        files.push({
          relPath: path.relative(baseDir, fullPath),
          fullPath: fullPath
        });
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
  }

  return files;
}

/**
 * Detect if this is a project skill installation
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
        defaultOutputPath: path.join(i18nDir, 'translation-plan.yaml')
      };
    }
  }

  const i18nDir = path.join(cwd, '.i18n');
  return {
    isProjectSkill: false,
    projectRoot: null,
    defaultOutputPath: path.join(i18nDir, 'translation-plan.yaml')
  };
}

/**
 * Create sync plan by comparing source and target directories
 */
async function createSyncPlan(sourceDir, targetDir, outputPath) {
  console.log(`Scanning directories...`);
  console.log(`  Source: ${sourceDir}`);
  console.log(`  Target: ${targetDir}`);

  const sourceFiles = await findMarkdownFiles(sourceDir, sourceDir);
  const targetFiles = await findMarkdownFiles(targetDir, targetDir);

  // Create lookup maps
  const sourceMap = new Map(sourceFiles.map(f => [f.relPath, f]));
  const targetMap = new Map(targetFiles.map(f => [f.relPath, f]));

  // Find all unique paths
  const allPaths = new Set([
    ...sourceFiles.map(f => f.relPath),
    ...targetFiles.map(f => f.relPath)
  ]);

  const planFiles = [];
  const summary = {
    new: 0,
    deleted: 0,
    modified: 0,
    unchanged: 0,
    total: 0
  };

  console.log(`\nComparing files...`);

  for (const relPath of Array.from(allPaths).sort()) {
    const sourceFile = sourceMap.get(relPath);
    const targetFile = targetMap.get(relPath);

    let fileEntry;

    if (sourceFile && !targetFile) {
      // New file (only in source)
      summary.new++;
      fileEntry = {
        source: path.join(sourceDir, relPath),
        target: path.join(targetDir, relPath),
        status: 'pending',
        notes: 'NEW: 新增文件，需要翻译'
      };
      console.log(`  + NEW: ${relPath}`);

    } else if (!sourceFile && targetFile) {
      // Deleted file (only in target)
      summary.deleted++;
      fileEntry = {
        source: null,  // Source was deleted
        target: path.join(targetDir, relPath),
        status: 'deleted',
        notes: 'DELETED: 源文件已删除，目标文件应删除'
      };
      console.log(`  - DELETED: ${relPath}`);

    } else if (sourceFile && targetFile) {
      // File exists in both - check if modified
      const sourceStats = await getFileStats(sourceFile.fullPath);
      const targetStats = await getFileStats(targetFile.fullPath);

      if (sourceStats && targetStats) {
        // Compare by hash (content) for accuracy
        if (sourceStats.hash !== targetStats.hash) {
          summary.modified++;
          fileEntry = {
            source: path.join(sourceDir, relPath),
            target: path.join(targetDir, relPath),
            status: 'needs_update',
            notes: 'MODIFIED: 源文件已修改，需要同步更新翻译',
            source_hash: sourceStats.hash,
            target_hash: targetStats.hash,
            source_mtime: sourceStats.mtime.toISOString(),
            target_mtime: targetStats.mtime.toISOString()
          };
          console.log(`  * MODIFIED: ${relPath}`);
        } else {
          summary.unchanged++;
          fileEntry = {
            source: path.join(sourceDir, relPath),
            target: path.join(targetDir, relPath),
            status: 'done',
            notes: 'UNCHANGED: 文件未修改',
            source_hash: sourceStats.hash
          };
        }
      } else {
        // Error reading stats, mark as pending to be safe
        fileEntry = {
          source: path.join(sourceDir, relPath),
          target: path.join(targetDir, relPath),
          status: 'pending',
          notes: 'ERROR: 无法读取文件状态'
        };
      }
    }

    if (fileEntry) {
      planFiles.push(fileEntry);
      summary.total++;
    }
  }

  // Calculate overall status
  const needsAction = summary.new + summary.modified + summary.deleted;
  const overallStatus = needsAction === 0 ? 'completed' : (summary.unchanged > 0 ? 'in_progress' : 'not_started');

  // Create plan structure
  const plan = {
    meta: {
      created: new Date().toISOString(),
      source_dir: sourceDir,
      target_dir: targetDir,
      type: 'sync',  // Indicates this is a sync plan
      status: overallStatus
    },
    summary: {
      total: summary.total,
      new: summary.new,
      deleted: summary.deleted,
      modified: summary.modified,
      unchanged: summary.unchanged,
      needs_action: needsAction
    },
    files: planFiles,
    log: []
  };

  // Write plan file
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  const yamlContent = yaml.dump(plan, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });

  await fs.writeFile(outputPath, yamlContent, 'utf-8');

  // Print summary
  console.log(`\n✓ Sync plan created: ${outputPath}`);
  console.log(`\nSummary:`);
  console.log(`  New files:      ${summary.new}`);
  console.log(`  Modified files: ${summary.modified}`);
  console.log(`  Deleted files:  ${summary.deleted}`);
  console.log(`  Unchanged:      ${summary.unchanged}`);
  console.log(`  Total:          ${summary.total}`);
  console.log(`\nActions needed: ${needsAction}`);

  if (summary.deleted > 0) {
    console.log(`\n⚠️  Warning: ${summary.deleted} file(s) deleted in source.`);
    console.log(`   Review the plan and manually delete target files if needed.`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let sourceDir, targetDir, outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i];
    } else if (!sourceDir) {
      sourceDir = args[i];
    } else if (!targetDir) {
      targetDir = args[i];
    }
  }

  if (!sourceDir || !targetDir) {
    console.log('Usage: node sync-plan.js <source_dir> <target_dir> [--output <file>]');
    console.log('');
    console.log('Arguments:');
    console.log('  source_dir       Source directory (e.g., docs/en)');
    console.log('  target_dir       Target directory (e.g., docs/zh)');
    console.log('  --output, -o     Custom output path (optional)');
    console.log('');
    console.log('Output location (default):');
    console.log('  - Project skill:  <project_root>/.i18n/translation-plan.yaml');
    console.log('  - Global skill:   <cwd>/.i18n/translation-plan.yaml');
    console.log('');
    console.log('Detects:');
    console.log('  + New files      (only in source)');
    console.log('  * Modified files (in both, but content changed)');
    console.log('  - Deleted files  (only in target)');
    console.log('  = Unchanged files (in both, same content)');
    console.log('');
    console.log('Examples:');
    console.log('  node sync-plan.js docs/en docs/zh');
    console.log('  node sync-plan.js docs/en docs/zh --output custom/sync-plan.yaml');
    process.exit(1);
  }

  // Detect installation type and determine output path
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

  await createSyncPlan(sourceDir, targetDir, finalOutputPath);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
