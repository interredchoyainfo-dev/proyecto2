import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import db from './db.js';
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  authenticate,
  authorizeTenant,
} from './auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Comparación de credenciales sin filtrar diferencias por tiempo de ejecución.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// CORS con lista explícita de orígenes. En producción, definir CORS_ORIGINS
// con el dominio exacto del frontend (separado por comas).
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Las llamadas sin Origin (p. ej. health checks internos o clientes nativos)
      // no dependen de CORS; los navegadores solo reciben permiso para la lista explícita.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));

// Helper para extraer el tenant. La ruta canónica tiene prioridad sobre
// cabeceras/parámetros del cliente, que nunca pueden cambiar el negocio de la URL.
export function resolveTenantId(req) {
  const originalPath = new URL(req.originalUrl || req.url || '/', 'http://localhost').pathname;
  const pathMatch = originalPath.match(/^\/api\/negocios\/([^/]+)/i);
  const tenantId =
    req.authorizedTenantId ||
    req.params?.negocioId ||
    pathMatch?.[1] ||
    req.headers['x-negocio-id'] ||
    req.query?.negocioId;

  const clean = String(tenantId || 'giovanni').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  return clean || 'giovanni';
}

// Middleware para setear req.tenantId
app.use((req, res, next) => {
  req.tenantId = resolveTenantId(req);
  next();
});

// Middleware opcional para verificar token si existe sin bloquear endpoints públicos
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      req.user = verifyToken(token);
    } catch {}
  }
  next();
}
app.use(optionalAuth);

// ==========================================
// 1. AUTENTICACIÓN REAL (/api/auth)
// ==========================================

// Limitar intentos de autenticación para reducir ataques de fuerza bruta.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_ATTEMPTS', message: 'Demasiados intentos. Esperá 15 minutos y volvé a intentar.' },
});
const pinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_PIN_ATTEMPTS', message: 'Demasiados intentos de PIN. Esperá 15 minutos y volvé a intentar.' },
});

// Login con Usuario y Contraseña
app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const { email, username, password, negocioId } = req.body;
  const userIdentifier = (email || username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const targetTenant = (negocioId || '').trim().toLowerCase();

  if (!userIdentifier || !cleanPass) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_CREDENTIALS',
      message: 'Usuario y contraseña requeridos.',
    });
  }

  // SuperAdmin: solo se autentica con credenciales privadas del servidor.
  // La ruta sin negocio corresponde al propietario; no hay claves maestras en el código.
  if (!targetTenant) {
    const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const ownerPassword = process.env.OWNER_PASSWORD || '';

    if (!ownerEmail || !ownerPassword) {
      return res.status(503).json({
        success: false,
        code: 'OWNER_AUTH_NOT_CONFIGURED',
        message: 'El acceso SuperAdmin no está configurado en el servidor.',
      });
    }

    if (!safeEqual(userIdentifier, ownerEmail) || !safeEqual(cleanPass, ownerPassword)) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Usuario o contraseña incorrectos.',
      });
    }

    const token = createToken({
      id: 'u-superadmin',
      email: ownerEmail,
      nombre: 'Super Administrador',
      rol: 'superadmin',
      negocioId: null,
    });
    return res.json({
      success: true,
      token,
      user: {
        id: 'u-superadmin',
        email: ownerEmail,
        nombre: 'Super Administrador',
        rol: 'superadmin',
        role: 'superadmin',
        negocioId: null,
      },
    });
  }

  // 2. Buscar usuario en base de datos para el negocio
  let userRow;
  if (targetTenant) {
    userRow = db.prepare(`
      SELECT * FROM usuarios
      WHERE (LOWER(email) = ? OR LOWER(nombre) = ?)
        AND LOWER(negocioId) = ?
        AND isActive = 1
    `).get(userIdentifier, userIdentifier, targetTenant);
  } else {
    // Si no especificó tenant, busca coincidencia
    userRow = db.prepare(`
      SELECT * FROM usuarios
      WHERE (LOWER(email) = ? OR LOWER(nombre) = ?)
        AND isActive = 1
    `).get(userIdentifier, userIdentifier);
  }

  if (!userRow || !verifyPassword(cleanPass, userRow.passwordHash)) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Usuario o contraseña incorrectos.',
    });
  }

  const token = createToken({
    id: userRow.id,
    email: userRow.email,
    nombre: userRow.nombre,
    rol: userRow.rol,
    role: userRow.rol,
    negocioId: userRow.negocioId,
  });

  return res.json({
    success: true,
    token,
    user: {
      id: userRow.id,
      email: userRow.email,
      nombre: userRow.nombre,
      rol: userRow.rol,
      role: userRow.rol,
      negocioId: userRow.negocioId,
    },
  });
});

// Login con PIN (para Mozos, Cocina, etc.)
app.post('/api/auth/pin', pinRateLimit, (req, res) => {
  const { pin, negocioId } = req.body;
  const cleanPin = (pin || '').trim();
  const targetTenant = (negocioId || req.tenantId || 'giovanni').trim().toLowerCase();

  if (!cleanPin) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_PIN',
      message: 'PIN requerido.',
    });
  }

  // El PIN de propietario solo se acepta en el ámbito explícito SuperAdmin.
  if (targetTenant === 'superadmin') {
    const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const ownerPin = process.env.OWNER_PIN || '';
    if (!ownerEmail || !ownerPin) {
      return res.status(503).json({
        success: false,
        code: 'OWNER_PIN_NOT_CONFIGURED',
        message: 'El PIN de SuperAdmin no está configurado en el servidor.',
      });
    }
    if (!safeEqual(cleanPin, ownerPin)) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_PIN',
        message: 'PIN de acceso incorrecto.',
      });
    }
    const token = createToken({
      id: 'u-superadmin',
      email: ownerEmail,
      nombre: 'Super Administrador',
      rol: 'superadmin',
      negocioId: null,
    });
    return res.json({
      success: true,
      token,
      user: {
        id: 'u-superadmin',
        email: ownerEmail,
        nombre: 'Super Administrador',
        rol: 'superadmin',
        role: 'superadmin',
        negocioId: null,
      },
    });
  }

  const users = db.prepare(`
    SELECT * FROM usuarios
    WHERE LOWER(negocioId) = ? AND isActive = 1
  `).all(targetTenant);

  const matched = users.find((u) => verifyPassword(cleanPin, u.pinHash));
  if (!matched) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_PIN',
      message: 'PIN de acceso incorrecto.',
    });
  }

  const token = createToken({
    id: matched.id,
    email: matched.email,
    nombre: matched.nombre,
    rol: matched.rol,
    negocioId: matched.negocioId,
  });

  return res.json({
    success: true,
    token,
    user: {
      id: matched.id,
      email: matched.email,
      nombre: matched.nombre,
      rol: matched.rol,
      negocioId: matched.negocioId,
    },
  });
});

// Obtener perfil actual
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ==========================================
// 2. GESTIÓN DE TENANTS / SAAS (/api/tenants)
// ==========================================

// Todas las operaciones de administración de negocios requieren una sesión SuperAdmin válida.
app.use('/api/tenants', authenticate, (req, res, next) => {
  if (req.user?.rol !== 'superadmin') {
    return res.status(403).json({
      success: false,
      code: 'SUPERADMIN_REQUIRED',
      message: 'Se requiere una sesión SuperAdmin para administrar negocios.',
    });
  }
  next();
});

app.get('/api/tenants', (req, res) => {
  const rows = db.prepare('SELECT * FROM negocios ORDER BY nombre').all();
  const mapped = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    logoUrl: r.logoUrl,
    subtitulo: r.subtitulo || 'TU LUGAR DEPORTIVO',
    descripcion: r.descripcion || '',
    whatsapp: r.whatsapp || '',
    plan: r.plan || 'trial',
    isActive: !!r.isActive,
    adminUser: r.adminUser || 'admin',
    theme: r.themeJson ? JSON.parse(r.themeJson) : undefined,
    modulos: r.modulosJson ? JSON.parse(r.modulosJson) : {},
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  res.json({ ok: true, tenants: mapped, count: mapped.length });
});

app.get('/api/tenants/:id', (req, res) => {
  const target = req.params.id.toLowerCase();
  const r = db.prepare('SELECT * FROM negocios WHERE LOWER(id) = ? OR LOWER(slug) = ?').get(target, target);
  if (!r) {
    return res.status(404).json({ success: false, code: 'TENANT_NOT_FOUND', message: 'Negocio no encontrado' });
  }
  res.json({
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    logoUrl: r.logoUrl,
    subtitulo: r.subtitulo || 'TU LUGAR DEPORTIVO',
    descripcion: r.descripcion || '',
    whatsapp: r.whatsapp || '',
    plan: r.plan || 'trial',
    isActive: !!r.isActive,
    adminUser: r.adminUser || 'admin',
    theme: r.themeJson ? JSON.parse(r.themeJson) : undefined,
    modulos: r.modulosJson ? JSON.parse(r.modulosJson) : {},
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });
});

