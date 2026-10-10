-- Estado de despacho de cada ítem para mantener cocina/mozos sincronizados en SQLite.
ALTER TABLE pedido_items ADD COLUMN enviadoCocina INTEGER NOT NULL DEFAULT 0;
