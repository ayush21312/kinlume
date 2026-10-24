import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Start React and its small API server together. Stop both when development ends.
const project = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['server/index.js'], {
    cwd: project,
    stdio: 'inherit',
  }),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--strictPort'],
    { cwd: project, stdio: 'inherit' },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
children.forEach((child) => {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code || 0));
});