app.post('/api/tenants', (req, res) => {
  const b = req.body;
  const slug = (b.slug || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  if (!slug || !b.nombre) {
    return res.status(400).json({ success: false, message: 'Slug y nombre son obligatorios.' });
  }

  const existing = db.prepare('SELECT id FROM negocios WHERE slug = ?').get(slug);
  if (existing) {
    return res.status(409).json({ success: false, message: 'El slug ya está registrado.' });
  }

  const id = b.id || slug;
  const now = new Date().toISOString();
  const theme = JSON.stringify(b.theme || { primaryColor: '#10b981' });
  const modulos = JSON.stringify(b.modulos || {
    bar: true,
    reservas: true,
    cocina: true,
    caja: true,
    inventario: true,
    delivery: true,
    mozos: true,
    torneos: true,
  });

  const adminUser = (b.email || b.adminUser || `admin_${slug}`).toLowerCase().trim();
  const adminPass = b.password || b.adminPassword || `${slug}123`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO negocios (id, slug, nombre, subtitulo, descripcion, whatsapp, plan, themeJson, modulosJson, adminUser, adminPassword, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, slug, b.nombre, b.subtitulo || 'TU LUGAR DEPORTIVO', b.descripcion || '', b.whatsapp || '', b.plan || 'trial', theme, modulos, adminUser, adminPass, now, now);

    // Usuario administrador
    db.prepare(`
      INSERT INTO usuarios (id, negocioId, email, nombre, passwordHash, pinHash, rol, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'admin', 1, ?, ?)
    `).run(`u-admin-${id}`, id, adminUser, `Administrador de ${b.nombre}`, hashPassword(adminPass), hashPassword('1234'), now, now);
  });

  tx();
  const created = db.prepare('SELECT * FROM negocios WHERE id = ?').get(id);
  // Nunca devolver columnas internas que puedan contener credenciales.
  res.status(201).json({
    success: true,
    tenant: {
      id: created.id,
      slug: created.slug,
      nombre: created.nombre,
      logoUrl: created.logoUrl,
      subtitulo: created.subtitulo,
      descripcion: created.descripcion,
      whatsapp: created.whatsapp,
      plan: created.plan,
      isActive: !!created.isActive,
      adminUser: created.adminUser,
      theme: created.themeJson ? JSON.parse(created.themeJson) : undefined,
      modulos: created.modulosJson ? JSON.parse(created.modulosJson) : {},
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    },
    message: `Negocio "${b.nombre}" creado exitosamente.`,
  });
});

