import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'));
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  throw new Error('Falta JWT_SECRET: configurá un secreto aleatorio en el entorno privado del servidor.');
}

/**
 * Genera un hash seguro para contraseñas usando salt aleatorio.
 */
export function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Comprueba una contraseña contra el hash almacenado.
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  // Compatibilidad con contraseñas planas de migración inicial
  if (!storedHash.includes(':')) {
    return password === storedHash;
  }
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}

/**
 * Genera un token Bearer firmado (formato base64url con firma HMAC-SHA256).
 */
export function createToken(payload, expiresInHours = 24) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const fullPayload = { ...payload, exp };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verifica y decodifica un token firmado.
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Token inválido');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Formato de token inválido');

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('Firma de token inválida');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expirado');
  }

  return payload;
}

/**
 * Middleware de autenticación Bearer token.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Cabecera de autorización requerida (Bearer token).',
    });
  }

  const token = authHeader.substring(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: err.message || 'Token inválido o expirado.',
    });
  }
}

/**
 * Middleware para validar que el usuario pertenece al tenant o es superadmin.
 */
export function authorizeTenant(req, negocioId) {
  if (!req.user) {
    const error = new Error('No autenticado');
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (req.user.rol === 'superadmin') {
    return true;
  }

  const target = (negocioId || '').toLowerCase().trim();
  const userTenant = (req.user.negocioId || '').toLowerCase().trim();

  if (userTenant !== target) {
    const error = new Error(`Acceso denegado al negocio "${negocioId}".`);
    error.status = 403;
    error.code = 'TENANT_FORBIDDEN';
    throw error;
  }

  return true;
}

/**
 * Helper middleware para rutas donde el tenant viene en req.params.negocioId.
 */
export function requireTenantAccess(req, res, next) {
  const negocioId = req.params.negocioId || req.params.id;
  try {
    authorizeTenant(req, negocioId);
    next();
  } catch (err) {
    res.status(err.status || 403).json({
      success: false,
      code: err.code || 'TENANT_FORBIDDEN',
      message: err.message,
    });
  }
}
