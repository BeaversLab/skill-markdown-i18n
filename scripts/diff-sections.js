#!/usr/bin/env node
/**
 * Identify changed sections between two versions of a markdown file.
 *
 * Usage:
 *   node diff-sections.js <old.md> <new.md>
 *
 * Output:
 *   List of sections that changed, for targeted translation updates.
 */

import fs from 'fs/promises';

function extractSections(content) {
  const sections = {};
  let currentHeading = '__intro__';
  let currentContent = [];
  
  for (const line of content.split('\n')) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      // Save previous section
      sections[currentHeading] = currentContent.join('\n');
      
      // Start new section
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      currentHeading = `${'#'.repeat(level)} ${title}`;
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }
  
  // Save last section
  sections[currentHeading] = currentContent.join('\n');
  
  return sections;
}

function compareSections(oldContent, newContent) {
  const oldSections = extractSections(oldContent);
  const newSections = extractSections(newContent);
  
  const oldKeys = new Set(Object.keys(oldSections));
  const newKeys = new Set(Object.keys(newSections));
  
  const result = {
    added: [...newKeys].filter(k => !oldKeys.has(k)),
    removed: [...oldKeys].filter(k => !newKeys.has(k)),
    modified: [],
    unchanged: []
  };
  
  for (const key of oldKeys) {
    if (newKeys.has(key)) {
      if (oldSections[key].trim() !== newSections[key].trim()) {
        result.modified.push(key);
      } else {
        result.unchanged.push(key);
      }
    }
  }
  
  return result;
}

function generateDiff(oldText, newText) {
  // Simple line-by-line diff
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];
  
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined) {
      diff.push(`+ ${newLine}`);
    } else if (newLine === undefined) {
      diff.push(`- ${oldLine}`);
    } else if (oldLine !== newLine) {
      diff.push(`- ${oldLine}`);
      diff.push(`+ ${newLine}`);
    }
  }
  
  return diff.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  let jsonOutput = false, showDiff = false;
  const paths = [];
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      jsonOutput = true;
    } else if (args[i] === '--show-diff') {
      showDiff = true;
    } else {
      paths.push(args[i]);
    }
  }
  
  if (paths.length < 2) {
    console.log('Usage: node diff-sections.js <old.md> <new.md>');
    console.log('');
    console.log('Options:');
    console.log('  --json       Output as JSON');
    console.log('  --show-diff  Show actual diffs for modified sections');
    process.exit(1);
  }
  
  const [oldPath, newPath] = paths;
  
  const oldContent = await fs.readFile(oldPath, 'utf-8');
  const newContent = await fs.readFile(newPath, 'utf-8');
  
  const changes = compareSections(oldContent, newContent);
  
  if (jsonOutput) {
    console.log(JSON.stringify(changes, null, 2));
  } else {
    if (changes.added.length > 0) {
      console.log('ADDED SECTIONS:');
      for (const s of changes.added) {
        console.log(`  + ${s}`);
      }
    }
    
    if (changes.removed.length > 0) {
      console.log('\nREMOVED SECTIONS:');
      for (const s of changes.removed) {
        console.log(`  - ${s}`);
      }
    }
    
    if (changes.modified.length > 0) {
      console.log('\nMODIFIED SECTIONS:');
      for (const s of changes.modified) {
        console.log(`  ~ ${s}`);
      }
    }
    
    const total = changes.added.length + changes.removed.length + changes.modified.length;
    
    if (total === 0) {
      console.log('No changes detected.');
    } else {
      console.log(`\nTotal: ${total} section(s) changed`);
      
      if (showDiff && changes.modified.length > 0) {
        const oldSections = extractSections(oldContent);
        const newSections = extractSections(newContent);
        
        console.log('\n' + '='.repeat(60));
        for (const section of changes.modified) {
          console.log(`\n### ${section}`);
          const diff = generateDiff(oldSections[section], newSections[section]);
          console.log(diff);
        }
      }
    }
  }
}

main();