app.put('/api/tenants/:id', (req, res) => {
  const target = req.params.id.toLowerCase();
  const cur = db.prepare('SELECT * FROM negocios WHERE LOWER(id) = ? OR LOWER(slug) = ?').get(target, target);
  if (!cur) return res.status(404).json({ success: false, message: 'Negocio no encontrado' });

  const b = req.body;
  const now = new Date().toISOString();
  const theme = b.theme ? JSON.stringify(b.theme) : cur.themeJson;
  const modulos = b.modulos ? JSON.stringify(b.modulos) : cur.modulosJson;

  db.prepare(`
    UPDATE negocios SET
      nombre = ?, subtitulo = ?, descripcion = ?, whatsapp = ?, plan = ?,
      themeJson = ?, modulosJson = ?, adminUser = ?, adminPassword = ?,
      isActive = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    b.nombre ?? cur.nombre,
    b.subtitulo ?? cur.subtitulo,
    b.descripcion ?? cur.descripcion,
    b.whatsapp ?? cur.whatsapp,
    b.plan ?? cur.plan,
    theme,
    modulos,
    b.adminUser ?? cur.adminUser,
    b.adminPassword ?? cur.adminPassword,
    b.isActive !== undefined ? (b.isActive ? 1 : 0) : cur.isActive,
    now,
    cur.id
  );

  res.json({ success: true, message: 'Negocio actualizado correctamente.' });
});

app.delete('/api/tenants/:id', (req, res) => {
  const target = req.params.id.toLowerCase();
  if (target === 'giovanni') {
    return res.status(400).json({ success: false, message: 'El negocio base giovanni no puede eliminarse.' });
  }

  const cur = db.prepare('SELECT id FROM negocios WHERE LOWER(id) = ? OR LOWER(slug) = ?').get(target, target);
  if (!cur) return res.status(404).json({ success: false, message: 'Negocio no encontrado.' });

  const delTx = db.transaction(() => {
    db.prepare('DELETE FROM usuarios WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM espacios WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM reservas WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM productos WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM mesas WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM clientes WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM pedidos WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM ofertas WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM caja_movimientos WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM caja_sesiones WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM pagos WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM negocios WHERE id = ?').run(cur.id);
  });

  delTx();
  res.json({ success: true, message: 'Negocio eliminado permanentemente.' });
});

// Reiniciar reservas, ventas y caja a 0 para entrega limpia
app.post('/api/tenants/:id/reset', (req, res) => {
  const target = req.params.id.toLowerCase();
  const cur = db.prepare('SELECT id, nombre FROM negocios WHERE LOWER(id) = ? OR LOWER(slug) = ?').get(target, target);
  if (!cur) return res.status(404).json({ success: false, message: 'Negocio no encontrado.' });

  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM reservas WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM pedidos WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM caja_movimientos WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM caja_sesiones WHERE negocioId = ?').run(cur.id);
    db.prepare('DELETE FROM pagos WHERE negocioId = ?').run(cur.id);
    // Reiniciar estado operativo de espacios a libre
    db.prepare("UPDATE espacios SET status = 'libre', currentReservationId = NULL WHERE negocioId = ?").run(cur.id);
    // Reiniciar mesas a libre
    db.prepare("UPDATE mesas SET estado = 'libre' WHERE negocioId = ?").run(cur.id);
  });

  resetTx();
  res.json({ success: true, message: `Datos de "${cur.nombre}" reiniciados a 0 exitosamente.` });
});

// Inicializar base o confirmar configuración de tenant
app.post('/api/tenants/:id/init', (req, res) => {
  const target = req.params.id.toLowerCase();
  const cur = db.prepare('SELECT id, nombre FROM negocios WHERE LOWER(id) = ? OR LOWER(slug) = ?').get(target, target);
  res.json({
    ok: true,
    tenantId: cur?.id || target,
    message: `Tenant "${cur?.nombre || target}" inicializado correctamente.`,
  });
});

// Todas las API operativas requieren sesión y autorización del negocio.
// Se excluyen autenticación, administración de tenants (ya protegida arriba) y health check.
app.use('/api', (req, res, next) => {
  // Comprobar las rutas públicas antes de autenticar. Express puede exponer
  // req.path relativo al mount; originalUrl conserva la ruta completa.
  const originalPath = new URL(req.originalUrl || req.url || '/', 'http://localhost').pathname;
  if (
    originalPath.startsWith('/api/auth/') ||
    originalPath === '/api/tenants' ||
    originalPath.startsWith('/api/tenants/') ||
    originalPath === '/api/health'
  ) {
    return next();
  }

  authenticate(req, res, () => {
    // Para rutas con negocio en la URL, ese identificador es la fuente de verdad.
    // Para alias antiguos (/api/productos, etc.) exigimos selector explícito.
    const pathMatch = originalPath.match(/^\/api\/negocios\/([^/]+)/i);
    const suppliedTenant = pathMatch?.[1] || req.headers['x-negocio-id'] || req.query.negocioId;
    if (!suppliedTenant || !String(suppliedTenant).trim()) {
      return res.status(400).json({
        success: false,
        code: 'TENANT_REQUIRED',
        message: 'Debés indicar el negocio para esta operación.',
      });
    }

    const requestedTenant = resolveTenantId(req);
    const tenant = db.prepare(
      'SELECT id FROM negocios WHERE LOWER(id) = LOWER(?) OR LOWER(slug) = LOWER(?) LIMIT 1'
    ).get(requestedTenant, requestedTenant);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        code: 'TENANT_NOT_FOUND',
        message: 'El negocio solicitado no existe.',
      });
    }

    try {
      authorizeTenant(req, tenant.id);
      // Desde aquí en adelante, todas las consultas deben usar el ID canónico
      // del negocio, aunque la URL haya usado su slug.
      req.authorizedTenantId = tenant.id;
      req.tenantId = tenant.id;
      next();
    } catch (error) {
      return res.status(error.status || 403).json({
        success: false,
        code: error.code || 'TENANT_FORBIDDEN',
        message: error.message || 'No tenés permiso para operar sobre este negocio.',
      });
    }
  });
});

// ==========================================
// 3. ESPACIOS CRUD (/api/negocios/:negocioId/espacios)
// ==========================================

const rowEspacio = (r) =>
  r && {
    id: r.id,
    negocioId: r.negocioId,
    name: r.name,
    type: r.type,
    status: r.status,
    precioHora: r.precioHora,
    precioDia: r.precioDia ?? r.precioHora ?? 12000,
    precioNoche: r.precioNoche ?? (r.precioHora ? Math.round(r.precioHora * 1.25) : 15000),
    description: r.description || '',
    imageUrl: r.imageUrl || '',
    usaCapacidad: !!r.usaCapacidad,
    capacidad: r.capacidad ?? 15,
    precioPorPersona: !!r.precioPorPersona,
    isActive: !!r.isActive,
    currentReservationId: r.currentReservationId || undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };

app.get(['/api/negocios/:negocioId/espacios', '/api/espacios'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const rows = db.prepare('SELECT * FROM espacios WHERE negocioId = ? ORDER BY name').all(tenantId);
  res.json(rows.map(rowEspacio));
});

app.post(['/api/negocios/:negocioId/espacios', '/api/espacios'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const e = req.body;
  const id = e.id || `esp-${tenantId}-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const nombreEspacio = String(e.name || '').trim();
  if (!nombreEspacio) return res.status(400).json({ success: false, code: 'ESPACIO_NAME_REQUIRED', message: 'El nombre del espacio es obligatorio.' });
  const existenteId = db.prepare('SELECT * FROM espacios WHERE id = ?').get(id);
  if (existenteId) {
    if (String(existenteId.negocioId).toLowerCase() !== String(tenantId).toLowerCase()) return res.status(409).json({ success: false, code: 'ESPACIO_ID_TENANT_CONFLICT', message: 'El identificador pertenece a otro negocio.' });
    return res.status(200).json(rowEspacio(existenteId));
  }
  const duplicado = db.prepare('SELECT * FROM espacios WHERE negocioId = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND LOWER(TRIM(type)) = LOWER(TRIM(?)) LIMIT 1').get(tenantId, nombreEspacio, e.type || 'futbol');
  if (duplicado) return res.status(409).json({ success: false, code: 'ESPACIO_DUPLICATE', message: 'Ya existe un espacio con ese nombre y tipo en este negocio.', espacio: rowEspacio(duplicado) });
  const precioHora = Number(e.precioHora ?? e.precioDia ?? 12000);
  const precioDia = Number(e.precioDia ?? precioHora);
  const precioNoche = Number(e.precioNoche ?? Math.round(precioDia * 1.25));

  db.prepare(`
    INSERT INTO espacios (
      id, negocioId, name, type, status, precioHora, precioDia, precioNoche,
      description, imageUrl, usaCapacidad, capacidad, precioPorPersona, isActive,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    nombreEspacio,
    e.type || 'futbol',
    e.status || 'libre',
    precioHora,
    precioDia,
    precioNoche,
    e.description || '',
    e.imageUrl || '',
    e.usaCapacidad ? 1 : 0,
    Number(e.capacidad || 15),
    e.precioPorPersona ? 1 : 0,
    e.isActive !== false ? 1 : 0,
    now,
    now
  );

  const created = db.prepare('SELECT * FROM espacios WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.status(201).json(rowEspacio(created));
});

app.put(['/api/negocios/:negocioId/espacios/:id', '/api/espacios/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const id = req.params.id;
  const cur = db.prepare('SELECT * FROM espacios WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!cur) return res.status(404).json({ success: false, code: 'ESPACIO_NOT_FOUND', message: 'Espacio no encontrado.' });

  const e = req.body;
  const now = new Date().toISOString();
  const precioHora = e.precioHora !== undefined ? Number(e.precioHora) : cur.precioHora;
  const precioDia = e.precioDia !== undefined ? Number(e.precioDia) : cur.precioDia;
  const precioNoche = e.precioNoche !== undefined ? Number(e.precioNoche) : cur.precioNoche;

  if (![precioHora, precioDia, precioNoche].every((precio) => Number.isFinite(precio) && precio >= 0)) {
    return res.status(400).json({ success: false, code: 'ESPACIO_INVALID_PRICE', message: 'Los precios deben ser números válidos no negativos.' });
  }

  const nuevoNombre = String(e.name ?? cur.name).trim();
  if (!nuevoNombre) return res.status(400).json({ success: false, code: 'ESPACIO_NAME_REQUIRED', message: 'El nombre del espacio es obligatorio.' });
  const nuevoTipo = String(e.type ?? cur.type).trim() || cur.type;
  const duplicado = db.prepare('SELECT id FROM espacios WHERE negocioId = ? AND id != ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND LOWER(TRIM(type)) = LOWER(TRIM(?)) LIMIT 1').get(tenantId, id, nuevoNombre, nuevoTipo);
  if (duplicado) return res.status(409).json({ success: false, code: 'ESPACIO_DUPLICATE', message: 'Ya existe un espacio con ese nombre y tipo en este negocio.' });

  db.prepare(`
    UPDATE espacios SET
      name = ?, type = ?, status = ?, precioHora = ?, precioDia = ?, precioNoche = ?,
      description = ?, imageUrl = ?, usaCapacidad = ?, capacidad = ?, precioPorPersona = ?,
      isActive = ?, currentReservationId = ?, updatedAt = ?
    WHERE id = ? AND negocioId = ?
  `).run(
    nuevoNombre,
    nuevoTipo,
    e.status ?? cur.status,
    precioHora,
    precioDia,
    precioNoche,
    e.description !== undefined ? e.description : cur.description,
    e.imageUrl !== undefined ? e.imageUrl : cur.imageUrl,
    e.usaCapacidad !== undefined ? (e.usaCapacidad ? 1 : 0) : cur.usaCapacidad,
    e.capacidad !== undefined ? Number(e.capacidad) : cur.capacidad,
    e.precioPorPersona !== undefined ? (e.precioPorPersona ? 1 : 0) : cur.precioPorPersona,
    e.isActive !== undefined ? (e.isActive ? 1 : 0) : cur.isActive,
    e.currentReservationId !== undefined ? e.currentReservationId : cur.currentReservationId,
    now,
    id,
    tenantId
  );

  const updated = db.prepare('SELECT * FROM espacios WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.json(rowEspacio(updated));
});

app.delete(['/api/negocios/:negocioId/espacios/:id', '/api/espacios/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const id = req.params.id;
  db.prepare('DELETE FROM espacios WHERE id = ? AND negocioId = ?').run(id, tenantId);
  res.json({ success: true, message: 'Espacio eliminado.' });
});

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTimeRange(startTime, endTime) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) &&
    startTime < endTime;
}

function isReasonableDateRange(startDate, endDate) {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || startDate > endDate) return false;
  const days = (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86400000;
  return days <= 366 * 2;
}

function findFixedTurnConflict(tenantId, espacioId, date, startTime, endTime, excludeId = null) {
  return db.prepare(`
    SELECT id, clientName, startTime, endTime FROM turnos_fijos
    WHERE negocioId = ? AND espacioId = ? AND activo = 1
      AND dayOfWeek = CAST(strftime('%w', ?) AS INTEGER)
      AND startDate <= ? AND endDate >= ?
      AND startTime < ? AND endTime > ?
      AND (? IS NULL OR id <> ?)
    LIMIT 1
  `).get(tenantId, espacioId, date, date, date, endTime, startTime, excludeId, excludeId);
}

// ==========================================
// 4. RESERVAS CON VALIDACIÓN DE SOLAPAMIENTO
// ==========================================

const rowReserva = (r) =>
  r && {
    id: r.id,
    negocioId: r.negocioId,
    espacioId: r.espacioId,
    clientId: r.clientId,
    clientName: r.clientName,
    clientPhone: r.clientPhone || '',
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    paymentStatus: r.paymentStatus || 'pendiente',
    paymentMethod: r.paymentMethod || 'efectivo',
    amount: r.amount ?? 0,
    totalPrice: r.amount ?? 0,
    paidAmount: r.paidAmount ?? (r.senaPagada ?? 0),
    depositAmount: r.paidAmount ?? (r.senaPagada ?? 0),
    senaPagada: r.senaPagada ?? (r.paidAmount ?? 0),
    saldoPendiente: r.saldoPendiente ?? Math.max(0, (r.amount ?? 0) - (r.paidAmount ?? 0)),
    balanceRemaining: r.saldoPendiente ?? Math.max(0, (r.amount ?? 0) - (r.paidAmount ?? 0)),
    personas: r.personas || undefined,
    qrToken: r.qrToken || undefined,
    notes: r.notes || '',
    estado: r.estado || 'confirmada',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };


function normalizeWhatsAppRecipient(value) {
  const digits = String(value || '').replace(/\\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  return digits.startsWith('54') ? digits : `54${digits.replace(/^0+/, '')}`;
}

function formatReservationCompletionMessage({ business, reservation, space, client }) {
  const money = (value) => `${Number(value || 0).toLocaleString('es-AR')}`;
  return [
    `✅ RESERVA FINALIZADA — ${business.nombre || business.id}`,
    `Negocio: ${business.nombre || business.id} (${business.id})`,
    `Reserva: ${reservation.id}`,
    `Estado: ${reservation.estado}`,
    `Cliente: ${client?.name || client?.nombre || reservation.clientName || 'No informado'}`,
    `Teléfono: ${client?.phone || client?.telefono || reservation.clientPhone || 'No informado'}`,
    `Email: ${client?.email || 'No informado'}`,
    `Espacio: ${space?.name || space?.nombre || reservation.espacioId}`,
    `Fecha: ${reservation.date}`,
    `Horario: ${reservation.startTime} a ${reservation.endTime}`,
    `Personas: ${reservation.personas ?? 'No informado'}`,
    `Importe total: ${money(reservation.amount)}`,
    `Pagado / seña: ${money(reservation.paidAmount ?? reservation.senaPagada)}`,
    `Saldo pendiente: ${money(reservation.saldoPendiente ?? Math.max(0, Number(reservation.amount || 0) - Number(reservation.paidAmount ?? reservation.senaPagada ?? 0)))}`,
    `Estado de pago: ${reservation.paymentStatus || 'pendiente'}`,
    `Medio de pago: ${reservation.paymentMethod || 'No informado'}`,
    `Observaciones: ${reservation.notes || 'Sin observaciones'}`,
    `Creada: ${reservation.createdAt || 'No informado'}`,
  ].join('\\n');
}

async function dispatchReservationWhatsApp(notificationId) {
  const item = db.prepare('SELECT * FROM reserva_notificaciones WHERE id = ?').get(notificationId);
  if (!item || item.estado === 'enviada') return item;

  const token = process.env.WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    db.prepare(`
      UPDATE reserva_notificaciones SET estado = 'pendiente_config',
        ultimoError = ?, updatedAt = ? WHERE id = ?
    `).run('Falta configurar WA_ACCESS_TOKEN y WA_PHONE_NUMBER_ID en el servidor.', new Date().toISOString(), notificationId);
    return db.prepare('SELECT * FROM reserva_notificaciones WHERE id = ?').get(notificationId);
  }

  if (!item.destino) {
    db.prepare(`
      UPDATE reserva_notificaciones SET estado = 'sin_destino',
        ultimoError = ?, updatedAt = ? WHERE id = ?
    `).run('El negocio no tiene un número de WhatsApp configurado.', new Date().toISOString(), notificationId);
    return db.prepare('SELECT * FROM reserva_notificaciones WHERE id = ?').get(notificationId);
  }

  const version = process.env.WA_GRAPH_API_VERSION || 'v22.0';
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: item.destino,
        ...(process.env.WA_TEMPLATE_NAME ? {
          type: 'template',
          template: {
            name: process.env.WA_TEMPLATE_NAME,
            language: { code: process.env.WA_TEMPLATE_LANGUAGE || 'es_AR' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: item.mensaje.slice(0, 1024) }] }],
          },
        } : {
          type: 'text',
          text: { preview_url: false, body: item.mensaje },
        }),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = data?.error?.message || `WhatsApp API respondió HTTP ${response.status}`;
      db.prepare(`
        UPDATE reserva_notificaciones SET estado = 'fallida', intentos = intentos + 1,
          ultimoError = ?, updatedAt = ? WHERE id = ?
      `).run(String(reason).slice(0, 1000), new Date().toISOString(), notificationId);
    } else {
      db.prepare(`
        UPDATE reserva_notificaciones SET estado = 'enviada', proveedorMensajeId = ?,
          intentos = intentos + 1, ultimoError = NULL, sentAt = ?, updatedAt = ? WHERE id = ?
      `).run(data?.messages?.[0]?.id || null, new Date().toISOString(), new Date().toISOString(), notificationId);
    }
  } catch (error) {
    db.prepare(`
      UPDATE reserva_notificaciones SET estado = 'fallida', intentos = intentos + 1,
        ultimoError = ?, updatedAt = ? WHERE id = ?
    `).run(String(error?.message || 'Error de conexión con WhatsApp').slice(0, 1000), new Date().toISOString(), notificationId);
  }
  return db.prepare('SELECT * FROM reserva_notificaciones WHERE id = ?').get(notificationId);
}

app.get(['/api/negocios/:negocioId/reservas', '/api/reservas'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const rows = db.prepare('SELECT * FROM reservas WHERE negocioId = ? ORDER BY date, startTime').all(tenantId);
  res.json(rows.map(rowReserva));
});

app.post(['/api/negocios/:negocioId/reservas', '/api/reservas'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const r = req.body;
  const espacioId = r.espacioId || r.courtId;

  if (!espacioId || !r.date || !r.startTime || !r.endTime || !r.clientName) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_FIELDS',
      message: 'Faltan campos obligatorios para la reserva.',
    });
  }

  // 1. Validar que el espacio pertenezca al negocio y esté activo
  const espacio = db.prepare('SELECT * FROM espacios WHERE id = ? AND negocioId = ? AND isActive = 1').get(espacioId, tenantId);
  if (!espacio) {
    return res.status(400).json({
      success: false,
      code: 'ESPACIO_NO_DISPONIBLE',
      message: 'El espacio seleccionado no existe o no está activo en este complejo.',
    });
  }

  // 2. Validar que no haya solapamiento de horario
  const conflict = db.prepare(`
    SELECT id, clientName, startTime, endTime FROM reservas
    WHERE negocioId = ?
      AND espacioId = ?
      AND date = ?
      AND estado <> 'cancelada'
      AND startTime < ?
      AND endTime > ?
    LIMIT 1
  `).get(tenantId, espacioId, r.date, r.endTime, r.startTime);

  if (conflict) {
    return res.status(409).json({
      success: false,
      code: 'HORARIO_NO_DISPONIBLE',
      message: `El espacio ya está reservado de ${conflict.startTime} a ${conflict.endTime} por ${conflict.clientName}.`,
    });
  }

  const fixedConflict = findFixedTurnConflict(tenantId, espacioId, r.date, r.startTime, r.endTime);
  if (fixedConflict) {
    return res.status(409).json({
      success: false,
      code: 'TURNO_FIJO_OCUPADO',
      message: `Ese horario pertenece al turno fijo de ${fixedConflict.clientName} (${fixedConflict.startTime} a ${fixedConflict.endTime}).`,
    });
  }

  // 3. Cálculo de precio real en backend
  const startHour = parseInt(r.startTime.split(':')[0], 10) || 18;
  const endHour = parseInt(r.endTime.split(':')[0], 10) || startHour + 1;
  const durationHours = Math.max(1, endHour - startHour);
  const isNight = startHour >= 20;
  const hourlyRate = isNight ? (espacio.precioNoche || espacio.precioHora || 15000) : (espacio.precioDia || espacio.precioHora || 12000);
  const backendAmount = hourlyRate * durationHours;

  const rawAmount = r.amount ?? r.totalPrice;
  const rawDeposit = r.senaPagada ?? r.paidAmount ?? r.depositAmount ?? 0;
  const amount = Number(rawAmount) > 0 ? Number(rawAmount) : backendAmount;
  const senaPagada = Math.min(amount, Math.max(0, Number(rawDeposit)));
  const saldoPendiente = Math.max(0, amount - senaPagada);

  const id = r.id || `res-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO reservas (
      id, negocioId, espacioId, clientId, clientName, clientPhone, date, startTime, endTime,
      paymentStatus, paymentMethod, amount, paidAmount, senaPagada, saldoPendiente,
      personas, qrToken, notes, estado, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    espacioId,
    r.clientId || null,
    r.clientName.trim(),
    r.clientPhone || '',
    r.date,
    r.startTime,
    r.endTime,
    r.paymentStatus || (senaPagada >= amount ? 'pagado' : senaPagada > 0 ? 'senado' : 'pendiente'),
    r.paymentMethod || 'efectivo',
    amount,
    senaPagada,
    senaPagada,
    saldoPendiente,
    r.personas ? Number(r.personas) : null,
    r.qrToken || crypto.randomUUID().slice(0, 10),
    r.notes || '',
    r.estado || 'confirmada',
    now,
    now
  );

  const created = db.prepare('SELECT * FROM reservas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.status(201).json(rowReserva(created));
});

app.put(['/api/negocios/:negocioId/reservas/:id', '/api/reservas/:id'], async (req, res) => {
  const tenantId = resolveTenantId(req);
  const id = req.params.id;
  const cur = db.prepare('SELECT * FROM reservas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!cur) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Reserva no encontrada.' });

  const r = req.body;
  const nextSpaceId = r.espacioId || cur.espacioId;
  const nextDate = r.date ?? cur.date;
  const nextStart = r.startTime ?? cur.startTime;
  const nextEnd = r.endTime ?? cur.endTime;
  if (nextStart >= nextEnd) {
    return res.status(400).json({ success: false, code: 'INVALID_TIME_RANGE', message: 'La hora de fin debe ser posterior a la hora de inicio.' });
  }
  const overlap = db.prepare(`
    SELECT id, clientName, startTime, endTime FROM reservas
    WHERE negocioId = ? AND espacioId = ? AND date = ? AND estado <> 'cancelada'
      AND id <> ? AND startTime < ? AND endTime > ? LIMIT 1
  `).get(tenantId, nextSpaceId, nextDate, id, nextEnd, nextStart);
  if (overlap) {
    return res.status(409).json({ success: false, code: 'HORARIO_NO_DISPONIBLE', message: `El espacio ya está reservado de ${overlap.startTime} a ${overlap.endTime} por ${overlap.clientName}.` });
  }
  const fixedConflict = findFixedTurnConflict(tenantId, nextSpaceId, nextDate, nextStart, nextEnd);
  if (fixedConflict) {
    return res.status(409).json({ success: false, code: 'TURNO_FIJO_OCUPADO', message: `Ese horario pertenece al turno fijo de ${fixedConflict.clientName} (${fixedConflict.startTime} a ${fixedConflict.endTime}).` });
  }
  const now = new Date().toISOString();
  const amount = r.amount !== undefined ? Number(r.amount) : cur.amount;
  const sena = r.senaPagada !== undefined ? Number(r.senaPagada) : cur.senaPagada;
  const saldo = Math.max(0, amount - sena);

  db.prepare(`
    UPDATE reservas SET
      clientName = ?, clientPhone = ?, espacioId = ?, date = ?, startTime = ?, endTime = ?,
      paymentStatus = ?, paymentMethod = ?, amount = ?, paidAmount = ?,
      senaPagada = ?, saldoPendiente = ?, personas = ?, notes = ?, estado = ?,
      updatedAt = ?
    WHERE id = ? AND negocioId = ?
  `).run(
    r.clientName ?? cur.clientName,
    r.clientPhone ?? cur.clientPhone,
    nextSpaceId,
    nextDate,
    nextStart,
    nextEnd,
    r.paymentStatus ?? cur.paymentStatus,
    r.paymentMethod ?? cur.paymentMethod,
    amount,
    sena,
    sena,
    saldo,
    r.personas !== undefined ? r.personas : cur.personas,
    r.notes !== undefined ? r.notes : cur.notes,
    r.estado ?? cur.estado,
    now,
    id,
    tenantId
  );

  const updated = db.prepare('SELECT * FROM reservas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  let notification = null;

  // Crear un único aviso cuando el estado cambia por primera vez a completada.
  if (updated.estado === 'completada') {
    const business = db.prepare('SELECT id, nombre, whatsapp FROM negocios WHERE id = ?').get(tenantId);
    const space = db.prepare('SELECT name FROM espacios WHERE id = ? AND negocioId = ?').get(updated.espacioId, tenantId);
    const client = updated.clientId
      ? db.prepare('SELECT * FROM clientes WHERE id = ? AND negocioId = ?').get(updated.clientId, tenantId)
      : null;
    const destination = normalizeWhatsAppRecipient(business?.whatsapp);
    const message = formatReservationCompletionMessage({ business: business || { id: tenantId }, reservation: updated, space, client });
    const eventKey = `${tenantId}:${id}:completada`;
    const existingNotice = db.prepare('SELECT * FROM reserva_notificaciones WHERE eventKey = ?').get(eventKey);
    if (!existingNotice) {
      const notificationId = `wa-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO reserva_notificaciones
          (id, negocioId, reservaId, eventKey, destino, mensaje, estado, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        notificationId, tenantId, id, eventKey, destination, message,
        destination ? 'pendiente' : 'sin_destino', now, now
      );
      notification = await dispatchReservationWhatsApp(notificationId);
    } else {
      // Un aviso fallido o pendiente de configuración se puede reintentar cuando
      // se vuelva a guardar la reserva después de configurar WhatsApp.
      notification = ['enviada', 'sin_destino'].includes(existingNotice.estado)
        ? existingNotice
        : await dispatchReservationWhatsApp(existingNotice.id);
    }
  }

  res.json({ ...rowReserva(updated), notificacionWhatsApp: notification ? {
    estado: notification.estado,
    destino: notification.destino,
    error: notification.ultimoError || null,
    enviadoEn: notification.sentAt || null,
  } : undefined });
});

app.post(['/api/negocios/:negocioId/reservas/:id/notificacion-whatsapp/reintentar', '/api/reservas/:id/notificacion-whatsapp/reintentar'], async (req, res) => {
  const tenantId = resolveTenantId(req);
  const reservation = db.prepare('SELECT id, estado FROM reservas WHERE id = ? AND negocioId = ?').get(req.params.id, tenantId);
  if (!reservation) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Reserva no encontrada.' });
  if (reservation.estado !== 'completada') {
    return res.status(409).json({ success: false, code: 'RESERVA_NO_FINALIZADA', message: 'Solo se puede enviar el aviso de una reserva finalizada.' });
  }
  const eventKey = `${tenantId}:${reservation.id}:completada`;
  const notice = db.prepare('SELECT * FROM reserva_notificaciones WHERE eventKey = ? AND negocioId = ?').get(eventKey, tenantId);
  if (!notice) return res.status(404).json({ success: false, code: 'NOTIFICATION_NOT_FOUND', message: 'No hay aviso registrado para esta reserva.' });
  const result = await dispatchReservationWhatsApp(notice.id);
  res.json({
    success: result.estado === 'enviada',
    notificacionWhatsApp: {
      estado: result.estado,
      destino: result.destino,
      error: result.ultimoError || null,
      enviadoEn: result.sentAt || null,
    },
  });
});

app.delete(['/api/negocios/:negocioId/reservas/:id', '/api/reservas/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const id = req.params.id;
  db.prepare('DELETE FROM reservas WHERE id = ? AND negocioId = ?').run(id, tenantId);
  res.json({ success: true, message: 'Reserva eliminada.' });
});

app.get(['/api/negocios/:negocioId/turnos-fijos', '/api/turnos-fijos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const rows = db.prepare('SELECT * FROM turnos_fijos WHERE negocioId = ? ORDER BY dayOfWeek, startTime').all(tenantId);
  res.json(rows.map(t => ({ ...t, activo: Boolean(t.activo) })));
});

app.post(['/api/negocios/:negocioId/turnos-fijos', '/api/turnos-fijos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const t = req.body || {};
  const espacioId = String(t.espacioId || '');
  const clientName = String(t.clientName || '').trim();
  const dayOfWeek = Number(t.dayOfWeek);
  const startDate = String(t.startDate || '');
  const endDate = String(t.endDate || '');
  const startTime = String(t.startTime || '');
  const endTime = String(t.endTime || '');
  const amount = t.amount === undefined || t.amount === '' ? 0 : Number(t.amount);
  if (!espacioId || !clientName || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 ||
      !isReasonableDateRange(startDate, endDate) || !isValidTimeRange(startTime, endTime) ||
      !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ success: false, code: 'INVALID_FIXED_TURN', message: 'Revisá cliente, día, fechas válidas (máximo 2 años), horario y precio no negativo.' });
  }
  const space = db.prepare('SELECT id FROM espacios WHERE id = ? AND negocioId = ? AND isActive = 1').get(espacioId, tenantId);
  if (!space) return res.status(400).json({ success: false, code: 'ESPACIO_NO_DISPONIBLE', message: 'El espacio no existe o está inactivo.' });

  // Validar todas las ocurrencias semanales contra reservas ya cargadas.
  const occurrence = new Date(`${startDate}T12:00:00`);
  const last = new Date(`${endDate}T12:00:00`);
  while (occurrence.getDay() !== dayOfWeek && occurrence <= last) occurrence.setDate(occurrence.getDate() + 1);
  for (let d = new Date(occurrence); d <= last; d.setDate(d.getDate() + 7)) {
    const date = d.toISOString().slice(0, 10);
    const booked = db.prepare(`
      SELECT clientName, startTime, endTime FROM reservas
      WHERE negocioId = ? AND espacioId = ? AND date = ? AND estado <> 'cancelada'
        AND startTime < ? AND endTime > ? LIMIT 1
    `).get(tenantId, espacioId, date, endTime, startTime);
    if (booked) return res.status(409).json({ success: false, code: 'FIXED_TURN_CONFLICT', message: `No se puede fijar el turno: el ${date} ya existe una reserva de ${booked.startTime} a ${booked.endTime}.` });
    const fixed = findFixedTurnConflict(tenantId, espacioId, date, startTime, endTime);
    if (fixed) return res.status(409).json({ success: false, code: 'FIXED_TURN_CONFLICT', message: `Se cruza con el turno fijo de ${fixed.clientName} de ${fixed.startTime} a ${fixed.endTime}.` });
  }

  const id = t.id || `tf-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO turnos_fijos (id, negocioId, espacioId, clientName, clientPhone, dayOfWeek, startDate, endDate, startTime, endTime, amount, notes, activo, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
      id, tenantId, espacioId, clientName, String(t.clientPhone || ''), dayOfWeek, startDate, endDate,
      startTime, endTime, amount, String(t.notes || ''), now, now
    );
  res.status(201).json(db.prepare('SELECT * FROM turnos_fijos WHERE id = ? AND negocioId = ?').get(id, tenantId));
});

app.put(['/api/negocios/:negocioId/turnos-fijos/:id', '/api/turnos-fijos/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const id = req.params.id;
  const cur = db.prepare('SELECT * FROM turnos_fijos WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!cur) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Turno fijo no encontrado.' });
  const t = req.body || {};
  const active = t.activo !== undefined ? (t.activo ? 1 : 0) : cur.activo;
  const clientName = String(t.clientName ?? cur.clientName).trim();
  const startDate = String(t.startDate ?? cur.startDate);
  const endDate = String(t.endDate ?? cur.endDate);
  const startTime = String(t.startTime ?? cur.startTime);
  const endTime = String(t.endTime ?? cur.endTime);
  const dayOfWeek = Number(t.dayOfWeek ?? cur.dayOfWeek);
  const amount = t.amount !== undefined ? Number(t.amount) : cur.amount;
  const espacioId = String(t.espacioId ?? cur.espacioId);
  if (!clientName || dayOfWeek < 0 || dayOfWeek > 6 || !Number.isInteger(dayOfWeek) ||
      !isReasonableDateRange(startDate, endDate) || !isValidTimeRange(startTime, endTime) ||
      !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ success: false, code: 'INVALID_FIXED_TURN', message: 'Datos inválidos: revisá cliente, día, fechas, horario y precio.' });
  }
  const space = db.prepare('SELECT id FROM espacios WHERE id = ? AND negocioId = ? AND isActive = 1').get(espacioId, tenantId);
  if (!space) return res.status(400).json({ success: false, code: 'ESPACIO_NO_DISPONIBLE', message: 'El espacio no existe o está inactivo.' });

  if (active) {
    const occurrence = new Date(`${startDate}T12:00:00.000Z`);
    const last = new Date(`${endDate}T12:00:00.000Z`);
    while (occurrence.getUTCDay() !== dayOfWeek && occurrence <= last) occurrence.setUTCDate(occurrence.getUTCDate() + 1);
    for (let d = new Date(occurrence); d <= last; d.setUTCDate(d.getUTCDate() + 7)) {
      const date = d.toISOString().slice(0, 10);
      const booked = db.prepare(`SELECT clientName, startTime, endTime FROM reservas
        WHERE negocioId = ? AND espacioId = ? AND date = ? AND estado <> 'cancelada'
          AND startTime < ? AND endTime > ? LIMIT 1`).get(tenantId, espacioId, date, endTime, startTime);
      if (booked) return res.status(409).json({ success: false, code: 'FIXED_TURN_CONFLICT', message: `El ${date} ya existe una reserva de ${booked.startTime} a ${booked.endTime}.` });
      const fixed = findFixedTurnConflict(tenantId, espacioId, date, startTime, endTime, id);
      if (fixed) return res.status(409).json({ success: false, code: 'FIXED_TURN_CONFLICT', message: `Se cruza con el turno fijo de ${fixed.clientName} de ${fixed.startTime} a ${fixed.endTime}.` });
    }
  }

  db.prepare(`UPDATE turnos_fijos SET espacioId = ?, clientName = ?, clientPhone = ?, dayOfWeek = ?, startDate = ?, endDate = ?, startTime = ?, endTime = ?, amount = ?, notes = ?, activo = ?, updatedAt = ? WHERE id = ? AND negocioId = ?`)
    .run(espacioId, clientName, String(t.clientPhone ?? cur.clientPhone), dayOfWeek, startDate, endDate, startTime, endTime,
      amount, String(t.notes ?? cur.notes), active, new Date().toISOString(), id, tenantId);
  res.json(db.prepare('SELECT * FROM turnos_fijos WHERE id = ? AND negocioId = ?').get(id, tenantId));
});

app.delete(['/api/negocios/:negocioId/turnos-fijos/:id', '/api/turnos-fijos/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  db.prepare('DELETE FROM turnos_fijos WHERE id = ? AND negocioId = ?').run(req.params.id, tenantId);
  res.json({ success: true });
});

// ==========================================
// 5. CAJA POR NEGOCIO & ARQUEO SEPARADO
// ==========================================

// Sesión activa de caja
app.get(['/api/negocios/:negocioId/caja/sesion', '/api/caja/sesion'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const session = db.prepare(`
    SELECT * FROM caja_sesiones
    WHERE negocioId = ? AND status = 'abierta'
    LIMIT 1
  `).get(tenantId);
  res.json(session || { status: 'cerrada' });
});

app.put(['/api/negocios/:negocioId/caja/sesion', '/api/caja/sesion'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const s = req.body || {};
  const now = new Date().toISOString();
  const id = String(s.id || '').trim();
  const status = s.status || 'abierta';
  const openingAmount = Number(s.openingAmount ?? 0);

  if (!id || !['abierta', 'cerrada'].includes(status)) {
    return res.status(400).json({ success: false, code: 'INVALID_CASH_SESSION', message: 'Sesión o estado de caja inválido.' });
  }
  if (!Number.isFinite(openingAmount) || openingAmount < 0) {
    return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'El monto de apertura debe ser un número válido no negativo.' });
  }

  const existing = db.prepare('SELECT * FROM caja_sesiones WHERE id = ?').get(id);
  if (existing && String(existing.negocioId).toLowerCase() !== tenantId.toLowerCase()) {
    return res.status(409).json({ success: false, code: 'CASH_SESSION_TENANT_CONFLICT', message: 'La sesión de caja pertenece a otro negocio.' });
  }

  // La sesión se crea una sola vez. No se permite reabrir una caja cerrada
  // ni cambiar sus datos contables mediante una actualización genérica.
  if (!existing) {
    if (status !== 'abierta') {
      return res.status(400).json({ success: false, code: 'INVALID_CASH_SESSION_TRANSITION', message: 'Una sesión nueva debe abrirse antes de cerrarse.' });
    }
    const active = db.prepare("SELECT id FROM caja_sesiones WHERE negocioId = ? AND status = 'abierta' LIMIT 1").get(tenantId);
    if (active) {
      return res.status(409).json({ success: false, code: 'CAJA_YA_ABIERTA', message: 'Ya existe una caja abierta para este negocio.' });
    }
    db.prepare(`
      INSERT INTO caja_sesiones (id, negocioId, status, openedAt, openingAmount, openedBy, totalVentas, totalIngresos, totalEgresos, createdAt, updatedAt)
      VALUES (?, ?, 'abierta', ?, ?, ?, 0, 0, 0, ?, ?)
    `).run(id, tenantId, s.openedAt || now, openingAmount, req.user?.nombre || String(s.openedBy || 'Administrador').slice(0, 120), now, now);
    return res.status(200).json(db.prepare('SELECT * FROM caja_sesiones WHERE id = ? AND negocioId = ?').get(id, tenantId));
  }

  if (existing.status !== 'abierta') {
    return res.status(409).json({ success: false, code: 'CAJA_YA_CERRADA', message: 'La sesión ya está cerrada y no puede modificarse.' });
  }
  if (status !== 'cerrada') {
    return res.status(409).json({ success: false, code: 'CASH_SESSION_IMMUTABLE', message: 'La sesión abierta no se puede sobrescribir; usá el cierre de caja.' });
  }

  const closingAmount = Number(s.closingAmount);
  if (!Number.isFinite(closingAmount) || closingAmount < 0) {
    return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'El monto contado debe ser un número válido no negativo.' });
  }

  const closeTx = db.transaction(() => {
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'ingreso' AND method = 'efectivo' THEN amount ELSE 0 END), 0) AS ingresosEfectivo,
        COALESCE(SUM(CASE WHEN type = 'egreso' AND method = 'efectivo' THEN amount ELSE 0 END), 0) AS egresosEfectivo
      FROM caja_movimientos WHERE negocioId = ? AND sessionId = ?
    `).get(tenantId, id);
    const expectedAmount = existing.openingAmount + totals.ingresosEfectivo - totals.egresosEfectivo;
    db.prepare(`
      UPDATE caja_sesiones SET status = 'cerrada', closedAt = ?, closingAmount = ?,
        expectedAmount = ?, differenceAmount = ?, closedBy = ?, updatedAt = ?
      WHERE id = ? AND negocioId = ? AND status = 'abierta'
    `).run(now, closingAmount, expectedAmount, closingAmount - expectedAmount,
      req.user?.nombre || String(s.closedBy || 'Administrador').slice(0, 120), now, id, tenantId);
  });
  closeTx();
  res.json(db.prepare('SELECT * FROM caja_sesiones WHERE id = ? AND negocioId = ?').get(id, tenantId));
});

// Movimientos de la sesión activa
app.get(['/api/negocios/:negocioId/caja/movimientos', '/api/caja/movimientos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const activeSession = db.prepare(`
    SELECT id FROM caja_sesiones WHERE negocioId = ? AND status = 'abierta' LIMIT 1
  `).get(tenantId);

  if (!activeSession) {
    return res.json([]);
  }

  const movs = db.prepare(`
    SELECT * FROM caja_movimientos
    WHERE negocioId = ? AND sessionId = ?
    ORDER BY createdAt DESC
  `).all(tenantId, activeSession.id);
  res.json(movs);
});

// Historial de cierres de caja
app.get(['/api/negocios/:negocioId/caja/historial', '/api/caja/historial'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const sessions = db.prepare(`
    SELECT * FROM caja_sesiones
    WHERE negocioId = ?
    ORDER BY openedAt DESC
    LIMIT 30
  `).all(tenantId);
  res.json(sessions);
});

// Apertura de caja transaccional
app.post(['/api/negocios/:negocioId/caja/abrir', '/api/caja/abrir'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { openingAmount, openedBy } = req.body;
  const initial = Number(openingAmount || 0);

  if (!Number.isFinite(initial) || initial < 0) {
    return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'Monto inicial inválido.' });
  }

  const openTx = db.transaction(() => {
    const existing = db.prepare(`
      SELECT id FROM caja_sesiones WHERE negocioId = ? AND status = 'abierta' LIMIT 1
    `).get(tenantId);

    if (existing) {
      throw new Error('CAJA_YA_ABIERTA');
    }

    const id = `caja-${tenantId}-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO caja_sesiones (
        id, negocioId, status, openedAt, openingAmount, openedBy, createdAt, updatedAt
      ) VALUES (?, ?, 'abierta', ?, ?, ?, ?, ?)
    `).run(id, tenantId, now, initial, openedBy || 'Administrador', now, now);

    return db.prepare('SELECT * FROM caja_sesiones WHERE id = ?').get(id);
  });

  try {
    const session = openTx();
    res.status(201).json(session);
  } catch (err) {
    if (err.message === 'CAJA_YA_ABIERTA') {
      return res.status(409).json({ success: false, code: 'CAJA_YA_ABIERTA', message: 'Ya existe una caja abierta para este negocio.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cierre de caja transaccional con arqueo físico vs electrónico
app.post(['/api/negocios/:negocioId/caja/cerrar', '/api/caja/cerrar'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { closingAmount, closedBy } = req.body || {};
  const physicalCounted = Number(closingAmount);
  if (!Number.isFinite(physicalCounted) || physicalCounted < 0) {
    return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'El monto contado debe ser un número válido no negativo.' });
  }

  const closeTx = db.transaction(() => {
    const session = db.prepare(`
      SELECT * FROM caja_sesiones WHERE negocioId = ? AND status = 'abierta' LIMIT 1
    `).get(tenantId);

    if (!session) {
      throw new Error('CAJA_NO_ABIERTA');
    }

    // Calcular ingresos y egresos de efectivo físico
    const cashTotals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'ingreso' AND method = 'efectivo' THEN amount ELSE 0 END), 0) AS ingresosEfectivo,
        COALESCE(SUM(CASE WHEN type = 'egreso' AND method = 'efectivo' THEN amount ELSE 0 END), 0) AS egresosEfectivo,
        COALESCE(SUM(CASE WHEN type = 'ingreso' AND method <> 'efectivo' THEN amount ELSE 0 END), 0) AS ingresosElectronicos
      FROM caja_movimientos
      WHERE sessionId = ? AND negocioId = ?
    `).get(session.id, tenantId);

    const expectedPhysicalCash = session.openingAmount + cashTotals.ingresosEfectivo - cashTotals.egresosEfectivo;
    const diff = physicalCounted - expectedPhysicalCash;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE caja_sesiones SET
        status = 'cerrada',
        closedAt = ?,
        closingAmount = ?,
        expectedAmount = ?,
        differenceAmount = ?,
        closedBy = ?,
        updatedAt = ?
      WHERE id = ? AND negocioId = ?
    `).run(now, physicalCounted, expectedPhysicalCash, diff, closedBy || 'Administrador', now, session.id, tenantId);

    return {
      sessionId: session.id,
      status: 'cerrada',
      openingAmount: session.openingAmount,
      ingresosEfectivo: cashTotals.ingresosEfectivo,
      egresosEfectivo: cashTotals.egresosEfectivo,
      ingresosElectronicos: cashTotals.ingresosElectronicos,
      expectedPhysicalCash,
      physicalCounted,
      differenceAmount: diff,
    };
  });

  try {
    const summary = closeTx();
    res.json({ success: true, status: 'cerrada', ...summary, summary });
  } catch (err) {
    if (err.message === 'CAJA_NO_ABIERTA') {
      return res.status(400).json({ success: false, code: 'CAJA_NO_ABIERTA', message: 'No hay ninguna caja abierta para cerrar.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// Movimiento manual en caja
app.post(['/api/negocios/:negocioId/caja/movimientos', '/api/caja/movimientos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { type, amount, method, description, categoria } = req.body;
  const numAmount = Number(amount);

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'El importe debe ser mayor a cero.' });
  }
  if (!['efectivo', 'transferencia', 'mercadopago', 'tarjeta'].includes(method)) {
    return res.status(400).json({ success: false, code: 'INVALID_METHOD', message: 'Método de pago inválido.' });
  }
  if (!['ingreso', 'egreso'].includes(type)) {
    return res.status(400).json({ success: false, code: 'INVALID_TYPE', message: 'Tipo debe ser ingreso o egreso.' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ success: false, code: 'MISSING_DESC', message: 'La descripción es obligatoria.' });
  }

  const activeSession = db.prepare(`
    SELECT id FROM caja_sesiones WHERE negocioId = ? AND status = 'abierta' LIMIT 1
  `).get(tenantId);

  if (!activeSession) {
    return res.status(400).json({ success: false, code: 'CAJA_CERRADA', message: 'No se pueden registrar movimientos en una caja cerrada.' });
  }

  const id = `mov-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO caja_movimientos (
      id, negocioId, sessionId, type, amount, method, description, categoria, createdAt, createdBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    activeSession.id,
    type,
    numAmount,
    method || 'efectivo',
    description.trim(),
    categoria || null,
    now,
    req.user?.nombre || 'Administrador'
  );

  const created = db.prepare('SELECT * FROM caja_movimientos WHERE id = ?').get(id);
  res.status(201).json(created);
});

