#!/usr/bin/env node
/**
 * Create a translation plan for markdown i18n.
 *
 * Usage:
 *   node create-plan.js <source_dir> <target_dir> [--output <plan_file>]
 *
 * Output location:
 *   - Project skill: <project_root>/.i18n/translation-plan.yaml
 *   - Global skill: <cwd>/.i18n/translation-plan.yaml (default, can override with --output)
 *
 * Example:
 *   node create-plan.js docs/en docs/zh
 *   node create-plan.js docs/en docs/zh --output custom/location/plan.yaml
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        files.push(path.relative(baseDir, fullPath));
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
  }
  
  return files.sort();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect if this is a project skill installation and determine the output path.
 *
 * Returns:
 *   - isProjectSkill: boolean - true if running from project skill directory
 *   - projectRoot: string | null - project root directory if project skill
 *   - defaultOutputPath: string - default output path for translation-plan.yaml
 */
async function detectInstallationType() {
  const cwd = process.cwd();
  const skillDir = __dirname;

  // Check if skill is in a project's .cli/skills directory
  // Project skill patterns: <project>/.{claude,cursor,codex,gemini}/skills/markdown-i18n
  const projectSkillPatterns = [
    '.claude/skills',
    '.cursor/skills',
    '.codex/skills',
    '.gemini/skills'
  ];

  for (const pattern of projectSkillPatterns) {
    // Check if skillDir contains the pattern
    const patternIndex = skillDir.indexOf(path.sep + pattern);
    if (patternIndex !== -1) {
      // Extract project root (everything before the pattern)
      const projectRoot = skillDir.substring(0, patternIndex);
      const i18nDir = path.join(projectRoot, '.i18n');

      return {
        isProjectSkill: true,
        projectRoot: projectRoot,
        defaultOutputPath: path.join(i18nDir, 'translation-plan.yaml')
      };
    }
  }

  // Global skill: use current working directory's .i18n folder
  const i18nDir = path.join(cwd, '.i18n');
  return {
    isProjectSkill: false,
    projectRoot: null,
    defaultOutputPath: path.join(i18nDir, 'translation-plan.yaml')
  };
}

async function createPlan(sourceDir, targetDir, outputPath, dryRun = false) {
  const sourceFiles = await findMarkdownFiles(sourceDir);
  
  if (sourceFiles.length === 0) {
    console.error(`No .md/.mdx files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const files = [];
  let completed = 0;
  
  for (const relPath of sourceFiles) {
    const sourcePath = path.join(sourceDir, relPath);
    const targetPath = path.join(targetDir, relPath);
    const exists = await fileExists(targetPath);
    
    if (exists) completed++;
    
    files.push({
      source: sourcePath,
      target: targetPath,
      status: exists ? 'done' : 'pending',
      notes: ''
    });
  }
  
  const remaining = files.length - completed;
  const status = remaining === 0 ? 'completed' : (completed > 0 ? 'in_progress' : 'not_started');
  
  const plan = {
    meta: {
      created: new Date().toISOString(),
      source_dir: sourceDir,
      target_dir: targetDir,
      status: status
    },
    summary: {
      total: files.length,
      completed: completed,
      remaining: remaining
    },
    files: files,
    log: []
  };
  
  const yamlContent = yaml.dump(plan, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });
  
  if (dryRun) {
    console.log(yamlContent);
  } else {
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, yamlContent, 'utf-8');
    
    console.log(`Plan created: ${outputPath}`);
    console.log(`Total files: ${files.length}`);
    console.log(`Already done: ${completed}`);
    console.log(`Pending: ${remaining}`);
  }
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let sourceDir, targetDir, outputPath = null, dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (!sourceDir) {
      sourceDir = args[i];
    } else if (!targetDir) {
      targetDir = args[i];
    }
  }

  if (!sourceDir || !targetDir) {
    console.log('Usage: node create-plan.js <source_dir> <target_dir> [--output <file>] [--dry-run]');
    console.log('');
    console.log('Arguments:');
    console.log('  source_dir       Source directory containing markdown files');
    console.log('  target_dir       Target directory for translated files');
    console.log('  --output, -o     Custom output path (optional)');
    console.log('  --dry-run        Print plan to stdout instead of writing file');
    console.log('');
    console.log('Output location (default):');
    console.log('  - Project skill:  <project_root>/.i18n/translation-plan.yaml');
    console.log('  - Global skill:   <cwd>/.i18n/translation-plan.yaml');
    console.log('');
    console.log('Examples:');
    console.log('  node create-plan.js docs/en docs/zh');
    console.log('  node create-plan.js docs/en docs/zh --output custom/plan.yaml');
    process.exit(1);
  }

  // Detect installation type and determine default output path
  const { isProjectSkill, projectRoot, defaultOutputPath } = await detectInstallationType();

  // Use custom output if provided, otherwise use default
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

  await createPlan(sourceDir, targetDir, finalOutputPath, dryRun);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
