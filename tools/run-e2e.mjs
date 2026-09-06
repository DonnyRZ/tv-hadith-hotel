/* global console, process, setTimeout */

import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sharedEnvironment = {
  ...process.env,
  PLAYWRIGHT_EXTERNAL_SERVERS: '1',
};

const servers = [
  spawn(process.execPath, ['tools/static-server.mjs', 'apps/guest-web/dist'], {
    cwd: projectRoot,
    env: { ...sharedEnvironment, STATIC_PORT: '4173' },
    stdio: ['ignore', 'inherit', 'inherit'],
  }),
  spawn(process.execPath, ['tools/static-server.mjs', 'apps/staff-web/dist'], {
    cwd: projectRoot,
    env: { ...sharedEnvironment, STATIC_PORT: '4174' },
    stdio: ['ignore', 'inherit', 'inherit'],
  }),
];

let testProcess;
let shuttingDown = false;

function stopProcess(child) {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  child.kill('SIGTERM');
}

function stopServers() {
  for (const server of servers) stopProcess(server);
}

function waitForPort(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15_000;
    const attempt = () => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for the E2E server on port ${port}.`));
          return;
        }
        setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

async function main() {
  await Promise.all([waitForPort(4173), waitForPort(4174)]);
  testProcess = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
    {
      cwd: projectRoot,
      env: sharedEnvironment,
      stdio: 'inherit',
    },
  );

  const result = await new Promise((resolve) => {
    testProcess.once('exit', (code, signal) => resolve({ code, signal }));
    testProcess.once('error', () => resolve({ code: 1, signal: null }));
  });
  stopServers();
  process.exit(result.code ?? 1);
}

function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (testProcess !== undefined) stopProcess(testProcess);
  stopServers();
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  stopServers();
  process.exit(1);
});
