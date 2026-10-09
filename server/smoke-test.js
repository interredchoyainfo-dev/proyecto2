import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'giovanni-api-smoke-'));
const databasePath = path.join(tempDir, 'smoke.sqlite');
const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(0, '127.0.0.1', resolve);
});
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close((err) => err ? reject(err) : resolve()));

const child = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: databasePath,
    JWT_SECRET: 'smoke-test-only-secret-that-is-not-used-in-production',
    OWNER_EMAIL: 'owner@example.test',
    OWNER_PASSWORD: 'smoke-test-password',
    OWNER_PIN: '246810',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let childOutput = '';
child.stdout.on('data', (chunk) => { childOutput += chunk.toString(); });
child.stderr.on('data', (chunk) => { childOutput += chunk.toString(); });

const baseUrl = `http://127.0.0.1:${port}`;
async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`API exited before becoming healthy. Output:\n${childOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`API did not become healthy in time. Output:\n${childOutput}`);
}

try {
  const healthResponse = await waitForHealth();
  const health = await healthResponse.json();
  assert.equal(health.ok, true, 'health endpoint must report ok');

  const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.test', password: 'wrong-password' }),
  });
  assert.equal(invalidLogin.status, 401, 'invalid owner credentials must be rejected');

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.test', password: 'smoke-test-password' }),
  });
  assert.equal(loginResponse.status, 200, 'configured owner credentials must log in');
  const login = await loginResponse.json();
  assert.equal(login.user?.rol, 'superadmin');
  assert.ok(login.token, 'successful owner login must return a token');

  const blockedTenants = await fetch(`${baseUrl}/api/tenants`);
  assert.equal(blockedTenants.status, 401, 'tenant management must reject unauthenticated requests');

  const tenantsResponse = await fetch(`${baseUrl}/api/tenants`, {
    headers: { authorization: `Bearer ${login.token}` },
  });
  assert.equal(tenantsResponse.status, 200, 'SuperAdmin token must access tenant management');
  const tenants = await tenantsResponse.json();
  assert.ok(Array.isArray(tenants.tenants), 'tenant list must be an array');

  const pinResponse = await fetch(`${baseUrl}/api/auth/pin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '246810', negocioId: 'superadmin' }),
  });
  assert.equal(pinResponse.status, 200, 'configured SuperAdmin PIN must log in');
  assert.equal((await pinResponse.json()).user?.rol, 'superadmin');

  console.log('API smoke tests passed: health, owner authentication, SuperAdmin PIN, and protected tenant management.');
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(resolve, 2000);
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
}
