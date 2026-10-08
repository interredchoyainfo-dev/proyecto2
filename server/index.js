import express from 'express';
import cors from 'cors';
import { getDbForTenant, listTenantDatabases, sanitizeTenantId } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Middleware Multi-Tenant: Aísla la base de datos de cada cliente/negocio
app.use((req, res, next) => {
  // El negocio se detecta por header 'x-negocio-id' o query param '?negocioId=...'
  let tenantId = req.headers['x-negocio-id'] || req.query.negocioId;
  if (!tenantId && req.path.startsWith('/api/tenants/')) {
    const parts = req.path.split('/');
    if (parts[3] && parts[3] !== 'init') {
      tenantId = parts[3];
    }
  }

  req.tenantId = sanitizeTenantId(tenantId || 'giovanni');
  try {
    req.db = getDbForTenant(req.tenantId);
    next();
  } catch (err) {
    console.error(`[MultiTenant API] Error conectando a base de datos de "${req.tenantId}":`, err);
    res.status(500).json({ error: `Error en base de datos para el negocio ${req.tenantId}` });
  }
});

// Helpers para formateo de datos
const rowProducto = (r) =>
  r && {
    id: r.id,
    name: r.name,
    price: r.price,
    stock: r.stock,
    category: r.category,
    icon: r.icon,
    destinoComanda: r.destinoComanda,
    disponible: !!r.disponible,
    description: r.description || '',
    imageUrl: r.imageUrl || '',
  };

const rowMesa = (r, tenantId = 'giovanni') =>
  r && {
    id: r.id,
    negocioId: tenantId,
    numero: r.numero,
    sector: r.sector,
    capacidad: r.capacidad,
    estado: r.estado,
    mozoAsignadoId: r.mozoAsignadoId || undefined,
  };

const rowEspacio = (r, tenantId = 'giovanni') =>
  r && {
    id: r.id,
    negocioId: tenantId,
    name: r.name,
    type: r.type,
    status: r.status,
    precioHora: r.precioHora,
    precioDia: r.precioDia ?? r.precioHora ?? 12000,
    precioNoche: r.precioNoche ?? (r.precioHora ? Math.round(r.precioHora * 1.25) : 15000),
    description: r.description || '',
    imageUrl: r.imageUrl || '',
    usaCapacidad: !!r.usaCapacidad,
    capacidad: r.capacidad !== null && r.capacidad !== undefined ? r.capacidad : 15,
    precioPorPersona: !!r.precioPorPersona,
    isActive: !!r.isActive,
    currentReservationId: r.currentReservationId || undefined,
  };

const rowCliente = (r) =>
  r && {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email || '',
    isFrequent: !!r.isFrequent,
    isSanctioned: !!r.isSanctioned,
    totalReservations: r.totalReservations || 0,
    noShows: r.noShows || 0,
    createdAt: r.createdAt,
  };

// ========== PRODUCTOS (AISLADOS POR NEGOCIO) ==========
app.get('/api/productos', (req, res) => {
  const rows = req.db.prepare('SELECT * FROM productos ORDER BY category, name').all();
  res.json(rows.map(rowProducto));
});

