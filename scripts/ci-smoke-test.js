#!/usr/bin/env node
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

async function main() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-md-i18n-'));
  const sourceDir = path.join(tmpRoot, 'docs', 'en');
  const targetDir = path.join(tmpRoot, 'docs', 'zh');
  const outputDir = path.join(tmpRoot, '.i18n');

  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(targetDir, { recursive: true });

  const sourceFile = path.join(sourceDir, 'guide.md');
  const targetFile = path.join(targetDir, 'guide.md');

  const sourceContent = [
    '---',
    'title: Guide',
    'description: Sample',
    '---',
    '# Guide',
    '',
    '- item 1',
    '',
    '```bash',
    'echo "hi"',
    '```',
    ''
  ].join('\n');

  const targetContent = [
    '---',
    'title: 指南',
    'description: 示例',
    '---',
    '# 指南',
    '',
    '- 项目 1',
    '',
    '```bash',
    'echo "hi"',
    '```',
    ''
  ].join('\n');

  await fs.writeFile(sourceFile, sourceContent, 'utf-8');
  await fs.writeFile(targetFile, targetContent, 'utf-8');

  run('node', ['scripts/validate.js', sourceFile, targetFile, '--source-locale', 'en', '--target-locale', 'zh']);

  const createPlanOutput = path.join(outputDir, 'translation-plan.yaml');
  run('node', ['scripts/create-plan.js', sourceDir, targetDir, '--output', createPlanOutput]);
  await fs.access(createPlanOutput);

  const syncPlanOutput = path.join(outputDir, 'sync-plan.yaml');
  run('node', ['scripts/sync-plan.js', sourceDir, targetDir, '--output', syncPlanOutput]);
  await fs.access(syncPlanOutput);

  const gitPlanOutput = path.join(outputDir, 'git-sync-plan.yaml');
  run('node', ['scripts/git-diff-sync.js', 'README.md', 'README.md', '--output', gitPlanOutput, '--ref', 'HEAD'], {
    cwd: path.resolve('.')
  });
  await fs.access(gitPlanOutput);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
