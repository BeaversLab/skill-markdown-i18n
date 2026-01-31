#!/usr/bin/env node
/**
 * Interactive installer for markdown-i18n skill
 * 
 * Usage:
 *   npx skill-markdown-i18n
 *   node install.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for inquirer
async function loadInquirer() {
  try {
    const inquirer = await import('inquirer');
    return inquirer.default;
  } catch {
    console.log('Installing inquirer...');
    await runCommand('npm', ['install', 'inquirer'], __dirname);
    const inquirer = await import('inquirer');
    return inquirer.default;
  }
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Exit code: ${code}`)));
    proc.on('error', reject);
  });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // Skip node_modules and package-lock.json
    if (entry.name === 'node_modules' || entry.name === 'package-lock.json') {
      continue;
    }
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureCodexConfig(projectPath) {
  const configPath = path.join(projectPath, '.codex', 'config.toml');
  const configDir = path.dirname(configPath);
  
  await fs.mkdir(configDir, { recursive: true });
  
  if (await fileExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf-8');
    if (!content.includes('skills = true')) {
      // Append skills config
      const newContent = content.trim() + '\n\n[features]\nskills = true\n';
      await fs.writeFile(configPath, newContent);
      console.log(`  Updated ${configPath}`);
    }
  } else {
    await fs.writeFile(configPath, '[features]\nskills = true\n');
    console.log(`  Created ${configPath}`);
  }
}

async function installToPath(skillSrc, targetDir, cli) {
  const skillDest = path.join(targetDir, 'markdown-i18n');
  
  console.log(`\n📦 Installing to ${skillDest}`);
  
  await copyDir(skillSrc, skillDest);
  console.log(`  Copied skill files`);
  
  // Install npm dependencies
  const scriptsDir = path.join(skillDest, 'scripts');
  if (await fileExists(path.join(scriptsDir, 'package.json'))) {
    console.log(`  Installing script dependencies...`);
    await runCommand('npm', ['install', '--silent'], scriptsDir);
    console.log(`  Dependencies installed`);
  }
  
  return skillDest;
}

async function main() {
  console.log(`
╔════════════════════════════════════════╗
║     Markdown i18n Skill Installer      ║
╠════════════════════════════════════════╣
║  Translate & sync markdown docs        ║
║  across multiple languages             ║
╚════════════════════════════════════════╝
`);

  const inquirer = await loadInquirer();
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const cwd = process.cwd();

  // CLI options with paths
  const cliOptions = [
    { 
      name: 'Cursor', 
      value: 'cursor',
      globalPath: path.join(homeDir, '.cursor', 'skills'),
      projectPath: path.join(cwd, '.cursor', 'skills'),
      needsConfig: false
    },
    { 
      name: 'Claude Code', 
      value: 'claude',
      globalPath: path.join(homeDir, '.claude', 'skills'),
      projectPath: path.join(cwd, '.claude', 'skills'),
      needsConfig: false
    },
    { 
      name: 'Codex', 
      value: 'codex',
      globalPath: path.join(homeDir, '.codex', 'skills'),
      projectPath: path.join(cwd, '.codex', 'skills'),
      needsConfig: true
    },
    { 
      name: 'Gemini', 
      value: 'gemini',
      globalPath: path.join(homeDir, '.gemini', 'skills'),
      projectPath: path.join(cwd, '.gemini', 'skills'),
      needsConfig: false
    }
  ];

  // Questions
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'scope',
      message: 'Where do you want to install?',
      choices: [
        { name: '🌍 Global (available in all projects)', value: 'global' },
        { name: '📁 Project (current directory only)', value: 'project' }
      ]
    },
    {
      type: 'checkbox',
      name: 'clis',
      message: 'Select CLI tools to install for:',
      choices: cliOptions.map(cli => ({
        name: cli.name,
        value: cli.value,
        checked: cli.value === 'codex' || cli.value === 'cursor' || cli.value === 'claude'
      })),
      validate: (answer) => {
        if (answer.length < 1) {
          return 'Please select at least one CLI.';
        }
        return true;
      }
    }
  ]);

  const { scope, clis } = answers;
  const isGlobal = scope === 'global';

  console.log(`\n🚀 Installing markdown-i18n skill...`);
  console.log(`   Scope: ${isGlobal ? 'Global' : 'Project'}`);
  console.log(`   CLIs: ${clis.join(', ')}`);

  // Install for each selected CLI
  for (const cliValue of clis) {
    const cli = cliOptions.find(c => c.value === cliValue);
    const targetDir = isGlobal ? cli.globalPath : cli.projectPath;
    
    try {
      await installToPath(__dirname, targetDir, cli);
      
      // Handle Codex config requirement
      if (cli.needsConfig && !isGlobal) {
        await ensureCodexConfig(cwd);
      }
      
      console.log(`  ✅ ${cli.name} installation complete`);
    } catch (err) {
      console.error(`  ❌ ${cli.name} installation failed: ${err.message}`);
    }
  }

  // Summary
  console.log(`
╔════════════════════════════════════════╗
║          Installation Complete!        ║
╚════════════════════════════════════════╝

📖 Usage Examples:

  Translate a file:
    "Translate docs/en/guide.md to Chinese"

  Batch translate:
    "Translate all files in docs/en/ to docs/zh/"

  Resume translation:
    "Continue translation" or "Resume i18n"

📚 Documentation:
  - SKILL.md: Full skill documentation
  - README.md: Quick start guide
  - glossary.md: Translation terminology

🔧 Utility Scripts:
  node scripts/create-plan.js <src> <dest> -o plan.yaml
  node scripts/validate.js <source.md> <target.md>
`);
}

main().catch(err => {
  console.error('Installation failed:', err);
  process.exit(1);
});