app.post('/api/productos', (req, res) => {
  const p = req.body;
  const id = p.id || String(Date.now()).slice(-8);
  req.db.prepare(
    `INSERT INTO productos (id,name,price,stock,category,icon,destinoComanda,disponible,description,imageUrl)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    p.name,
    p.price,
    p.stock ?? 0,
    p.category,
    p.icon || 'restaurant',
    p.destinoComanda || 'cocina',
    p.disponible !== false ? 1 : 0,
    p.description || '',
    p.imageUrl || ''
  );
  res.json(rowProducto(req.db.prepare('SELECT * FROM productos WHERE id=?').get(id)));
});

app.put('/api/productos/:id', (req, res) => {
  const p = req.body;
  const cur = req.db.prepare('SELECT * FROM productos WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  req.db.prepare(
    `UPDATE productos SET name=?, price=?, stock=?, category=?, icon=?, destinoComanda=?, disponible=?, description=?, imageUrl=? WHERE id=?`
  ).run(
    p.name ?? cur.name,
    p.price ?? cur.price,
    p.stock ?? cur.stock,
    p.category ?? cur.category,
    p.icon ?? cur.icon,
    p.destinoComanda ?? cur.destinoComanda,
    p.disponible !== undefined ? (p.disponible ? 1 : 0) : cur.disponible,
    p.description !== undefined ? p.description : cur.description,
    p.imageUrl !== undefined ? p.imageUrl : cur.imageUrl,
    req.params.id
  );
  res.json(rowProducto(req.db.prepare('SELECT * FROM productos WHERE id=?').get(req.params.id)));
});

app.delete('/api/productos/:id', (req, res) => {
  req.db.prepare('DELETE FROM productos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== MESAS (AISLADAS POR NEGOCIO) ==========
app.get('/api/mesas', (req, res) => {
  const rows = req.db.prepare('SELECT * FROM mesas ORDER BY numero').all();
  res.json(rows.map((r) => rowMesa(r, req.tenantId)));
});

app.post('/api/mesas', (req, res) => {
  const m = req.body;
  const id = m.id || `m${Date.now()}`;
  req.db.prepare(
    `INSERT INTO mesas (id,numero,sector,capacidad,estado,mozoAsignadoId) VALUES (?,?,?,?,?,?)`
  ).run(
    id,
    m.numero,
    m.sector || 'salon',
    m.capacidad ?? 4,
    m.estado || 'libre',
    m.mozoAsignadoId || null
  );
  res.json(rowMesa(req.db.prepare('SELECT * FROM mesas WHERE id=?').get(id), req.tenantId));
});

app.put('/api/mesas/:id', (req, res) => {
  const m = req.body;
  const cur = req.db.prepare('SELECT * FROM mesas WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  req.db.prepare(
    `UPDATE mesas SET numero=?, sector=?, capacidad=?, estado=?, mozoAsignadoId=? WHERE id=?`
  ).run(
    m.numero ?? cur.numero,
    m.sector ?? cur.sector,
    m.capacidad ?? cur.capacidad,
    m.estado ?? cur.estado,
    m.mozoAsignadoId !== undefined ? m.mozoAsignadoId : cur.mozoAsignadoId,
    req.params.id
  );
  res.json(rowMesa(req.db.prepare('SELECT * FROM mesas WHERE id=?').get(req.params.id), req.tenantId));
});

app.delete('/api/mesas/:id', (req, res) => {
  req.db.prepare('DELETE FROM mesas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== ESPACIOS / CANCHAS (AISLADOS POR NEGOCIO) ==========
app.get('/api/espacios', (req, res) => {
  const rows = req.db.prepare('SELECT * FROM espacios ORDER BY name').all();
  res.json(rows.map((r) => rowEspacio(r, req.tenantId)));
});

app.post('/api/espacios', (req, res) => {
  const e = req.body;
  const id = e.id || `c${Date.now()}`;
  const precioDia = e.precioDia ?? e.precioHora ?? 12000;
  const precioNoche = e.precioNoche ?? Math.round(precioDia * 1.25);
  req.db.prepare(
    `INSERT INTO espacios (id,name,type,status,precioHora,precioDia,precioNoche,description,imageUrl,usaCapacidad,capacidad,precioPorPersona,isActive,currentReservationId)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    e.name,
    e.type || 'padel',
    e.status || 'libre',
    precioDia,
    precioDia,
    precioNoche,
    e.description || '',
    e.imageUrl || '',
    e.usaCapacidad ? 1 : 0,
    e.capacidad ?? 15,
    e.precioPorPersona ? 1 : 0,
    e.isActive !== false ? 1 : 0,
    e.currentReservationId || null
  );
  res.json(rowEspacio(req.db.prepare('SELECT * FROM espacios WHERE id=?').get(id), req.tenantId));
});

