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
  assert.ok(
    tenants.tenants.every((tenant) => !Object.hasOwn(tenant, 'adminPassword')),
    'tenant list must never expose plaintext administrative passwords'
  );

  const tenantDetailResponse = await fetch(`${baseUrl}/api/tenants/giovanni`, {
    headers: { authorization: `Bearer ${login.token}` },
  });
  assert.equal(tenantDetailResponse.status, 200, 'SuperAdmin must access tenant details');
  const tenantDetail = await tenantDetailResponse.json();
  assert.equal(
    Object.hasOwn(tenantDetail, 'adminPassword'),
    false,
    'tenant details must never expose plaintext administrative passwords'
  );

  const blockedOperationalApi = await fetch(`${baseUrl}/api/negocios/giovanni/sync`, {
    headers: { 'x-negocio-id': 'giovanni' },
  });
  assert.equal(
    blockedOperationalApi.status,
    401,
    'operational tenant APIs must reject requests without a token'
  );

  const tenantLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin', negocioId: 'giovanni' }),
  });
  assert.equal(tenantLoginResponse.status, 200, 'seeded tenant admin must be able to log in');
  const tenantLogin = await tenantLoginResponse.json();

  const allowedTenantApi = await fetch(`${baseUrl}/api/negocios/giovanni/sync`, {
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'x-negocio-id': 'giovanni',
    },
  });
  assert.equal(allowedTenantApi.status, 200, 'tenant token must access its own operational API');

  const crossTenantApi = await fetch(`${baseUrl}/api/negocios/demo/sync`, {
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'x-negocio-id': 'demo',
    },
  });
  assert.equal(
    crossTenantApi.status,
    403,
    'tenant token must not access another tenant operational API'
  );

  // No debe poder falsearse el negocio de la URL enviando una cabecera de otro tenant.
  const spoofedTenantHeader = await fetch(`${baseUrl}/api/negocios/demo/sync`, {
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'x-negocio-id': 'giovanni',
    },
  });
  assert.equal(
    spoofedTenantHeader.status,
    403,
    'tenant authorization must follow the URL tenant even when x-negocio-id is spoofed'
  );

  const missingTenantSelector = await fetch(`${baseUrl}/api/sync`, {
    headers: { authorization: `Bearer ${tenantLogin.token}` },
  });
  assert.equal(
    missingTenantSelector.status,
    400,
    'legacy operational aliases must reject requests without an explicit tenant selector'
  );

  const pinResponse = await fetch(`${baseUrl}/api/auth/pin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '246810', negocioId: 'superadmin' }),
  });
  assert.equal(pinResponse.status, 200, 'configured SuperAdmin PIN must log in');
  assert.equal((await pinResponse.json()).user?.rol, 'superadmin');

  console.log('API smoke tests passed: health, authentication, protected tenant management, no password leaks, and tenant isolation.');
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(resolve, 2000);
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
}
