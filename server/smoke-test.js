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
    WA_ACCESS_TOKEN: '',
    WA_PHONE_NUMBER_ID: '',
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

  // El menú público y los pedidos del cliente deben funcionar sin sesión de staff.
  const publicMenuResponse = await fetch(`${baseUrl}/api/public/negocios/giovanni/menu`);
  assert.equal(publicMenuResponse.status, 200, 'public menu must be available without a token');
  const publicMenu = await publicMenuResponse.json();
  assert.ok(publicMenu.productos.length > 0, 'public menu must return available products');
  assert.ok(publicMenu.mesas.length > 0, 'public menu must return table choices');

  const publicOrderPayload = {
    id: 'smoke-public-order',
    tipoPedido: 'mostrador',
    clienteNombre: 'Smoke public customer',
    estado: 'confirmado',
    items: [{
      id: 'smoke-public-order-item',
      productoId: publicMenu.productos[0].id,
      cantidad: 1,
      estadoItem: 'pendiente',
      enviadoCocina: true,
    }],
  };
  const publicOrderResponse = await fetch(`${baseUrl}/api/public/negocios/giovanni/pedidos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(publicOrderPayload),
  });
  assert.equal(publicOrderResponse.status, 201, 'public customer order must be stored in SQLite');
  const publicOrder = await publicOrderResponse.json();
  assert.equal(publicOrder.order.orderId, publicOrderPayload.id);

  const publicOrderRetry = await fetch(`${baseUrl}/api/public/negocios/giovanni/pedidos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(publicOrderPayload),
  });
  assert.equal(publicOrderRetry.status, 200, 'retrying a public order must be idempotent');
  assert.equal((await publicOrderRetry.json()).order.duplicate, true);

  const ordersAfterPublicCreate = await fetch(`${baseUrl}/api/negocios/giovanni/pedidos`, {
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'x-negocio-id': 'giovanni',
    },
  });
  assert.equal(ordersAfterPublicCreate.status, 200, 'staff must read public orders through the authenticated API');
  const syncedOrders = await ordersAfterPublicCreate.json();
  const savedPublicOrder = syncedOrders.find((order) => order.id === publicOrderPayload.id);
  assert.ok(savedPublicOrder, 'public order must be visible to kitchen and waiters');
  assert.equal(savedPublicOrder.items[0].enviadoCocina, 1, 'confirmed public order items must be dispatched to kitchen');


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

  const createCashSession = await fetch(`${baseUrl}/api/negocios/giovanni/caja/sesion`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({
      id: 'smoke-shared-session-id',
      status: 'abierta',
      openingAmount: 100,
      openedBy: 'smoke-test',
    }),
  });
  assert.equal(createCashSession.status, 200, 'tenant must create/update its own cash session');

  const demoLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin', negocioId: 'demo' }),
  });
  assert.equal(demoLoginResponse.status, 200, 'demo tenant admin must be able to log in');
  const demoLogin = await demoLoginResponse.json();

  const crossTenantCashWrite = await fetch(`${baseUrl}/api/negocios/demo/caja/sesion`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${demoLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'demo',
    },
    body: JSON.stringify({
      id: 'smoke-shared-session-id',
      status: 'cerrada',
      openingAmount: 999999,
      openedBy: 'malicious-test',
    }),
  });
  assert.equal(
    crossTenantCashWrite.status,
    409,
    'a tenant must not overwrite a cash session ID owned by another tenant'
  );

  const tamperOpenCash = await fetch(`${baseUrl}/api/negocios/giovanni/caja/sesion`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({
      id: 'smoke-shared-session-id',
      status: 'abierta',
      openingAmount: 999999,
      openedBy: 'tampering-test',
    }),
  });
  assert.equal(tamperOpenCash.status, 409, 'an open cash session must not be overwritten through the generic session endpoint');

  const invalidCashClose = await fetch(`${baseUrl}/api/negocios/giovanni/caja/cerrar`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({ closingAmount: -1 }),
  });
  assert.equal(invalidCashClose.status, 400, 'negative physical cash count must be rejected');

  const invalidCashMethod = await fetch(`${baseUrl}/api/negocios/giovanni/caja/movimientos`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({ type: 'ingreso', amount: 100, method: 'inventado', description: 'invalid method test' }),
  });
  assert.equal(invalidCashMethod.status, 400, 'unsupported cash movement payment methods must be rejected');

  const duplicateOpenCash = await fetch(`${baseUrl}/api/negocios/giovanni/caja/sesion`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({ id: 'smoke-second-session', status: 'abierta', openingAmount: 10 }),
  });
  assert.equal(duplicateOpenCash.status, 409, 'a tenant must not have two open cash sessions');

  const pinResponse = await fetch(`${baseUrl}/api/auth/pin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '246810', negocioId: 'superadmin' }),
  });
  assert.equal(pinResponse.status, 200, 'configured SuperAdmin PIN must log in');
  assert.equal((await pinResponse.json()).user?.rol, 'superadmin');

  // Turnos fijos: validar fechas reales, crear una recurrencia y rechazar solapamientos.
  const spaceResponse = await fetch(`${baseUrl}/api/negocios/giovanni/espacios`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({
      name: 'Smoke fixed-turn space',
      type: 'futbol',
      precioHora: 10000,
      precioDia: 10000,
      isActive: true,
    }),
  });
  assert.equal(spaceResponse.status, 201, 'tenant must create a space for fixed-turn tests');
  const smokeSpace = await spaceResponse.json();

  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const end = new Date(now);
  end.setDate(end.getDate() + 28);
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  const dayOfWeek = now.getDay();
  const fixedTurnPayload = {
    espacioId: smokeSpace.id,
    clientName: 'Smoke fixed client',
    dayOfWeek,
    startDate,
    endDate,
    startTime: '10:00',
    endTime: '11:00',
    amount: 12000,
    notes: 'CI test',
  };
  const invalidFixedTurn = await fetch(`${baseUrl}/api/negocios/giovanni/turnos-fijos`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({ ...fixedTurnPayload, startDate: '2026-02-30' }),
  });
  assert.equal(invalidFixedTurn.status, 400, 'impossible calendar dates must be rejected');

  const fixedTurnResponse = await fetch(`${baseUrl}/api/negocios/giovanni/turnos-fijos`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify(fixedTurnPayload),
  });
  assert.equal(fixedTurnResponse.status, 201, 'valid recurring fixed turn must be created');

  const overlappingFixedTurn = await fetch(`${baseUrl}/api/negocios/giovanni/turnos-fijos`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({ ...fixedTurnPayload, clientName: 'Smoke overlapping client' }),
  });
  assert.equal(overlappingFixedTurn.status, 409, 'overlapping recurring fixed turns must be rejected');

  // Finalizar una reserva solo actualiza su estado; WhatsApp se abre desde el navegador y requiere envío manual.
  const reservationResponse = await fetch(`${baseUrl}/api/negocios/giovanni/reservas`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({
      espacioId: smokeSpace.id,
      clientName: 'Smoke WhatsApp Client',
      clientPhone: '3855111222',
      date: '2099-01-02',
      startTime: '03:15',
      endTime: '03:45',
      amount: 12000,
      paidAmount: 2000,
      paymentStatus: 'senado',
      paymentMethod: 'efectivo',
      personas: 4,
      notes: 'Datos de prueba para notificación',
    }),
  });
  assert.equal(reservationResponse.status, 201, 'test reservation must be created');
  const smokeReservation = await reservationResponse.json();

  const completeReservationResponse = await fetch(`${baseUrl}/api/negocios/giovanni/reservas/${encodeURIComponent(smokeReservation.id)}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${tenantLogin.token}`,
      'content-type': 'application/json',
      'x-negocio-id': 'giovanni',
    },
    body: JSON.stringify({ estado: 'completada' }),
  });
  assert.equal(completeReservationResponse.status, 200, 'reservation must be completed');
  const completedReservation = await completeReservationResponse.json();
  assert.equal(completedReservation.estado, 'completada');
  assert.equal(completedReservation.notificacionWhatsApp, undefined, 'completing a reservation must not send or queue an automatic WhatsApp message');


  console.log('API smoke tests passed: auth, tenant isolation, public menu/orders, idempotent kitchen dispatch, password leak protection, cash sessions, fixed turns, and manual reservation completion.');
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(resolve, 2000);
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
}