app.put('/api/espacios/:id', (req, res) => {
  const e = req.body;
  const id = req.params.id;
  const cur = req.db.prepare('SELECT * FROM espacios WHERE id=?').get(id);

  const precioDia = e.precioDia ?? e.precioHora ?? (cur ? cur.precioDia : 12000);
  const precioNoche = e.precioNoche ?? (cur ? cur.precioNoche : Math.round(precioDia * 1.25));

  if (!cur) {
    // Si no existía previamente, lo insertamos como nuevo (upsert) para evitar que se pierdan cambios
    req.db.prepare(
      `INSERT INTO espacios (id,name,type,status,precioHora,precioDia,precioNoche,description,imageUrl,usaCapacidad,capacidad,precioPorPersona,isActive,currentReservationId)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      e.name || 'Espacio',
      e.type || 'padel',
      e.status || 'libre',
      precioDia,
      precioDia,
      precioNoche,
      e.description || '',
      e.imageUrl || '',
      e.usaCapacidad ? 1 : 0,
      e.capacidad ?? 15,
      e.precioPorPersona ? 1 : 0,
      e.isActive !== false ? 1 : 0,
      e.currentReservationId || null
    );
  } else {
    req.db.prepare(
      `UPDATE espacios SET
        name=?, type=?, status=?, precioHora=?, precioDia=?, precioNoche=?,
        description=?, imageUrl=?, usaCapacidad=?, capacidad=?, precioPorPersona=?,
        isActive=?, currentReservationId=?
       WHERE id=?`
    ).run(
      e.name ?? cur.name,
      e.type ?? cur.type,
      e.status ?? cur.status,
      precioDia,
      precioDia,
      precioNoche,
      e.description !== undefined ? e.description : cur.description,
      e.imageUrl !== undefined ? e.imageUrl : cur.imageUrl,
      e.usaCapacidad !== undefined ? (e.usaCapacidad ? 1 : 0) : cur.usaCapacidad,
      e.capacidad !== undefined ? e.capacidad : cur.capacidad,
      e.precioPorPersona !== undefined ? (e.precioPorPersona ? 1 : 0) : cur.precioPorPersona,
      e.isActive !== undefined ? (e.isActive ? 1 : 0) : cur.isActive,
      e.currentReservationId !== undefined ? e.currentReservationId : cur.currentReservationId,
      id
    );
  }
  res.json(rowEspacio(req.db.prepare('SELECT * FROM espacios WHERE id=?').get(id), req.tenantId));
});

app.delete('/api/espacios/:id', (req, res) => {
  req.db.prepare('DELETE FROM espacios WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== RESERVAS (AISLADAS POR NEGOCIO) ==========
app.get('/api/reservas', (req, res) => {
  const rows = req.db.prepare('SELECT * FROM reservas ORDER BY date, startTime').all();
  res.json(rows);
});

app.post('/api/reservas', (req, res) => {
  const r = req.body;
  const id = r.id || `res-${Date.now()}`;
  req.db.prepare(
    `INSERT INTO reservas (id,courtId,clientId,clientName,clientPhone,date,startTime,endTime,paymentStatus,paymentMethod,amount,paidAmount,notes,createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    r.courtId,
    r.clientId,
    r.clientName,
    r.clientPhone || '',
    r.date,
    r.startTime,
    r.endTime,
    r.paymentStatus || 'pendiente',
    r.paymentMethod || 'efectivo',
    r.amount ?? 0,
    r.paidAmount ?? 0,
    r.notes || '',
    r.createdAt || new Date().toISOString()
  );
  res.json(req.db.prepare('SELECT * FROM reservas WHERE id=?').get(id));
});

app.put('/api/reservas/:id', (req, res) => {
  const r = req.body;
  const cur = req.db.prepare('SELECT * FROM reservas WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  req.db.prepare(
    `UPDATE reservas SET courtId=?, clientId=?, clientName=?, clientPhone=?, date=?, startTime=?, endTime=?, paymentStatus=?, paymentMethod=?, amount=?, paidAmount=?, notes=? WHERE id=?`
  ).run(
    r.courtId ?? cur.courtId,
    r.clientId ?? cur.clientId,
    r.clientName ?? cur.clientName,
    r.clientPhone ?? cur.clientPhone,
    r.date ?? cur.date,
    r.startTime ?? cur.startTime,
    r.endTime ?? cur.endTime,
    r.paymentStatus ?? cur.paymentStatus,
    r.paymentMethod ?? cur.paymentMethod,
    r.amount ?? cur.amount,
    r.paidAmount ?? cur.paidAmount,
    r.notes ?? cur.notes,
    req.params.id
  );
  res.json(req.db.prepare('SELECT * FROM reservas WHERE id=?').get(req.params.id));
});

app.delete('/api/reservas/:id', (req, res) => {
  req.db.prepare('DELETE FROM reservas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== PEDIDOS & ITEMS (AISLADOS POR NEGOCIO) ==========
app.get('/api/pedidos', (req, res) => {
  const pedidos = req.db.prepare('SELECT * FROM pedidos ORDER BY createdAt DESC').all();
  const itemsStmt = req.db.prepare('SELECT * FROM pedido_items WHERE pedidoId=?');
  const result = pedidos.map((p) => ({
    ...p,
    items: itemsStmt.all(p.id),
  }));
  res.json(result);
});

app.post('/api/pedidos', (req, res) => {
  const p = req.body;
  const id = p.id || `ped-${Date.now()}`;
  const now = new Date().toISOString();
  req.db.prepare(
    `INSERT INTO pedidos (id,tipoPedido,mesaId,mozoId,clienteNombre,clienteTelefono,direccionDelivery,estado,total,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    p.tipoPedido || 'mesa',
    p.mesaId || null,
    p.mozoId || null,
    p.clienteNombre || null,
    p.clienteTelefono || null,
    p.direccionDelivery || null,
    p.estado || 'borrador',
    p.total ?? 0,
    p.createdAt || now,
    now
  );

  if (Array.isArray(p.items)) {
    const insItem = req.db.prepare(
      `INSERT INTO pedido_items (id,pedidoId,productoId,nombre,cantidad,precioUnitario,subtotal,notas,estadoItem,destinoComanda)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    for (const i of p.items) {
      insItem.run(
        i.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id,
        i.productoId,
        i.nombre,
        i.cantidad,
        i.precioUnitario,
        i.subtotal,
        i.notas || null,
        i.estadoItem || 'pendiente',
        i.destinoComanda || 'cocina'
      );
    }
  }

  const pedido = req.db.prepare('SELECT * FROM pedidos WHERE id=?').get(id);
  const items = req.db.prepare('SELECT * FROM pedido_items WHERE pedidoId=?').all(id);
  res.json({ ...pedido, items });
});

app.put('/api/pedidos/:id', (req, res) => {
  const p = req.body;
  const cur = req.db.prepare('SELECT * FROM pedidos WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });

  const now = new Date().toISOString();
  req.db.prepare(
    `UPDATE pedidos SET estado=?, total=?, clienteNombre=?, clienteTelefono=?, direccionDelivery=?, updatedAt=? WHERE id=?`
  ).run(
    p.estado ?? cur.estado,
    p.total ?? cur.total,
    p.clienteNombre ?? cur.clienteNombre,
    p.clienteTelefono ?? cur.clienteTelefono,
    p.direccionDelivery ?? cur.direccionDelivery,
    now,
    req.params.id
  );

  if (Array.isArray(p.items)) {
    req.db.prepare('DELETE FROM pedido_items WHERE pedidoId=?').run(req.params.id);
    const ins = req.db.prepare(
      `INSERT INTO pedido_items (id,pedidoId,productoId,nombre,cantidad,precioUnitario,subtotal,notas,estadoItem,destinoComanda)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    for (const i of p.items) {
      ins.run(
        i.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        req.params.id,
        i.productoId,
        i.nombre,
        i.cantidad,
        i.precioUnitario,
        i.subtotal,
        i.notas,
        i.estadoItem || 'pendiente',
        i.destinoComanda
      );
    }
  }

  const pedido = req.db.prepare('SELECT * FROM pedidos WHERE id=?').get(req.params.id);
  const items = req.db.prepare('SELECT * FROM pedido_items WHERE pedidoId=?').all(req.params.id);
  res.json({ ...pedido, items });
});

app.delete('/api/pedidos/:id', (req, res) => {
  req.db.prepare('DELETE FROM pedido_items WHERE pedidoId=?').run(req.params.id);
  req.db.prepare('DELETE FROM pedidos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== CLIENTES (AISLADOS POR NEGOCIO) ==========
app.get('/api/clientes', (req, res) => {
  res.json(req.db.prepare('SELECT * FROM clientes ORDER BY name').all().map(rowCliente));
});

app.post('/api/clientes', (req, res) => {
  const c = req.body;
  const id = c.id || `cl${Date.now()}`;
  req.db.prepare(
    `INSERT INTO clientes (id,name,phone,email,isFrequent,isSanctioned,totalReservations,noShows,createdAt)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    c.name,
    c.phone,
    c.email || '',
    c.isFrequent ? 1 : 0,
    c.isSanctioned ? 1 : 0,
    c.totalReservations || 0,
    c.noShows || 0,
    c.createdAt || new Date().toISOString()
  );
  res.json(rowCliente(req.db.prepare('SELECT * FROM clientes WHERE id=?').get(id)));
});

app.put('/api/clientes/:id', (req, res) => {
  const c = req.body;
  const cur = req.db.prepare('SELECT * FROM clientes WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  req.db.prepare(
    `UPDATE clientes SET name=?, phone=?, email=?, isFrequent=?, isSanctioned=?, totalReservations=?, noShows=? WHERE id=?`
  ).run(
    c.name ?? cur.name,
    c.phone ?? cur.phone,
    c.email !== undefined ? c.email : cur.email,
    c.isFrequent !== undefined ? (c.isFrequent ? 1 : 0) : cur.isFrequent,
    c.isSanctioned !== undefined ? (c.isSanctioned ? 1 : 0) : cur.isSanctioned,
    c.totalReservations !== undefined ? c.totalReservations : cur.totalReservations,
    c.noShows !== undefined ? c.noShows : cur.noShows,
    req.params.id
  );
  res.json(rowCliente(req.db.prepare('SELECT * FROM clientes WHERE id=?').get(req.params.id)));
});

app.delete('/api/clientes/:id', (req, res) => {
  req.db.prepare('DELETE FROM clientes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== OFERTAS (AISLADAS POR NEGOCIO) ==========
app.get('/api/ofertas', (req, res) => {
  const rows = req.db.prepare('SELECT * FROM ofertas ORDER BY createdAt DESC').all();
  res.json(
    rows.map((o) => ({
      ...o,
      activo: !!o.activo,
      diasSemana: o.diasSemana ? JSON.parse(o.diasSemana) : undefined,
    }))
  );
});

app.post('/api/ofertas', (req, res) => {
  const o = req.body;
  const id = o.id || `of${Date.now()}`;
  req.db.prepare(
    `INSERT INTO ofertas (id,titulo,descripcion,descuentoPct,descuentoMonto,activo,fechaDesde,fechaHasta,diasSemana,horaDesde,horaHasta,createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    o.titulo,
    o.descripcion,
    o.descuentoPct,
    o.descuentoMonto,
    o.activo !== false ? 1 : 0,
    o.fechaDesde,
    o.fechaHasta,
    o.diasSemana ? JSON.stringify(o.diasSemana) : null,
    o.horaDesde,
    o.horaHasta,
    new Date().toISOString()
  );
  res.json({ id, ...o });
});

app.put('/api/ofertas/:id', (req, res) => {
  const o = req.body;
  req.db.prepare(
    `UPDATE ofertas SET titulo=?, descripcion=?, descuentoPct=?, activo=?, fechaDesde=?, fechaHasta=?, diasSemana=?, horaDesde=?, horaHasta=? WHERE id=?`
  ).run(
    o.titulo,
    o.descripcion,
    o.descuentoPct,
    o.activo ? 1 : 0,
    o.fechaDesde,
    o.fechaHasta,
    o.diasSemana ? JSON.stringify(o.diasSemana) : null,
    o.horaDesde,
    o.horaHasta,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/ofertas/:id', (req, res) => {
  req.db.prepare('DELETE FROM ofertas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== CAJA (AISLADA POR NEGOCIO) ==========
app.get('/api/caja/sesion', (req, res) => {
  res.json(req.db.prepare('SELECT * FROM caja_sesion WHERE id=1').get());
});

app.put('/api/caja/sesion', (req, res) => {
  const s = req.body;
  req.db.prepare(
    `INSERT INTO caja_sesion (id, status, openedAt, openingAmount, closedAt, closingAmount, expectedAmount, openedBy, negocioId)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status=excluded.status,
       openedAt=excluded.openedAt,
       openingAmount=excluded.openingAmount,
       closedAt=excluded.closedAt,
       closingAmount=excluded.closingAmount,
       expectedAmount=excluded.expectedAmount,
       openedBy=excluded.openedBy,
       negocioId=excluded.negocioId`
  ).run(
    s.status || 'cerrada',
    s.openedAt || null,
    s.openingAmount ?? 0,
    s.closedAt || null,
    s.closingAmount ?? 0,
    s.expectedAmount ?? 0,
    s.openedBy || null,
    req.tenantId
  );
  res.json(req.db.prepare('SELECT * FROM caja_sesion WHERE id=1').get());
});

app.get('/api/caja/movimientos', (req, res) => {
  res.json(req.db.prepare('SELECT * FROM caja_movimientos ORDER BY createdAt DESC').all());
});

app.post('/api/caja/movimientos', (req, res) => {
  const m = req.body;
  const id = m.id || `mov-${Date.now()}`;
  req.db.prepare(
    `INSERT INTO caja_movimientos (id,type,amount,method,description,relatedPedidoId,createdAt) VALUES (?,?,?,?,?,?,?)`
  ).run(id, m.type, m.amount, m.method, m.description, m.relatedPedidoId, new Date().toISOString());
  res.json(req.db.prepare('SELECT * FROM caja_movimientos WHERE id=?').get(id));
});

// ========== TENANT MANAGEMENT & PROVISIONING ==========
app.post('/api/tenants/:id/init', (req, res) => {
  const tenantId = sanitizeTenantId(req.params.id);
  const tenantDb = getDbForTenant(tenantId);
  res.json({
    ok: true,
    tenantId,
    database: `${tenantId}.sqlite`,
    message: `Base de datos independiente para "${tenantId}" inicializada correctamente.`,
  });
});

app.get('/api/tenants', (_req, res) => {
  const databases = listTenantDatabases();
  res.json({ ok: true, databases });
});

// ========== HEALTH ==========
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: 'sqlite',
    tenantId: req.tenantId,
    database: `${req.tenantId}.sqlite`,
    time: new Date().toISOString(),
  });
});

// Snapshot completo del negocio actual (útil para sync inicial)
app.get('/api/sync', (req, res) => {
  const productos = req.db.prepare('SELECT * FROM productos').all().map(rowProducto);
  const mesas = req.db.prepare('SELECT * FROM mesas ORDER BY numero').all().map((r) => rowMesa(r, req.tenantId));
  const espacios = req.db.prepare('SELECT * FROM espacios').all().map((r) => rowEspacio(r, req.tenantId));
  const reservas = req.db.prepare('SELECT * FROM reservas').all();
  const clientes = req.db.prepare('SELECT * FROM clientes').all();
  const pedidosRaw = req.db.prepare('SELECT * FROM pedidos').all();
  const itemsStmt = req.db.prepare('SELECT * FROM pedido_items WHERE pedidoId=?');
  const pedidos = pedidosRaw.map((p) => ({
    ...p,
    items: itemsStmt.all(p.id),
  }));
  const ofertas = req.db.prepare('SELECT * FROM ofertas').all().map((o) => ({
    ...o,
    activo: !!o.activo,
    diasSemana: o.diasSemana ? JSON.parse(o.diasSemana) : undefined,
  }));
  const cajaSesion = req.db.prepare('SELECT * FROM caja_sesion WHERE id=1').get();
  const cajaMovimientos = req.db.prepare('SELECT * FROM caja_movimientos ORDER BY createdAt DESC').all();

  res.json({
    tenantId: req.tenantId,
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

app.listen(PORT, () => {
  console.log(`\n🗄️  Multi-Tenant API + SQLite (Multi-DB) → http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
