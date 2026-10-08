import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Cache de conexiones SQLite por cada tenant
const tenantDbs = new Map();

/**
 * Sanitiza el identificador del negocio/cliente para que sea seguro como nombre de archivo.
 */
export function sanitizeTenantId(rawId) {
  if (!rawId) return 'giovanni';
  const clean = String(rawId).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  return clean || 'giovanni';
}

/**
 * Retorna la instancia de SQLite 100% aislada e independiente para el tenant especificado.
 * Si no existe la base de datos para este tenant, la crea automáticamente con todas sus tablas,
 * migraciones y seed inicial personalizado.
 */
export function getDbForTenant(tenantId = 'giovanni') {
  const safeId = sanitizeTenantId(tenantId);

  if (tenantDbs.has(safeId)) {
    const existing = tenantDbs.get(safeId);
    if (existing && existing.open) return existing;
  }

  const dbPath = path.join(dataDir, `${safeId}.sqlite`);
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Creación del esquema completo en la base de datos del tenant
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      category TEXT,
      icon TEXT,
      destinoComanda TEXT DEFAULT 'cocina',
      disponible INTEGER DEFAULT 1,
      description TEXT,
      imageUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS mesas (
      id TEXT PRIMARY KEY,
      numero INTEGER NOT NULL,
      sector TEXT,
      capacidad INTEGER DEFAULT 4,
      estado TEXT DEFAULT 'libre',
      mozoAsignadoId TEXT
    );

    CREATE TABLE IF NOT EXISTS espacios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      status TEXT DEFAULT 'libre',
      precioHora REAL,
      precioDia REAL,
      precioNoche REAL,
      description TEXT,
      imageUrl TEXT,
      usaCapacidad INTEGER DEFAULT 0,
      capacidad INTEGER DEFAULT 15,
      precioPorPersona INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      currentReservationId TEXT
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      isFrequent INTEGER DEFAULT 0,
      isSanctioned INTEGER DEFAULT 0,
      totalReservations INTEGER DEFAULT 0,
      noShows INTEGER DEFAULT 0,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      courtId TEXT,
      clientId TEXT,
      clientName TEXT,
      clientPhone TEXT,
      date TEXT,
      startTime TEXT,
      endTime TEXT,
      paymentStatus TEXT,
      paymentMethod TEXT,
      amount REAL,
      paidAmount REAL DEFAULT 0,
      notes TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      tipoPedido TEXT,
      mesaId TEXT,
      mozoId TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      direccionDelivery TEXT,
      estado TEXT DEFAULT 'borrador',
      total REAL DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS pedido_items (
      id TEXT PRIMARY KEY,
      pedidoId TEXT NOT NULL,
      productoId TEXT,
      nombre TEXT,
      cantidad INTEGER,
      precioUnitario REAL,
      subtotal REAL,
      notas TEXT,
      estadoItem TEXT DEFAULT 'pendiente',
      destinoComanda TEXT,
      FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ofertas (
      id TEXT PRIMARY KEY,
      titulo TEXT,
      descripcion TEXT,
      descuentoPct REAL,
      descuentoMonto REAL,
      activo INTEGER DEFAULT 1,
      fechaDesde TEXT,
      fechaHasta TEXT,
      diasSemana TEXT,
      horaDesde TEXT,
      horaHasta TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS caja_movimientos (
      id TEXT PRIMARY KEY,
      type TEXT,
      amount REAL,
      method TEXT,
      description TEXT,
      relatedPedidoId TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS caja_sesion (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT DEFAULT 'cerrada',
      openedAt TEXT,
      openingAmount REAL DEFAULT 0,
      closedAt TEXT,
      closingAmount REAL DEFAULT 0,
      expectedAmount REAL DEFAULT 0,
      openedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migraciones seguras
  const safeAlter = (sql) => {
    try {
      db.exec(sql);
    } catch {
      // Ignorar si la columna ya existe
    }
  };
  safeAlter('ALTER TABLE productos ADD COLUMN description TEXT');
  safeAlter('ALTER TABLE productos ADD COLUMN imageUrl TEXT');
  safeAlter('ALTER TABLE clientes ADD COLUMN email TEXT');
  safeAlter('ALTER TABLE clientes ADD COLUMN totalReservations INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE clientes ADD COLUMN noShows INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE caja_sesion ADD COLUMN closedAt TEXT');
  safeAlter('ALTER TABLE caja_sesion ADD COLUMN closingAmount REAL DEFAULT 0');
  safeAlter('ALTER TABLE caja_sesion ADD COLUMN expectedAmount REAL DEFAULT 0');
  safeAlter('ALTER TABLE caja_sesion ADD COLUMN openedBy TEXT');
  safeAlter('ALTER TABLE caja_sesion ADD COLUMN negocioId TEXT');
  safeAlter('ALTER TABLE espacios ADD COLUMN precioDia REAL');
  safeAlter('ALTER TABLE espacios ADD COLUMN precioNoche REAL');
  safeAlter('ALTER TABLE espacios ADD COLUMN description TEXT');
  safeAlter('ALTER TABLE espacios ADD COLUMN imageUrl TEXT');
  safeAlter('ALTER TABLE espacios ADD COLUMN usaCapacidad INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE espacios ADD COLUMN capacidad INTEGER DEFAULT 15');
  safeAlter('ALTER TABLE espacios ADD COLUMN precioPorPersona INTEGER DEFAULT 0');

  // Si la base de datos está vacía, sembramos sus datos iniciales independientes
  const prodCount = db.prepare('SELECT COUNT(*) as c FROM productos').get().c;
  const espCount = db.prepare('SELECT COUNT(*) as c FROM espacios').get().c;

  if (prodCount === 0 && espCount === 0) {
    console.log(`[MultiTenant DB] Creando y sembrando base de datos independiente para: ${safeId}`);

    if (safeId === 'giovanni') {
      const seedFile = path.join(__dirname, 'seed.json');
      if (fs.existsSync(seedFile)) {
        const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
        const insProd = db.prepare(
          'INSERT INTO productos (id,name,price,stock,category,icon,destinoComanda,disponible) VALUES (?,?,?,?,?,?,?,?)'
        );
        for (const p of seed.productos || []) {
          insProd.run(p.id, p.name, p.price, p.stock, p.category, p.icon, p.destinoComanda, p.disponible ? 1 : 0);
        }

        const insMesa = db.prepare(
          'INSERT INTO mesas (id,numero,sector,capacidad,estado) VALUES (?,?,?,?,?)'
        );
        for (const m of seed.mesas || []) {
          insMesa.run(m.id, m.numero, m.sector, m.capacidad, m.estado);
        }

        const insEsp = db.prepare(
          'INSERT INTO espacios (id,name,type,status,precioHora,isActive) VALUES (?,?,?,?,?,?)'
        );
        for (const e of seed.espacios || []) {
          insEsp.run(e.id, e.name, e.type, e.status, e.precioHora, e.isActive ? 1 : 0);
        }
      }
    } else if (safeId === 'oasispadel') {
      // Base de datos dedicada para Oasis Padel Club
      const insEsp = db.prepare('INSERT INTO espacios (id,name,type,status,precioHora,isActive) VALUES (?,?,?,?,?,?)');
      insEsp.run('op-esp-1', 'Cancha Padel 1 Panorámica (World Padel)', 'padel', 'libre', 15000, 1);
      insEsp.run('op-esp-2', 'Cancha Padel 2 Central Cristal', 'padel', 'libre', 16000, 1);
      insEsp.run('op-esp-3', 'Cancha Padel 3 Cubierta Pro', 'padel', 'libre', 15000, 1);
      insEsp.run('op-esp-4', 'Cancha Padel 4 Vidriada Exterior', 'padel', 'libre', 14000, 1);

      const insMesa = db.prepare('INSERT INTO mesas (id,numero,sector,capacidad,estado) VALUES (?,?,?,?,?)');
      insMesa.run('op-m-1', 1, 'terraza', 4, 'libre');
      insMesa.run('op-m-2', 2, 'terraza', 4, 'libre');
      insMesa.run('op-m-3', 3, 'lounge', 6, 'libre');
      insMesa.run('op-m-4', 4, 'lounge', 6, 'libre');
      insMesa.run('op-m-5', 5, 'bar', 2, 'libre');
      insMesa.run('op-m-6', 6, 'bar', 4, 'libre');

      const insProd = db.prepare('INSERT INTO productos (id,name,price,stock,category,icon,destinoComanda,disponible) VALUES (?,?,?,?,?,?,?,?)');
      insProd.run('op-p-1', 'Tubo Pelotas Bullpadel Gold', 12000, 30, 'padel', 'sports_tennis', 'bar', 1);
      insProd.run('op-p-2', 'Alquiler Paleta Siux Carbon', 4500, 10, 'padel', 'sports_tennis', 'bar', 1);
      insProd.run('op-p-3', 'Overgrip Wilson Pro x3', 3500, 40, 'padel', 'sports_tennis', 'bar', 1);
      insProd.run('op-p-4', 'Gatorade 500ml Manzana/Blue', 3500, 60, 'bebidas', 'water_drop', 'bar', 1);
      insProd.run('op-p-5', 'Agua Mineral 500ml', 2500, 80, 'bebidas', 'water_drop', 'bar', 1);
      insProd.run('op-p-6', 'Cerveza Corona 330ml', 4500, 48, 'cervezas', 'sports_bar', 'bar', 1);
      insProd.run('op-p-7', 'Tostado Jamón y Queso', 5500, 30, 'cafeteria', 'lunch_dining', 'cocina', 1);
      insProd.run('op-p-8', 'Barra Proteica Ena', 2800, 50, 'snacks', 'restaurant', 'bar', 1);
      insProd.run('op-p-9', 'Café Expresso', 2200, 60, 'cafeteria', 'coffee', 'bar', 1);
    } else {
      // Datos iniciales base limpios para cualquier nuevo negocio que se registre
      const insEsp = db.prepare('INSERT INTO espacios (id,name,type,status,precioHora,isActive) VALUES (?,?,?,?,?,?)');
      insEsp.run(`${safeId}-c1`, 'Cancha 1', 'deportes', 'libre', 12000, 1);
      insEsp.run(`${safeId}-c2`, 'Cancha 2', 'deportes', 'libre', 12000, 1);

      const insMesa = db.prepare('INSERT INTO mesas (id,numero,sector,capacidad,estado) VALUES (?,?,?,?,?)');
      insMesa.run(`${safeId}-m1`, 1, 'salon', 4, 'libre');
      insMesa.run(`${safeId}-m2`, 2, 'salon', 4, 'libre');
      insMesa.run(`${safeId}-m3`, 3, 'patio', 4, 'libre');
      insMesa.run(`${safeId}-m4`, 4, 'patio', 6, 'libre');

      const insProd = db.prepare('INSERT INTO productos (id,name,price,stock,category,icon,destinoComanda,disponible) VALUES (?,?,?,?,?,?,?,?)');
      insProd.run(`${safeId}-p1`, 'Agua Mineral 500ml', 2500, 50, 'bebidas', 'water_drop', 'bar', 1);
      insProd.run(`${safeId}-p2`, 'Bebida Isotónica', 3500, 40, 'bebidas', 'water_drop', 'bar', 1);
      insProd.run(`${safeId}-p3`, 'Café Clásico', 2000, 50, 'cafeteria', 'coffee', 'bar', 1);
      insProd.run(`${safeId}-p4`, 'Tostado Especial', 5000, 20, 'cafeteria', 'lunch_dining', 'cocina', 1);
    }

    db.prepare("INSERT OR IGNORE INTO caja_sesion (id, status) VALUES (1, 'cerrada')").run();
    console.log(`[MultiTenant DB] Base de datos para ${safeId} inicializada correctamente.`);
  }

  tenantDbs.set(safeId, db);
  return db;
}

/**
 * Retorna la lista de todos los tenants que tienen base de datos SQLite creada en disco.
 */
export function listTenantDatabases() {
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir);
  return files
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => f.replace('.sqlite', ''));
}

// Instancia por defecto para compatibilidad
const defaultDb = getDbForTenant('giovanni');
export default defaultDb;