// ==========================================
// 6. PEDIDOS & POS ATÓMICO CON CONTROL DE STOCK
// ==========================================

app.get(['/api/negocios/:negocioId/pedidos', '/api/pedidos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const pedidos = db.prepare('SELECT * FROM pedidos WHERE negocioId = ? ORDER BY createdAt DESC').all(tenantId);
  const itemsStmt = db.prepare('SELECT * FROM pedido_items WHERE pedidoId = ?');
  const result = pedidos.map((p) => ({
    ...p,
    items: itemsStmt.all(p.id),
  }));
  res.json(result);
});

app.post(['/api/negocios/:negocioId/pedidos', '/api/pedidos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const p = req.body;
  const items = Array.isArray(p.items) ? p.items : [];

  const orderTx = db.transaction(() => {
    // 1. Validar y descontar stock para cada producto
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productoId && !item.id) continue;
      const prodId = item.productoId || item.id;
      const qty = Math.max(1, Number(item.cantidad || 1));

      const prod = db.prepare('SELECT * FROM productos WHERE id = ? AND negocioId = ?').get(prodId, tenantId);
      if (!prod) {
        throw new Error(`PRODUCT_NOT_FOUND:${prodId}`);
      }

      if (prod.stock !== null && prod.stock !== undefined && prod.stock < qty) {
        throw new Error(`STOCK_INSUFICIENTE:${prod.name}`);
      }

      const unitPrice = Number(prod.price);
      const subtotal = unitPrice * qty;
      calculatedTotal += subtotal;

      // Descontar stock
      db.prepare(`
        UPDATE productos SET stock = stock - ? WHERE id = ? AND negocioId = ?
      `).run(qty, prodId, tenantId);

      // Movimiento de inventario
      db.prepare(`
        INSERT INTO inventario_movimientos (id, negocioId, productoId, tipo, cantidad, motivo, createdAt)
        VALUES (?, ?, ?, 'venta', ?, 'Venta POS / Pedido', ?)
      `).run(`inv-${crypto.randomUUID().slice(0, 8)}`, tenantId, prodId, qty, new Date().toISOString());

      validatedItems.push({
        id: `item-${crypto.randomUUID().slice(0, 8)}`,
        productoId: prodId,
        nombre: prod.name,
        cantidad: qty,
        precioUnitario: unitPrice,
        subtotal,
        notas: item.notas || null,
        destinoComanda: prod.destinoComanda || 'cocina',
      });
    }

    const orderId = p.id || `ped-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO pedidos (
        id, negocioId, tipoPedido, mesaId, mozoId, clienteNombre, clienteTelefono,
        direccionDelivery, estado, total, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      tenantId,
      p.tipoPedido || 'mostrador',
      p.mesaId || null,
      p.mozoId || null,
      p.clienteNombre || null,
      p.clienteTelefono || null,
      p.direccionDelivery || null,
      p.estado || 'abierto',
      calculatedTotal,
      now,
      now
    );

    const insItem = db.prepare(`
      INSERT INTO pedido_items (
        id, pedidoId, productoId, nombre, cantidad, precioUnitario, subtotal, notas, destinoComanda
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v of validatedItems) {
      insItem.run(v.id, orderId, v.productoId, v.nombre, v.cantidad, v.precioUnitario, v.subtotal, v.notas, v.destinoComanda);
    }

    // Si viene cobrado en POS: registrar pago y caja si hay sesión abierta
    if (p.metodoPago && calculatedTotal > 0) {
      const activeSession = db.prepare(`
        SELECT id FROM caja_sesiones WHERE negocioId = ? AND status = 'abierta' LIMIT 1
      `).get(tenantId);

      const pagoId = `pago-${crypto.randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO pagos (id, negocioId, pedidoId, sessionId, amount, method, status, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, 'completado', ?, ?)
      `).run(pagoId, tenantId, orderId, activeSession?.id || null, calculatedTotal, p.metodoPago, now, req.user?.nombre || 'POS');

      if (activeSession) {
        db.prepare(`
          INSERT INTO caja_movimientos (id, negocioId, sessionId, type, amount, method, description, relatedPedidoId, createdAt, createdBy)
          VALUES (?, ?, ?, 'ingreso', ?, ?, ?, ?, ?, ?)
        `).run(
          `mov-${crypto.randomUUID().slice(0, 8)}`,
          tenantId,
          activeSession.id,
          calculatedTotal,
          p.metodoPago,
          `Venta Mostrador / Pedido #${orderId}`,
          orderId,
          now,
          req.user?.nombre || 'POS'
        );
      }
    }

    return { orderId, total: calculatedTotal, items: validatedItems };
  });

  try {
    const result = orderTx();
    res.status(201).json({ success: true, order: result });
  } catch (err) {
    if (err.message.startsWith('STOCK_INSUFICIENTE:')) {
      const prodName = err.message.split(':')[1];
      return res.status(409).json({
        success: false,
        code: 'STOCK_INSUFICIENTE',
        message: `Stock insuficiente para "${prodName}".`,
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put(['/api/negocios/:negocioId/pedidos/:id', '/api/pedidos/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  const p = req.body;
  const existing = db.prepare('SELECT * FROM pedidos WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!existing) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE pedidos
    SET tipoPedido = ?, mesaId = ?, mozoId = ?, repartidorId = ?, clienteNombre = ?, clienteTelefono = ?, direccionDelivery = ?, estado = ?, total = ?, updatedAt = ?
    WHERE id = ? AND negocioId = ?
  `).run(
    p.tipoPedido || existing.tipoPedido,
    p.mesaId !== undefined ? p.mesaId : existing.mesaId,
    p.mozoId !== undefined ? p.mozoId : existing.mozoId,
    p.repartidorId !== undefined ? p.repartidorId : existing.repartidorId,
    p.clienteNombre !== undefined ? p.clienteNombre : existing.clienteNombre,
    p.clienteTelefono !== undefined ? p.clienteTelefono : existing.clienteTelefono,
    p.direccionDelivery !== undefined ? p.direccionDelivery : existing.direccionDelivery,
    p.estado || existing.estado,
    p.total !== undefined ? Number(p.total) : existing.total,
    now,
    id,
    tenantId
  );

  const updated = db.prepare('SELECT * FROM pedidos WHERE id = ? AND negocioId = ?').get(id, tenantId);
  const items = db.prepare('SELECT * FROM pedido_items WHERE pedidoId = ?').all(id);
  res.json({ ...updated, items });
});

app.delete(['/api/negocios/:negocioId/pedidos/:id', '/api/pedidos/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  const pedido = db.prepare('SELECT id FROM pedidos WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!pedido) {
    return res.status(404).json({ success: false, code: 'PEDIDO_NOT_FOUND', message: 'Pedido no encontrado en este negocio.' });
  }

  // Validar pertenencia antes de borrar ítems y ejecutar todo de forma atómica.
  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM pedido_items WHERE pedidoId = ?').run(id);
    db.prepare('DELETE FROM pedidos WHERE id = ? AND negocioId = ?').run(id, tenantId);
  });
  deleteTx();
  res.json({ success: true, message: 'Pedido eliminado correctamente' });
});

// ==========================================
// 7. PRODUCTOS, MESAS, CLIENTES, OFERTAS
// ==========================================

// PRODUCTOS
app.get(['/api/negocios/:negocioId/productos', '/api/productos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const rows = db.prepare('SELECT * FROM productos WHERE negocioId = ? ORDER BY category, name').all(tenantId);
  res.json(rows);
});

app.post(['/api/negocios/:negocioId/productos', '/api/productos'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const p = req.body;
  const id = p.id || `prod-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO productos (id, negocioId, name, price, stock, category, icon, destinoComanda, disponible, description, imageUrl, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    p.name,
    Number(p.price || 0),
    Number(p.stock || 0),
    p.category || 'general',
    p.icon || 'restaurant',
    p.destinoComanda || 'cocina',
    p.disponible !== false ? 1 : 0,
    p.description || '',
    p.imageUrl || '',
    now,
    now
  );

  const created = db.prepare('SELECT * FROM productos WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.status(201).json(created);
});

app.put(['/api/negocios/:negocioId/productos/:id', '/api/productos/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  const p = req.body;
  const existing = db.prepare('SELECT * FROM productos WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!existing) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE productos
    SET name = ?, price = ?, stock = ?, category = ?, icon = ?, destinoComanda = ?, disponible = ?, description = ?, imageUrl = ?, updatedAt = ?
    WHERE id = ? AND negocioId = ?
  `).run(
    p.name !== undefined ? p.name : existing.name,
    p.price !== undefined ? Number(p.price) : existing.price,
    p.stock !== undefined ? Number(p.stock) : existing.stock,
    p.category !== undefined ? p.category : existing.category,
    p.icon !== undefined ? p.icon : existing.icon,
    p.destinoComanda !== undefined ? p.destinoComanda : existing.destinoComanda,
    p.disponible !== undefined ? (p.disponible ? 1 : 0) : existing.disponible,
    p.description !== undefined ? p.description : existing.description,
    p.imageUrl !== undefined ? p.imageUrl : existing.imageUrl,
    now,
    id,
    tenantId
  );

  const updated = db.prepare('SELECT * FROM productos WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.json(updated);
});

app.delete(['/api/negocios/:negocioId/productos/:id', '/api/productos/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  db.prepare('DELETE FROM productos WHERE id = ? AND negocioId = ?').run(id, tenantId);
  res.json({ success: true, message: 'Producto eliminado correctamente' });
});

// MESAS
app.get(['/api/negocios/:negocioId/mesas', '/api/mesas'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const rows = db.prepare('SELECT * FROM mesas WHERE negocioId = ? ORDER BY numero').all(tenantId);
  res.json(rows);
});

app.post(['/api/negocios/:negocioId/mesas', '/api/mesas'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const m = req.body;
  const id = m.id || `mesa-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO mesas (id, negocioId, numero, sector, capacidad, estado, mozoAsignadoId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    Number(m.numero || 1),
    m.sector || 'salon',
    Number(m.capacidad || 4),
    m.estado || 'libre',
    m.mozoAsignadoId || null,
    now,
    now
  );

  const created = db.prepare('SELECT * FROM mesas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.status(201).json(created);
});

app.put(['/api/negocios/:negocioId/mesas/:id', '/api/mesas/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  const m = req.body;
  const existing = db.prepare('SELECT * FROM mesas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!existing) return res.status(404).json({ success: false, message: 'Mesa no encontrada' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE mesas
    SET numero = ?, sector = ?, capacidad = ?, estado = ?, mozoAsignadoId = ?, updatedAt = ?
    WHERE id = ? AND negocioId = ?
  `).run(
    m.numero !== undefined ? Number(m.numero) : existing.numero,
    m.sector !== undefined ? m.sector : existing.sector,
    m.capacidad !== undefined ? Number(m.capacidad) : existing.capacidad,
    m.estado !== undefined ? m.estado : existing.estado,
    m.mozoAsignadoId !== undefined ? m.mozoAsignadoId : existing.mozoAsignadoId,
    now,
    id,
    tenantId
  );

  const updated = db.prepare('SELECT * FROM mesas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.json(updated);
});

app.delete(['/api/negocios/:negocioId/mesas/:id', '/api/mesas/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  db.prepare('DELETE FROM mesas WHERE id = ? AND negocioId = ?').run(id, tenantId);
  res.json({ success: true, message: 'Mesa eliminada correctamente' });
});

// CLIENTES
app.get(['/api/negocios/:negocioId/clientes', '/api/clientes'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const rows = db.prepare('SELECT * FROM clientes WHERE negocioId = ? ORDER BY name').all(tenantId);
  res.json(rows);
});

app.post(['/api/negocios/:negocioId/clientes', '/api/clientes'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const c = req.body;
  const id = c.id || `cli-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO clientes (id, negocioId, name, phone, email, isFrequent, isSanctioned, totalReservations, noShows, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    c.name.trim(),
    c.phone || '',
    c.email || '',
    c.isFrequent ? 1 : 0,
    c.isSanctioned ? 1 : 0,
    Number(c.totalReservations || 0),
    Number(c.noShows || 0),
    now,
    now
  );

  const created = db.prepare('SELECT * FROM clientes WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.status(201).json(created);
});

app.put(['/api/negocios/:negocioId/clientes/:id', '/api/clientes/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  const c = req.body;
  const existing = db.prepare('SELECT * FROM clientes WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!existing) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE clientes
    SET name = ?, phone = ?, email = ?, isFrequent = ?, isSanctioned = ?, totalReservations = ?, noShows = ?, updatedAt = ?
    WHERE id = ? AND negocioId = ?
  `).run(
    c.name !== undefined ? c.name : existing.name,
    c.phone !== undefined ? c.phone : existing.phone,
    c.email !== undefined ? c.email : existing.email,
    c.isFrequent !== undefined ? (c.isFrequent ? 1 : 0) : existing.isFrequent,
    c.isSanctioned !== undefined ? (c.isSanctioned ? 1 : 0) : existing.isSanctioned,
    c.totalReservations !== undefined ? Number(c.totalReservations) : existing.totalReservations,
    c.noShows !== undefined ? Number(c.noShows) : existing.noShows,
    now,
    id,
    tenantId
  );

  const updated = db.prepare('SELECT * FROM clientes WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.json(updated);
});

app.delete(['/api/negocios/:negocioId/clientes/:id', '/api/clientes/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  db.prepare('DELETE FROM clientes WHERE id = ? AND negocioId = ?').run(id, tenantId);
  res.json({ success: true, message: 'Cliente eliminado correctamente' });
});

// OFERTAS
app.get(['/api/negocios/:negocioId/ofertas', '/api/ofertas'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const rows = db.prepare('SELECT * FROM ofertas WHERE negocioId = ? ORDER BY createdAt DESC').all(tenantId);
  res.json(rows.map((o) => ({
    ...o,
    activo: !!o.activo,
    diasSemana: o.diasSemana ? JSON.parse(o.diasSemana) : undefined,
  })));
});

app.post(['/api/negocios/:negocioId/ofertas', '/api/ofertas'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const o = req.body;
  const id = o.id || `oferta-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO ofertas (id, negocioId, titulo, descripcion, descuento, tipoDescuento, aplicaA, categoria, diasSemana, horaInicio, horaFin, fechaInicio, fechaFin, activo, codigoCupon, limiteUsos, usosActuales, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    o.titulo || '',
    o.descripcion || '',
    Number(o.descuento || 0),
    o.tipoDescuento || 'porcentaje',
    o.aplicaA || 'todos',
    o.categoria || null,
    o.diasSemana ? JSON.stringify(o.diasSemana) : null,
    o.horaInicio || null,
    o.horaFin || null,
    o.fechaInicio || null,
    o.fechaFin || null,
    o.activo !== false ? 1 : 0,
    o.codigoCupon || null,
    o.limiteUsos ? Number(o.limiteUsos) : null,
    Number(o.usosActuales || 0),
    now,
    now
  );

  const created = db.prepare('SELECT * FROM ofertas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.status(201).json({
    ...created,
    activo: !!created.activo,
    diasSemana: created.diasSemana ? JSON.parse(created.diasSemana) : undefined,
  });
});

app.put(['/api/negocios/:negocioId/ofertas/:id', '/api/ofertas/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  const o = req.body;
  const existing = db.prepare('SELECT * FROM ofertas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  if (!existing) return res.status(404).json({ success: false, message: 'Oferta no encontrada' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE ofertas
    SET titulo = ?, descripcion = ?, descuento = ?, tipoDescuento = ?, aplicaA = ?, categoria = ?, diasSemana = ?, horaInicio = ?, horaFin = ?, fechaInicio = ?, fechaFin = ?, activo = ?, codigoCupon = ?, limiteUsos = ?, usosActuales = ?, updatedAt = ?
    WHERE id = ? AND negocioId = ?
  `).run(
    o.titulo !== undefined ? o.titulo : existing.titulo,
    o.descripcion !== undefined ? o.descripcion : existing.descripcion,
    o.descuento !== undefined ? Number(o.descuento) : existing.descuento,
    o.tipoDescuento !== undefined ? o.tipoDescuento : existing.tipoDescuento,
    o.aplicaA !== undefined ? o.aplicaA : existing.aplicaA,
    o.categoria !== undefined ? o.categoria : existing.categoria,
    o.diasSemana !== undefined ? JSON.stringify(o.diasSemana) : existing.diasSemana,
    o.horaInicio !== undefined ? o.horaInicio : existing.horaInicio,
    o.horaFin !== undefined ? o.horaFin : existing.horaFin,
    o.fechaInicio !== undefined ? o.fechaInicio : existing.fechaInicio,
    o.fechaFin !== undefined ? o.fechaFin : existing.fechaFin,
    o.activo !== undefined ? (o.activo ? 1 : 0) : existing.activo,
    o.codigoCupon !== undefined ? o.codigoCupon : existing.codigoCupon,
    o.limiteUsos !== undefined ? (o.limiteUsos ? Number(o.limiteUsos) : null) : existing.limiteUsos,
    o.usosActuales !== undefined ? Number(o.usosActuales) : existing.usosActuales,
    now,
    id,
    tenantId
  );

  const updated = db.prepare('SELECT * FROM ofertas WHERE id = ? AND negocioId = ?').get(id, tenantId);
  res.json({
    ...updated,
    activo: !!updated.activo,
    diasSemana: updated.diasSemana ? JSON.parse(updated.diasSemana) : undefined,
  });
});

app.delete(['/api/negocios/:negocioId/ofertas/:id', '/api/ofertas/:id'], (req, res) => {
  const tenantId = resolveTenantId(req);
  const { id } = req.params;
  db.prepare('DELETE FROM ofertas WHERE id = ? AND negocioId = ?').run(id, tenantId);
  res.json({ success: true, message: 'Oferta eliminada correctamente' });
});

// ==========================================
// 8. SNAPSHOT AISLADO POR TENANT (/api/negocios/:negocioId/sync)
// ==========================================

app.get(['/api/negocios/:negocioId/sync', '/api/sync'], (req, res) => {
  const tenantId = resolveTenantId(req);

  const productos = db.prepare('SELECT * FROM productos WHERE negocioId = ? ORDER BY category, name').all(tenantId);
  const mesas = db.prepare('SELECT * FROM mesas WHERE negocioId = ? ORDER BY numero').all(tenantId);
  const espacios = db.prepare('SELECT * FROM espacios WHERE negocioId = ? ORDER BY name').all(tenantId).map(rowEspacio);
  const reservas = db.prepare('SELECT * FROM reservas WHERE negocioId = ? ORDER BY date, startTime').all(tenantId).map(rowReserva);
  const clientes = db.prepare('SELECT * FROM clientes WHERE negocioId = ? ORDER BY name').all(tenantId);
  const pedidosRaw = db.prepare('SELECT * FROM pedidos WHERE negocioId = ? ORDER BY createdAt DESC').all(tenantId);
  const itemsStmt = db.prepare('SELECT * FROM pedido_items WHERE pedidoId = ?');
  const pedidos = pedidosRaw.map((p) => ({
    ...p,
    items: itemsStmt.all(p.id),
  }));
  const ofertas = db.prepare('SELECT * FROM ofertas WHERE negocioId = ?').all(tenantId).map((o) => ({
    ...o,
    activo: !!o.activo,
    diasSemana: o.diasSemana ? JSON.parse(o.diasSemana) : undefined,
  }));
  const cajaSesion = db.prepare("SELECT * FROM caja_sesiones WHERE negocioId = ? AND status = 'abierta' LIMIT 1").get(tenantId);
  const cajaMovimientos = cajaSesion
    ? db.prepare('SELECT * FROM caja_movimientos WHERE negocioId = ? AND sessionId = ? ORDER BY createdAt DESC').all(tenantId, cajaSesion.id)
    : [];

  res.json({
    tenantId,
    productos,
    mesas,
    espacios,
    reservas,
    clientes,
    pedidos,
    ofertas,
    cajaSesion,
    cajaMovimientos,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: 'sqlite',
    version: '2.0.0-multi-tenant-isolated',
    tenantId: req.tenantId,
    time: new Date().toISOString(),
  });
});

// Manejador global de errores (Punto 90)
app.use((err, req, res, _next) => {
  console.error('[API Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`\n🗄️  Multi-Tenant API + SQLite Unificada y Aislada → http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
