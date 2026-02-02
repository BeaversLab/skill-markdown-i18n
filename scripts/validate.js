#!/usr/bin/env node
/**
 * Validate i18n markdown translation quality.
 *
 * Usage:
 *   node validate.js <source.md> <target.md> [--source-locale en] [--target-locale zh]
 *   node validate.js --dir <source_dir> <target_dir> [--source-locale en] [--target-locale zh]
 *
 * Checks:
 * - Structure match (headings, code blocks, lists)
 * - Link integrity and localization
 * - Code block preservation
 * - Frontmatter key match
 * - Internal link locale prefixes
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Detect locale from directory path
 */
function detectLocaleFromPath(filePath) {
  const match = filePath.match(/\/([a-z]{2})\//);
  return match ? match[1] : null;
}

/**
 * Parse locale from command line args or auto-detect from paths
 */
function parseLocales(sourcePath, targetPath, options) {
  let sourceLocale = options.sourceLocale;
  let targetLocale = options.targetLocale;

  // Auto-detect from paths if not specified
  if (!sourceLocale) {
    sourceLocale = detectLocaleFromPath(sourcePath);
  }
  if (!targetLocale) {
    targetLocale = detectLocaleFromPath(targetPath);
  }

  return { sourceLocale, targetLocale };
}

/**
 * Extract all links from markdown content
 */
function extractLinks(content) {
  return [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => ({
    text: m[1],
    url: m[2]
  }));
}

/**
 * Check if URL is an internal site link
 */
function isInternalLink(url) {
  if (!url.startsWith('/')) return false;
  if (url.startsWith('http://') || url.startsWith('https://')) return false;
  return true;
}

/**
 * Check if URL is external
 */
function isExternalLink(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Validate link localization
 */
function validateLinkLocalization(sourceLinks, targetLinks, sourceLocale, targetLocale) {
  const warnings = [];

  // Build lookup maps
  const srcLinksMap = new Map(sourceLinks.map(l => [l.url, l]));
  const tgtLinksMap = new Map(targetLinks.map(l => [l.url, l]));

  // Check each target link for proper localization
  for (const tgtLink of targetLinks) {
    const url = tgtLink.url;

    if (isInternalLink(url)) {
      // Internal link should be localized
      if (targetLocale) {
        // Check if link starts with target locale prefix
        const expectedPrefix = `/${targetLocale}/`;
        const hasLocalePrefix = url.startsWith(expectedPrefix) || url.startsWith(`/${targetLocale}?`);

        // Check if it still has source locale prefix (wrong!)
        if (sourceLocale && url.startsWith(`/${sourceLocale}/`)) {
          warnings.push(`Link still uses source locale: "${url}" (should use /${targetLocale}/)`);
        }
        // Check if it's missing locale prefix
        else if (!hasLocalePrefix && !url.match(/^\/[a-z]{2}\//)) {
          warnings.push(`Internal link missing locale prefix: "${url}" (should be /${targetLocale}${url})`);
        }
      }
    } else if (isExternalLink(url)) {
      // External links should be identical in source and target
      const srcLink = srcLinksMap.get(url);
      if (!srcLink) {
        // External link in target but not in source - might be OK, just info
        warnings.push(`External link in target not in source: "${url}" (verify if correct)`);
      }
    }
  }

  // Check for missing links
  for (const srcLink of sourceLinks) {
    const url = srcLink.url;

    if (isInternalLink(url) && sourceLocale && targetLocale) {
      // Build expected target URL
      let expectedTargetUrl;
      if (url.startsWith(`/${sourceLocale}/`)) {
        expectedTargetUrl = url.replace(`/${sourceLocale}/`, `/${targetLocale}/`);
      } else if (!url.match(/^\/[a-z]{2}\//)) {
        // No locale prefix, add target locale
        expectedTargetUrl = `/${targetLocale}${url}`;
      } else {
        expectedTargetUrl = url;
      }

      // Check if corresponding localized link exists in target
      const hasLocalized = targetLinks.some(t => t.url === expectedTargetUrl);
      if (!hasLocalized) {
        warnings.push(`Missing localized link in target: source="${url}" → expected target="${expectedTargetUrl}"`);
      }
    }
  }

  return warnings;
}

function extractStructure(content) {
  return {
    headings: [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(m => [m[1], m[2]]),
    codeBlocks: [...content.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map(m => [m[1], m[2]]),
    links: extractLinks(content),
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

function validatePair(source, target, sourceLocale, targetLocale) {
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

  // Validate link localization
  if (sourceLocale || targetLocale) {
    const linkWarnings = validateLinkLocalization(src.links, tgt.links, sourceLocale, targetLocale);
    warnings.push(...linkWarnings);
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
    warnings,
    localeInfo: {
      sourceLocale,
      targetLocale
    }
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

async function validateFiles(sourcePath, targetPath, sourceLocale, targetLocale) {
  const source = await fs.readFile(sourcePath, 'utf-8');
  const target = await fs.readFile(targetPath, 'utf-8');

  // Auto-detect locales if not provided
  if (!sourceLocale || !targetLocale) {
    const detected = parseLocales(sourcePath, targetPath, { sourceLocale, targetLocale });
    sourceLocale = detected.sourceLocale || sourceLocale;
    targetLocale = detected.targetLocale || targetLocale;
  }

  return validatePair(source, target, sourceLocale, targetLocale);
}

async function validateDirectories(sourceDir, targetDir, sourceLocale, targetLocale) {
  const results = {};
  const sourceFiles = await findMarkdownFiles(sourceDir);

  // Auto-detect locales from directory names
  if (!sourceLocale) {
    sourceLocale = detectLocaleFromPath(sourceDir);
  }
  if (!targetLocale) {
    targetLocale = detectLocaleFromPath(targetDir);
  }

  for (const relPath of sourceFiles) {
    const srcFile = path.join(sourceDir, relPath);
    const tgtFile = path.join(targetDir, relPath);

    try {
      await fs.access(tgtFile);
      results[relPath] = await validateFiles(srcFile, tgtFile, sourceLocale, targetLocale);
    } catch {
      results[relPath] = {
        passed: false,
        errors: [`Target file missing: ${tgtFile}`],
        warnings: [],
        localeInfo: { sourceLocale, targetLocale }
      };
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  let isDir = false, jsonOutput = false;
  let sourceLocale = null, targetLocale = null;
  const paths = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') {
      isDir = true;
    } else if (args[i] === '--json') {
      jsonOutput = true;
    } else if (args[i] === '--source-locale') {
      sourceLocale = args[++i];
    } else if (args[i] === '--target-locale') {
      targetLocale = args[++i];
    } else {
      paths.push(args[i]);
    }
  }

  if (paths.length < 2) {
    console.log('Usage: node validate.js <source.md> <target.md> [options]');
    console.log('       node validate.js --dir <source_dir> <target_dir> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dir              Validate all files in directories');
    console.log('  --json             Output as JSON');
    console.log('  --source-locale    Source locale code (e.g., en)');
    console.log('  --target-locale    Target locale code (e.g., zh)');
    console.log('');
    console.log('If locales are not specified, they will be auto-detected from directory paths.');
    console.log('');
    console.log('Examples:');
    console.log('  node validate.js docs/en/guide.md docs/zh/guide.md');
    console.log('  node validate.js docs/en/guide.md docs/zh/guide.md --source-locale en --target-locale zh');
    console.log('  node validate.js --dir docs/en docs/zh');
    process.exit(1);
  }

  const [source, target] = paths;

  if (isDir) {
    const results = await validateDirectories(source, target, sourceLocale, targetLocale);
    const allPassed = Object.values(results).every(r => r.passed);

    if (jsonOutput) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      // Show locale info
      const firstResult = Object.values(results)[0];
      if (firstResult?.localeInfo?.sourceLocale || firstResult?.localeInfo?.targetLocale) {
        console.log(`Locale detection: source=${firstResult.localeInfo.sourceLocale || '(auto)'} target=${firstResult.localeInfo.targetLocale || '(auto)'}\n`);
      }

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
    const result = await validateFiles(source, target, sourceLocale, targetLocale);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Show locale info
      if (result.localeInfo?.sourceLocale || result.localeInfo?.targetLocale) {
        console.log(`Locale detection: source=${result.localeInfo.sourceLocale || '(auto)'} target=${result.localeInfo.targetLocale || '(auto)'}\n`);
      }

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
