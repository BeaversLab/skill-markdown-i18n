#!/usr/bin/env node
/**
 * Validate i18n markdown translation quality.
 *
 * Usage:
 *   node validate.js <source.md> <target.md>
 *   node validate.js --dir <source_dir> <target_dir>
 *
 * Checks:
 * - Structure match (headings, code blocks, lists)
 * - Link integrity
 * - Code block preservation
 * - Frontmatter key match
 */

import fs from 'fs/promises';
import path from 'path';

function extractStructure(content) {
  return {
    headings: [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(m => [m[1], m[2]]),
    codeBlocks: [...content.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map(m => [m[1], m[2]]),
    links: [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => [m[1], m[2]]),
    listItems: [...content.matchAll(/^[-*]\s+(.+)$/gm)].map(m => m[1]),
    frontmatter: extractFrontmatterKeys(content)
  };
}

function extractFrontmatterKeys(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const keys = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      keys[key] = true;
    }
  }
  return keys;
}

function validatePair(source, target) {
  const errors = [];
  const warnings = [];
  
  const src = extractStructure(source);
  const tgt = extractStructure(target);
  
  // Check heading count
  if (src.headings.length !== tgt.headings.length) {
    errors.push(`Heading count mismatch: source=${src.headings.length}, target=${tgt.headings.length}`);
  }
  
  // Check code blocks preserved exactly
  if (src.codeBlocks.length !== tgt.codeBlocks.length) {
    errors.push(`Code block count mismatch: source=${src.codeBlocks.length}, target=${tgt.codeBlocks.length}`);
  } else {
    for (let i = 0; i < src.codeBlocks.length; i++) {
      const [srcLang, srcCode] = src.codeBlocks[i];
      const [tgtLang, tgtCode] = tgt.codeBlocks[i];
      
      if (srcLang !== tgtLang) {
        errors.push(`Code block ${i + 1} language mismatch: source='${srcLang}', target='${tgtLang}'`);
      }
      
      if (srcCode.trim() !== tgtCode.trim()) {
        errors.push(`Code block ${i + 1} content changed (should be identical)`);
      }
    }
  }
  
  // Check link count
  if (src.links.length !== tgt.links.length) {
    warnings.push(`Link count mismatch: source=${src.links.length}, target=${tgt.links.length}`);
  }
  
  // Check frontmatter keys
  const srcKeys = new Set(Object.keys(src.frontmatter));
  const tgtKeys = new Set(Object.keys(tgt.frontmatter));
  
  const missing = [...srcKeys].filter(k => !tgtKeys.has(k));
  const extra = [...tgtKeys].filter(k => !srcKeys.has(k));
  
  if (missing.length > 0) {
    errors.push(`Missing frontmatter keys: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    warnings.push(`Extra frontmatter keys: ${extra.join(', ')}`);
  }
  
  // Check list item count
  if (Math.abs(src.listItems.length - tgt.listItems.length) > 2) {
    warnings.push(`List item count differs significantly: source=${src.listItems.length}, target=${tgt.listItems.length}`);
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function findMarkdownFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  
  return files.sort();
}

async function validateFiles(sourcePath, targetPath) {
  const source = await fs.readFile(sourcePath, 'utf-8');
  const target = await fs.readFile(targetPath, 'utf-8');
  return validatePair(source, target);
}

async function validateDirectories(sourceDir, targetDir) {
  const results = {};
  const sourceFiles = await findMarkdownFiles(sourceDir);
  
  for (const relPath of sourceFiles) {
    const srcFile = path.join(sourceDir, relPath);
    const tgtFile = path.join(targetDir, relPath);
    
    try {
      await fs.access(tgtFile);
      results[relPath] = await validateFiles(srcFile, tgtFile);
    } catch {
      results[relPath] = {
        passed: false,
        errors: [`Target file missing: ${tgtFile}`],
        warnings: []
      };
    }
  }
  
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  let isDir = false, jsonOutput = false;
  const paths = [];
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') {
      isDir = true;
    } else if (args[i] === '--json') {
      jsonOutput = true;
    } else {
      paths.push(args[i]);
    }
  }
  
  if (paths.length < 2) {
    console.log('Usage: node validate.js <source.md> <target.md>');
    console.log('       node validate.js --dir <source_dir> <target_dir>');
    console.log('');
    console.log('Options:');
    console.log('  --dir   Validate all files in directories');
    console.log('  --json  Output as JSON');
    process.exit(1);
  }
  
  const [source, target] = paths;
  
  if (isDir) {
    const results = await validateDirectories(source, target);
    const allPassed = Object.values(results).every(r => r.passed);
    
    if (jsonOutput) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      for (const [filePath, result] of Object.entries(results)) {
        const status = result.passed ? '✓' : '✗';
        console.log(`${status} ${filePath}`);
        for (const err of result.errors) {
          console.log(`  ERROR: ${err}`);
        }
        for (const warn of result.warnings) {
          console.log(`  WARN: ${warn}`);
        }
      }
      console.log(`\n${allPassed ? 'PASSED' : 'FAILED'}`);
    }
    
    process.exit(allPassed ? 0 : 1);
  } else {
    const result = await validateFiles(source, target);
    
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const err of result.errors) {
        console.log(`ERROR: ${err}`);
      }
      for (const warn of result.warnings) {
        console.log(`WARN: ${warn}`);
      }
      console.log(`\n${result.passed ? 'PASSED' : 'FAILED'}`);
    }
    
    process.exit(result.passed ? 0 : 1);
  }
}

main();
