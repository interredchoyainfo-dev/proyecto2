-- 001_initial_schema.sql
-- Creación del esquema multi-negocio con aislamiento estricto por negocioId

CREATE TABLE IF NOT EXISTS negocios (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  logoUrl TEXT,
  subtitulo TEXT,
  descripcion TEXT,
  whatsapp TEXT,
  plan TEXT DEFAULT 'trial',
  themeJson TEXT,
  modulosJson TEXT,
  adminUser TEXT,
  adminPassword TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  negocioId TEXT,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  passwordHash TEXT,
  pinHash TEXT,
  rol TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(negocioId, email),
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS espacios (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'libre',
  precioHora REAL DEFAULT 0,
  precioDia REAL DEFAULT 0,
  precioNoche REAL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1,
  currentReservationId TEXT,
  imageUrl TEXT,
  description TEXT,
  usaCapacidad INTEGER DEFAULT 0,
  capacidad INTEGER DEFAULT 15,
  precioPorPersona INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  category TEXT,
  icon TEXT,
  destinoComanda TEXT DEFAULT 'cocina',
  disponible INTEGER DEFAULT 1,
  description TEXT,
  imageUrl TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mesas (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  numero INTEGER NOT NULL,
  sector TEXT,
  capacidad INTEGER DEFAULT 4,
  estado TEXT DEFAULT 'libre',
  mozoAsignadoId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  isFrequent INTEGER DEFAULT 0,
  isSanctioned INTEGER DEFAULT 0,
  totalReservations INTEGER DEFAULT 0,
  noShows INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reservas (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  espacioId TEXT NOT NULL,
  clientId TEXT,
  clientName TEXT NOT NULL,
  clientPhone TEXT,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  paymentStatus TEXT DEFAULT 'pendiente',
  paymentMethod TEXT DEFAULT 'efectivo',
  amount REAL DEFAULT 0,
  paidAmount REAL DEFAULT 0,
  senaPagada REAL DEFAULT 0,
  saldoPendiente REAL DEFAULT 0,
  personas INTEGER,
  qrToken TEXT,
  notes TEXT,
  estado TEXT DEFAULT 'confirmada',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE,
  FOREIGN KEY (espacioId) REFERENCES espacios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  tipoPedido TEXT NOT NULL DEFAULT 'mesa',
  mesaId TEXT,
  mozoId TEXT,
  clienteNombre TEXT,
  clienteTelefono TEXT,
  direccionDelivery TEXT,
  estado TEXT DEFAULT 'borrador',
  total REAL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id TEXT PRIMARY KEY,
  pedidoId TEXT NOT NULL,
  productoId TEXT,
  nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precioUnitario REAL NOT NULL,
  subtotal REAL NOT NULL,
  notas TEXT,
  estadoItem TEXT DEFAULT 'pendiente',
  destinoComanda TEXT,
  FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ofertas (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  descuentoPct REAL,
  descuentoMonto REAL,
  activo INTEGER DEFAULT 1,
  fechaDesde TEXT,
  fechaHasta TEXT,
  diasSemana TEXT,
  horaDesde TEXT,
  horaHasta TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS caja_sesiones (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierta',
  openedAt TEXT NOT NULL,
  closedAt TEXT,
  openingAmount REAL NOT NULL DEFAULT 0,
  closingAmount REAL,
  expectedAmount REAL,
  differenceAmount REAL,
  openedBy TEXT NOT NULL,
  closedBy TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS caja_movimientos (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  description TEXT NOT NULL,
  categoria TEXT,
  relatedPedidoId TEXT,
  relatedReservationId TEXT,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE,
  FOREIGN KEY (sessionId) REFERENCES caja_sesiones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pagos (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  pedidoId TEXT,
  reservaId TEXT,
  sessionId TEXT,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  productoId TEXT NOT NULL,
  tipo TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  motivo TEXT,
  pedidoId TEXT,
  usuarioId TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE,
  FOREIGN KEY (productoId) REFERENCES productos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  usuarioId TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entityId TEXT,
  beforeJson TEXT,
  afterJson TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS config (
  negocioId TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (negocioId, key),
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);

-- Índices de rendimiento y aislamiento por negocio
CREATE INDEX IF NOT EXISTS idx_usuarios_negocio ON usuarios(negocioId);
CREATE INDEX IF NOT EXISTS idx_espacios_negocio ON espacios(negocioId);
CREATE INDEX IF NOT EXISTS idx_espacios_negocio_active ON espacios(negocioId, isActive);
CREATE INDEX IF NOT EXISTS idx_productos_negocio ON productos(negocioId);
CREATE INDEX IF NOT EXISTS idx_mesas_negocio ON mesas(negocioId);
CREATE INDEX IF NOT EXISTS idx_clientes_negocio ON clientes(negocioId);
CREATE INDEX IF NOT EXISTS idx_reservas_negocio ON reservas(negocioId);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(negocioId, espacioId, date);
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio ON pedidos(negocioId);
CREATE INDEX IF NOT EXISTS idx_ofertas_negocio ON ofertas(negocioId);
CREATE INDEX IF NOT EXISTS idx_caja_sesiones_negocio ON caja_sesiones(negocioId, status);
CREATE INDEX IF NOT EXISTS idx_caja_movimientos_negocio ON caja_movimientos(negocioId, sessionId);
CREATE INDEX IF NOT EXISTS idx_pagos_negocio ON pagos(negocioId);
CREATE INDEX IF NOT EXISTS idx_inventario_negocio ON inventario_movimientos(negocioId, productoId);
CREATE INDEX IF NOT EXISTS idx_audit_negocio ON audit_log(negocioId);
