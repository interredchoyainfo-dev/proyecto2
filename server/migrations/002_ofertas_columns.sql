-- Migración 002: Nuevas columnas completas para ofertas y promociones
ALTER TABLE ofertas ADD COLUMN descuento REAL;
ALTER TABLE ofertas ADD COLUMN tipoDescuento TEXT DEFAULT 'porcentaje';
ALTER TABLE ofertas ADD COLUMN aplicaA TEXT DEFAULT 'todos';
ALTER TABLE ofertas ADD COLUMN categoria TEXT;
ALTER TABLE ofertas ADD COLUMN horaInicio TEXT;
ALTER TABLE ofertas ADD COLUMN horaFin TEXT;
ALTER TABLE ofertas ADD COLUMN fechaInicio TEXT;
ALTER TABLE ofertas ADD COLUMN fechaFin TEXT;
ALTER TABLE ofertas ADD COLUMN codigoCupon TEXT;
ALTER TABLE ofertas ADD COLUMN limiteUsos INTEGER;
ALTER TABLE ofertas ADD COLUMN usosActuales INTEGER DEFAULT 0;
