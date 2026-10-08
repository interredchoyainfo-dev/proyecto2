export function generateProductImageUrl(_name: string, _category?: string): string {
  // Ya no se autogeneran URLs externas pesadas que congelen la red/pc
  return '';
}

/** Descripciones típicas argentinas por categoría / nombre */
const DESC_BY_KEY: Record<string, string> = {
  papas: 'Bastón grueso, doble fritura y sal marina. Con alioli de la casa.',
  cheddar: 'Papas crocantes bañadas en cheddar derretido.',
  burger: 'Carne jugosa, pan brioche y los clásicos de siempre.',
  milanesa: 'Clásica milanesa argentina, bien crocante, al plato.',
  napolitana: 'Con salsa, jamón y mucho queso gratinado.',
  lomito: 'Sanguche de lomo completo, el clásico de la noche.',
  pizza: 'Masa al horno, muzzarella generosa al estilo argentino.',
  fideos: 'Pasta casera con la salsa que elijas.',
  cerveza: 'Bien fría, lista para acompañar el partido.',
  cafe: 'Café recién preparado, como en el barrio.',
  licuado: 'Fruta natural batida, fresco y cremoso.',
  ensalada: 'Fresca, completa y lista para la mesa.',
  tacos: 'Tortilla caliente con el relleno que más te gusta.',
  mojito: 'Menta fresca, lima y el toque justo de dulzor.',
  fernet: 'La medida de siempre, con Coca bien fría.',
};

export function suggestDescription(name: string, category?: string): string {
  const n = name.toLowerCase();
  for (const [key, desc] of Object.entries(DESC_BY_KEY)) {
    if (n.includes(key)) return desc;
  }
  if (category) {
    const cat = category.toLowerCase();
    if (cat.includes('papa')) return DESC_BY_KEY.papas;
    if (cat.includes('burger')) return DESC_BY_KEY.burger;
    if (cat.includes('cerveza')) return DESC_BY_KEY.cerveza;
    if (cat.includes('pizza')) return DESC_BY_KEY.pizza;
  }
  return `${name}. Preparado al momento, al estilo argentino.`;
}

export function ensureProductMedia<T extends { name: string; category?: string; description?: string; imageUrl?: string }>(
  p: T
): T {
  return {
    ...p,
    description: p.description || suggestDescription(p.name, p.category),
    imageUrl: p.imageUrl || '',
  };
}
