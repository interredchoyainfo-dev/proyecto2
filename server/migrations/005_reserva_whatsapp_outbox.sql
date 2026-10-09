-- Outbox durable de avisos de reservas por WhatsApp, aislado por negocio.
CREATE TABLE IF NOT EXISTS reserva_notificaciones (
  id TEXT PRIMARY KEY,
  negocioId TEXT NOT NULL,
  reservaId TEXT NOT NULL,
  eventKey TEXT NOT NULL UNIQUE,
  destino TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  proveedorMensajeId TEXT,
  ultimoError TEXT,
  intentos INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  sentAt TEXT,
  FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reserva_notificaciones_negocio_estado
  ON reserva_notificaciones(negocioId, estado, createdAt);
