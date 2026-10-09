import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const migrationsDir = path.join(__dirname, 'migrations');
if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });

// Archivo principal de base de datos multi-tenant unificada
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'app.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Ejecuta una sentencia SQL de migración sin silenciar fallos.
 */
export function runMigration(sql, name = 'migración') {
  try {
    db.exec(sql);
  } catch (error) {
    console.error(`[DATABASE MIGRATION ERROR] en "${name}":`, error);
    throw error;
  }
}

/**
 * Aplica migraciones versionadas desde server/migrations/*.sql
 */
export function applyMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      appliedAt TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
  );

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;
    const version = parseInt(match[1], 10);

    if (!appliedVersions.has(version)) {
      console.log(`[Migrations] Aplicando migración v${version}: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      const applyTx = db.transaction(() => {
        db.exec(sql);
        db.prepare(
          'INSERT INTO schema_migrations (version, filename, appliedAt) VALUES (?, ?, ?)'
        ).run(version, file, new Date().toISOString());
      });

      applyTx();
      console.log(`[Migrations] Migración v${version} aplicada con éxito.`);
    }
  }
}

/**
 * Si existen datos legados en server/data/giovanni.sqlite, los importa a app.sqlite
 */
function migrateLegacyGiovanniData() {
  // En pruebas aisladas nunca importar el archivo de datos local del desarrollador.
  if (process.env.DATABASE_PATH) return;
  const legacyGiovanniPath = path.join(dataDir, 'giovanni.sqlite');
  if (!fs.existsSync(legacyGiovanniPath)) return;

  const currentCount = db.prepare("SELECT COUNT(*) as c FROM espacios WHERE negocioId = 'giovanni'").get().c;
  if (currentCount > 0) return; // ya existen datos

  console.log('[Migrations] Migrando datos legados desde giovanni.sqlite hacia app.sqlite...');
  try {
    const legacyDb = new Database(legacyGiovanniPath, { readonly: true });

    // Migrar productos
    const prods = legacyDb.prepare('SELECT * FROM productos').all();
    const insProd = db.prepare(`
      INSERT OR IGNORE INTO productos (id, negocioId, name, price, stock, category, icon, destinoComanda, disponible, description, imageUrl, createdAt, updatedAt)
      VALUES (?, 'giovanni', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of prods) {
      insProd.run(
        p.id,
        p.name,
        p.price,
        p.stock || 0,
        p.category,
        p.icon,
        p.destinoComanda || 'cocina',
        p.disponible ? 1 : 0,
        p.description || '',
        p.imageUrl || '',
        new Date().toISOString(),
        new Date().toISOString()
      );
    }

    // Migrar mesas
    const mesas = legacyDb.prepare('SELECT * FROM mesas').all();
    const insMesa = db.prepare(`
      INSERT OR IGNORE INTO mesas (id, negocioId, numero, sector, capacidad, estado, mozoAsignadoId, createdAt, updatedAt)
      VALUES (?, 'giovanni', ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of mesas) {
      insMesa.run(m.id, m.numero, m.sector, m.capacidad, m.estado, m.mozoAsignadoId || null, new Date().toISOString(), new Date().toISOString());
    }

    // Migrar espacios
    const espacios = legacyDb.prepare('SELECT * FROM espacios').all();
    const insEsp = db.prepare(`
      INSERT OR IGNORE INTO espacios (id, negocioId, name, type, status, precioHora, precioDia, precioNoche, isActive, currentReservationId, description, imageUrl, usaCapacidad, capacidad, precioPorPersona, createdAt, updatedAt)
      VALUES (?, 'giovanni', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of espacios) {
      insEsp.run(
        e.id,
        e.name,
        e.type,
        e.status || 'libre',
        e.precioHora || 0,
        e.precioDia || e.precioHora || 12000,
        e.precioNoche || (e.precioHora ? Math.round(e.precioHora * 1.25) : 15000),
        e.isActive !== false ? 1 : 0,
        e.currentReservationId || null,
        e.description || '',
        e.imageUrl || '',
        e.usaCapacidad ? 1 : 0,
        e.capacidad || 15,
        e.precioPorPersona ? 1 : 0,
        new Date().toISOString(),
        new Date().toISOString()
      );
    }

    legacyDb.close();
    console.log('[Migrations] Datos legados de Giovanni importados correctamente.');
  } catch (err) {
    console.warn('[Migrations] No se pudieron importar datos legados de giovanni.sqlite:', err.message);
  }
}

/**
 * Inicializa los negocios y usuarios base si la base está vacía.
 */
export function seedDefaultTenants() {
  const count = db.prepare('SELECT COUNT(*) as c FROM negocios').get().c;
  const now = new Date().toISOString();

  // SuperAdmin se autentica con OWNER_EMAIL/OWNER_PASSWORD/OWNER_PIN del servidor.
  // No crear una cuenta maestra con credenciales fijas en la base de datos.

  if (count === 0) {
    console.log('[Seed] Creando negocios iniciales del SaaS...');

    const defaultTenants = [
      {
        id: 'giovanni',
        slug: 'giovanni',
        nombre: 'Complejo Giovanni',
        subtitulo: 'TU LUGAR DEPORTIVO',
        descripcion: 'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha.',
        whatsapp: '3855374835',
        plan: 'enterprise',
        adminUser: 'admin',
        adminPass: 'admin',
        color: '#10b981',
      },
      {
        id: 'demo',
        slug: 'demo',
        nombre: 'Complejo Demo Padel & Fútbol',
        subtitulo: 'DEPORTE Y AMIGOS',
        descripcion: 'Espacio recreativo y deportivo con canchas de césped sintético y blindex pro.',
        whatsapp: '1122334455',
        plan: 'pro',
        adminUser: 'admin',
        adminPass: 'admin',
        color: '#3b82f6',
      },
      {
        id: 'padelpro',
        slug: 'padelpro',
        nombre: 'Pádel Pro Center',
        subtitulo: 'CIRCUITO PROFESIONAL',
        descripcion: 'Canchas panorámicas de última generación y vestuarios de primer nivel.',
        whatsapp: '3514455667',
        plan: 'pro',
        adminUser: 'admin',
        adminPass: 'admin',
        color: '#8b5cf6',
      },
      {
        id: 'clubnorte',
        slug: 'clubnorte',
        nombre: 'Club Social Norte',
        subtitulo: 'TRADICIÓN Y ENCUENTRO',
        descripcion: 'Fútbol, tenis y gastronomía en un predio familiar y seguro.',
        whatsapp: '3815566778',
        plan: 'basic',
        adminUser: 'admin',
        adminPass: 'admin',
        color: '#f59e0b',
      },
    ];

    const insNegocio = db.prepare(`
      INSERT INTO negocios (id, slug, nombre, subtitulo, descripcion, whatsapp, plan, themeJson, modulosJson, adminUser, adminPassword, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const insUser = db.prepare(`
      INSERT INTO usuarios (id, negocioId, email, nombre, passwordHash, pinHash, rol, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    for (const t of defaultTenants) {
      const theme = JSON.stringify({ primaryColor: t.color });
      const modulos = JSON.stringify({
        bar: true,
        reservas: true,
        cocina: true,
        caja: true,
        inventario: true,
        iot: true,
        analytics_ai: false,
        delivery: true,
        mozos: true,
        torneos: true,
        access_control: true,
        smart_center: true,
        finanzas: true,
        empleados: true,
      });

      insNegocio.run(t.id, t.slug, t.nombre, t.subtitulo, t.descripcion, t.whatsapp, t.plan, theme, modulos, t.adminUser, t.adminPass, now, now);

      // Admin del negocio
      insUser.run(`u-admin-${t.id}`, t.id, t.adminUser, `Administrador de ${t.nombre}`, hashPassword(t.adminPass), hashPassword('1234'), 'admin', now, now);

      // Staff para giovanni
      if (t.id === 'giovanni') {
        insUser.run('u-mozo-giovanni', 'giovanni', 'mozo', 'Martín Mozo', hashPassword('admin'), hashPassword('1234'), 'mozo', now, now);
        insUser.run('u-cocina-giovanni', 'giovanni', 'cocina', 'Ana Cocina', hashPassword('admin'), hashPassword('9012'), 'cocina', now, now);
        insUser.run('u-delivery-giovanni', 'giovanni', 'delivery', 'Pedro Delivery', hashPassword('admin'), hashPassword('7890'), 'delivery', now, now);
        insUser.run('u-recepcion-giovanni', 'giovanni', 'recepcion', 'Laura Recepción', hashPassword('admin'), hashPassword('3456'), 'recepcion', now, now);
      }
    }

    // Cargar catálogo inicial de Giovanni desde seed.json si aún no existen productos
    const seedFile = path.join(__dirname, 'seed.json');
    if (fs.existsSync(seedFile)) {
      const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));

      const insProd = db.prepare(`
        INSERT OR IGNORE INTO productos (id, negocioId, name, price, stock, category, icon, destinoComanda, disponible, createdAt, updatedAt)
        VALUES (?, 'giovanni', ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      for (const p of seed.productos || []) {
        insProd.run(p.id, p.name, p.price, p.stock || 50, p.category, p.icon, p.destinoComanda || 'cocina', now, now);
      }

      const insMesa = db.prepare(`
        INSERT OR IGNORE INTO mesas (id, negocioId, numero, sector, capacidad, estado, createdAt, updatedAt)
        VALUES (?, 'giovanni', ?, ?, ?, ?, ?, ?)
      `);
      for (const m of seed.mesas || []) {
        insMesa.run(m.id, m.numero, m.sector, m.capacidad, m.estado, now, now);
      }

      const insEsp = db.prepare(`
        INSERT OR IGNORE INTO espacios (id, negocioId, name, type, status, precioHora, precioDia, precioNoche, isActive, createdAt, updatedAt)
        VALUES (?, 'giovanni', ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      for (const e of seed.espacios || []) {
        insEsp.run(e.id, e.name, e.type, e.status || 'libre', e.precioHora || 12000, e.precioHora || 12000, Math.round((e.precioHora || 12000) * 1.25), now, now);
      }
    }
  }

  migrateLegacyGiovanniData();
}

// Inicialización automática
applyMigrations();
seedDefaultTenants();

export default db;
