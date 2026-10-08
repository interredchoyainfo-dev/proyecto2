import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Icon } from '../../components/ui/Icon';
import type { Product } from '../../types';
import {
  generateProductImageUrl,
  suggestDescription,
  ensureProductMedia,
} from '../../lib/productImages';
import { persistProducto, deleteProductoDb } from '../../components/DbSync';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

const DEFAULT_CATS = [
  'cafeteria', 'licuados', 'tortas', 'bebidas', 'cervezas', 'carnes',
  'lomos', 'burgers', 'pizzas', 'pastas', 'ensaladas', 'papas', 'tacos', 'tragos', 'otro',
];

export default function InventarioPage() {
  const products = useStore((s) => s.products);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');

  const [form, setForm] = useState({
    name: '',
    price: 0,
    stock: 0,
    category: 'bebidas',
    icon: 'restaurant',
    destinoComanda: 'cocina' as Product['destinoComanda'],
    disponible: true,
    description: '',
    imageUrl: '',
  });

  const allCats = Array.from(
    new Set([...DEFAULT_CATS, ...customCats, ...products.map((p) => p.category)])
  );
  const categories = ['all', ...allCats];

  const enriched = useMemo(() => products.map(ensureProductMedia), [products]);

  const filtered = enriched.filter((p) => {
    const catOk = category === 'all' || p.category === category;
    const q = search.toLowerCase();
    const searchOk =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.id.includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return catOk && searchOk;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      price: 0,
      stock: 10,
      category: 'bebidas',
      icon: 'restaurant',
      destinoComanda: 'cocina',
      disponible: true,
      description: '',
      imageUrl: '',
    });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    const e = ensureProductMedia(p);
    setEditing(p);
    setForm({
      name: e.name,
      price: e.price,
      stock: e.stock,
      category: e.category,
      icon: e.icon,
      destinoComanda: e.destinoComanda || 'cocina',
      disponible: e.disponible !== false,
      description: e.description || '',
      imageUrl: e.imageUrl || '',
    });
    setShowForm(true);
  };

  const onFileUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, imageUrl: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.name.trim()) return;
    const payload: Product = {
      id: editing?.id || String(Date.now()).slice(-6),
      name: form.name,
      price: form.price,
      stock: form.stock,
      category: form.category,
      icon: form.icon,
      destinoComanda: form.destinoComanda,
      disponible: form.disponible,
      description: form.description || suggestDescription(form.name, form.category),
      imageUrl: form.imageUrl || generateProductImageUrl(form.name, form.category),
    };

    if (editing) {
      useStore.setState((s) => ({
        products: s.products.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)),
      }));
      persistProducto(payload, false);
    } else {
      useStore.setState((s) => ({ products: [...s.products, payload] }));
      persistProducto(payload, true);
    }
    setShowForm(false);
  };

  const remove = (id: string) => {
    if (!confirm('¿Eliminar producto?')) return;
    useStore.setState((s) => ({ products: s.products.filter((p) => p.id !== id) }));
    deleteProductoDb(id);
  };

  const addCategory = () => {
    const c = newCat.trim().toLowerCase();
    if (c && !allCats.includes(c)) {
      setCustomCats((prev) => [...prev, c]);
      setForm((f) => ({ ...f, category: c }));
      setNewCat('');
    }
  };

  const generateAllMissing = () => {
    useStore.setState((s) => ({
      products: s.products.map((p) => ensureProductMedia(p)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventario / Bar</h1>
          <p className="text-slate-500 text-sm">{products.length} productos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={generateAllMissing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium"
          >
            <Icon name="auto_awesome" size={18} />
            Generar imágenes faltantes
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium"
          >
            <Icon name="add" /> Nuevo producto
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Image preview */}
            <div className="space-y-2">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium text-center cursor-pointer hover:opacity-90 flex items-center justify-center gap-2">
                  <Icon name="upload" size={16} />
                  Subir foto de producto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFileUpload(e.target.files?.[0] || null)}
                  />
                </label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="O pegar enlace directo de imagen..."
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre"
                className="sm:col-span-2 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción (estilo menú argentino)"
                rows={2}
                className="sm:col-span-2 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 resize-none text-sm"
              />
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                placeholder="Precio"
                className="px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
              />
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                placeholder="Stock"
                className="px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
              />
              <select
                value={form.destinoComanda || 'cocina'}
                onChange={(e) =>
                  setForm({ ...form, destinoComanda: e.target.value as Product['destinoComanda'] })
                }
                className="px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
              >
                <option value="cocina">Cocina</option>
                <option value="bar">Bar</option>
                <option value="ambos">Ambos</option>
              </select>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Categoría</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {allCats.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: c })}
                      className={`px-2.5 py-1 rounded-full text-xs capitalize ${
                        form.category === c
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="Nueva categoría"
                    className="flex-1 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addCategory}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-sm"
                  >
                    + Cat
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium">
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, descripción..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm"
          />
        </div>
        {categories.slice(0, 14).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs capitalize ${
              category === c
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 border'
            }`}
          >
            {c === 'all' ? 'Todos' : c}
          </button>
        ))}
      </div>

      {/* Grid visual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 relative">
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=60';
                }}
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-mono">
                {p.id}
              </span>
            </div>
            <div className="p-3">
              <h3 className="font-bold text-sm uppercase">{p.name}</h3>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{p.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-emerald-600">{formatMoney(p.price)}</span>
                <span className={`text-xs ${p.stock <= 5 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                  Stock: {p.stock}
                </span>
              </div>
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-500"
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
