import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const allowedCommands = new Set(['dev', 'build', 'preview']);
const command = process.argv[2];
const forwardedArgs = process.argv.slice(3);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const astroBin = resolve('website', 'node_modules', '.bin', process.platform === 'win32' ? 'astro.cmd' : 'astro');

if (!allowedCommands.has(command)) {
  console.error('Usage: node scripts/run-website.mjs <dev|build|preview>');
  process.exit(1);
}

function runNpm(args) {
  const result = spawnSync(npmCommand, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(astroBin)) {
  console.log('Installing website dependencies...');
  runNpm(['install', '--prefix', 'website']);
}

runNpm([
  '--prefix',
  'website',
  'run',
  command,
  ...(forwardedArgs.length > 0 ? ['--', ...forwardedArgs] : []),
]);
