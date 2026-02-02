#!/usr/bin/env node
/**
 * Read no-translate configuration
 *
 * Usage:
 *   node read-no-translate.js [--project-dir <path>]
 *
 * Outputs the no-translate rules in JSON format
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find .i18n directory
 */
async function findI18nDir(startPath = process.cwd()) {
  const currentPath = startPath;

  // Check if .i18n exists in current directory
  const i18nPath = path.join(currentPath, '.i18n');
  try {
    const stat = await fs.stat(i18nPath);
    if (stat.isDirectory()) {
      return i18nPath;
    }
  } catch {
    // Not found, try parent directory
  }

  // Check in parent directories (project root)
  const pathsToCheck = [
    currentPath,
  ];

  for (const checkPath of pathsToCheck) {
    const testPath = path.join(checkPath, '.i18n');
    try {
      const stat = await fs.stat(testPath);
      if (stat.isDirectory()) {
        return testPath;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Read no-translate configuration
 */
async function readNoTranslateConfig(i18nDir) {
  const configPath = path.join(i18nDir, 'no-translate.yaml');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return yaml.load(content);
  } catch {
    // Config file doesn't exist, return empty config
    return {
      headings: [],
      terms: [],
      sections: [],
      urls: []
    };
  }
}

/**
 * Check if text should not be translated
 */
function shouldNotTranslate(text, type, config) {
  if (!config) return false;

  text = text.trim();

  switch (type) {
    case 'heading':
      // Check headings list
      for (const rule of config.headings || []) {
        if (rule.text && text === rule.text) {
          return { shouldSkip: true, reason: rule.reason };
        }
        if (rule.pattern) {
          try {
            const regex = new RegExp(rule.pattern);
            if (regex.test(text)) {
              return { shouldSkip: true, reason: rule.reason };
            }
          } catch {
            // Invalid regex, skip
          }
        }
      }
      break;

    case 'term':
      // Check terms list
      for (const rule of config.terms || []) {
        if (rule.text === text) {
          return { shouldSkip: true, reason: rule.reason };
        }
      }
      break;

    case 'section':
      // Check sections list
      for (const rule of config.sections || []) {
        if (rule.title === text) {
          return { shouldSkip: true, reason: rule.reason };
        }
      }
      break;
  }

  return { shouldSkip: false };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  let outputFormat = 'json';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-dir') {
      projectDir = args[++i];
    } else if (args[i] === '--format') {
      outputFormat = args[++i];
    }
  }

  // Find .i18n directory
  const i18nDir = await findI18nDir(projectDir);

  if (!i18nDir) {
    console.log('No .i18n directory found.');
    console.log('Create one at: <project_root>/.i18n/');
    process.exit(0);
  }

  // Read configuration
  const config = await readNoTranslateConfig(i18nDir);

  if (outputFormat === 'json') {
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log(`No-Translate Configuration: ${i18nDir}/no-translate.yaml`);
    console.log('');

    if (config.headings && config.headings.length > 0) {
      console.log('Headings to keep in English:');
      config.headings.forEach(h => {
        if (h.pattern) {
          console.log(`  Pattern: "${h.pattern}" - ${h.reason}`);
        } else {
          console.log(`  "${h.text}" - ${h.reason}`);
        }
      });
      console.log('');
    }

    if (config.terms && config.terms.length > 0) {
      console.log('Terms to keep in English:');
      config.terms.forEach(t => {
        console.log(`  "${t.text}" - ${t.reason} (${t.context || 'global'})`);
      });
      console.log('');
    }

    if (config.sections && config.sections.length > 0) {
      console.log('Sections to skip:');
      config.sections.forEach(s => {
        console.log(`  "${s.title}" - ${s.reason}`);
      });
      console.log('');
    }

    if (config.urls && config.urls.length > 0) {
      console.log('URL patterns to exclude:');
      config.urls.forEach(u => {
        console.log(`  ${u.pattern} - ${u.reason}`);
      });
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

// Export functions for use in other scripts
export { findI18nDir, readNoTranslateConfig, shouldNotTranslate };
