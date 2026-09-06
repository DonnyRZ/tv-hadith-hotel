/* global process, URL */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverPath = fileURLToPath(new URL('./static-server.mjs', import.meta.url));

function runServer(environment) {
  return spawnSync(process.execPath, [serverPath, 'dist'], {
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    timeout: 5_000,
  });
}

describe('production static server proxy gate', () => {
  it('fails closed when the required API proxy is missing', () => {
    const result = runServer({ REQUIRE_API_PROXY: 'true', API_PROXY_TARGET: '' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('API_PROXY_TARGET is required');
  });

  it('rejects an API path in the required proxy target', () => {
    const result = runServer({
      REQUIRE_API_PROXY: 'true',
      API_PROXY_TARGET: 'https://api.example.com/api/v1',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('without a path');
  });
});
