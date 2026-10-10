-- El modelo de pedidos contempla asignación de repartidor; asegurar la columna en bases existentes.
ALTER TABLE pedidos ADD COLUMN repartidorId TEXT;
