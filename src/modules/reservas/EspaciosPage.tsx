import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { Icon } from '../../components/ui/Icon';
import type { Espacio } from '../../types';

const DEFAULT_TYPES = ['futbol', 'padel', 'tenis', 'quincho', 'salon', 'cancha', 'piscina', 'otro'];

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function EspaciosPage() {
  const { negocioId } = useParams();
  const currentNegocio = (negocioId || 'giovanni').toLowerCase();

  const allEspacios = useEspaciosStore((s) => s.espacios);
  const ensureTenantEspacios = useEspaciosStore((s) => s.ensureTenantEspacios);
  const addEspacio = useEspaciosStore((s) => s.addEspacio);
  const updateEspacio = useEspaciosStore((s) => s.updateEspacio);
  const deleteEspacio = useEspaciosStore((s) => s.deleteEspacio);
  const updateStatus = useEspaciosStore((s) => s.updateStatus);

  useEffect(() => {
    ensureTenantEspacios(currentNegocio);
  }, [currentNegocio, ensureTenantEspacios]);

  const espacios = useMemo(
    () => allEspacios.filter((e) => (e.negocioId || 'giovanni').toLowerCase() === currentNegocio),
    [allEspacios, currentNegocio]
  );

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Espacio | null>(null);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'futbol',
    precioDia: 12000,
    precioNoche: 15000,
    imageUrl: '',
    description: '',
    usaCapacidad: false,
    capacidad: 15,
    precioPorPersona: false,
    isActive: true,
  });

  const allTypes = Array.from(new Set([...DEFAULT_TYPES, ...customTypes, ...espacios.map((e) => e.type)]));

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      type: 'futbol',
      precioDia: 12000,
      precioNoche: 15000,
      imageUrl: '',
      description: '',
      usaCapacidad: false,
      capacidad: 15,
      precioPorPersona: false,
      isActive: true,
    });
    setShowForm(true);
  };

  const openEdit = (e: Espacio) => {
    setEditing(e);
    setForm({
      name: e.name,
      type: e.type,
      precioDia: e.precioDia ?? e.precioHora ?? 12000,
      precioNoche: e.precioNoche ?? Math.round((e.precioHora ?? 12000) * 1.25),
      imageUrl: e.imageUrl || '',
      description: e.description || '',
      usaCapacidad: !!e.usaCapacidad,
      capacidad: e.capacidad ?? 15,
      precioPorPersona: !!e.precioPorPersona,
      isActive: e.isActive,
    });
    setShowForm(true);
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      type: form.type as Espacio['type'],
      precioHora: form.precioDia,
      precioDia: form.precioDia,
      precioNoche: form.precioNoche,
      imageUrl: form.imageUrl || '',
      description: form.description,
      usaCapacidad: form.usaCapacidad,
      capacidad: form.usaCapacidad ? form.capacidad : undefined,
      precioPorPersona: form.usaCapacidad ? form.precioPorPersona : false,
      isActive: form.isActive,
      status: 'libre' as const,
      negocioId: currentNegocio,
    };
    if (editing) {
      updateEspacio(editing.id, payload);
    } else {
      addEspacio(payload as any);
    }
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Espacios / Canchas</h1>
          <p className="text-slate-500 text-sm">Precios día/noche, fotos, capacidad opcional</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium">
          <Icon name="add" /> Nuevo espacio
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold">{editing ? 'Editar espacio' : 'Nuevo espacio'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Sin foto</div>
                )}
              </div>
              <label className="block w-full py-2.5 rounded-xl bg-primary text-white text-sm text-center font-medium cursor-pointer hover:opacity-90">
                Subir foto
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" className="sm:col-span-2 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" rows={2} className="sm:col-span-2 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 resize-none text-sm" />
              <div>
                <label className="text-xs text-slate-500">Precio diurno</label>
                <input type="number" value={form.precioDia} onChange={(e) => setForm({ ...form, precioDia: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Precio nocturno</label>
                <input type="number" value={form.precioNoche} onChange={(e) => setForm({ ...form, precioNoche: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Tipo / categoría</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {allTypes.map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, type: t })} className={`px-2.5 py-1 rounded-full text-xs capitalize ${form.type === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Nuevo tipo" className="flex-1 px-3 py-2 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800" />
                  <button type="button" onClick={() => { const t = newType.trim().toLowerCase(); if (t) { setCustomTypes((p) => [...p, t]); setForm((f) => ({ ...f, type: t })); setNewType(''); } }} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-sm">+ Tipo</button>
                </div>
              </div>
              <div className="sm:col-span-2 p-3 rounded-xl border space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={form.usaCapacidad} onChange={(e) => setForm({ ...form, usaCapacidad: e.target.checked })} />
                  Habilitar capacidad (ej. piscina)
                </label>
                {form.usaCapacidad && (
                  <>
                    <div className="flex gap-3 items-center">
                      <label className="text-xs text-slate-500">Capacidad máx.</label>
                      <input type="number" value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: Number(e.target.value) })} className="w-24 px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-800" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.precioPorPersona} onChange={(e) => setForm({ ...form, precioPorPersona: e.target.checked })} />
                      Precio por persona (en vez de por turno completo)
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium">Guardar</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
            {editing && (
              <button onClick={() => { if (confirm('¿Eliminar?')) { deleteEspacio(editing.id); setShowForm(false); } }} className="px-4 py-2 text-red-500 ml-auto">Eliminar</button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {espacios.map((e) => (
          <div key={e.id} className="rounded-2xl overflow-hidden border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="aspect-video bg-slate-100 dark:bg-slate-800">
              {e.imageUrl ? (
                <img src={e.imageUrl} alt={e.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="stadium" size={40} className="text-slate-400" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold">{e.name}</h3>
                  <p className="text-xs text-slate-500 capitalize">{e.type}</p>
                </div>
                <select
                  value={e.status}
                  onChange={(ev) => updateStatus(e.id, ev.target.value as any)}
                  className="text-xs rounded-lg border px-2 py-1 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="libre">Libre</option>
                  <option value="reservada">Reservada</option>
                  <option value="en_juego">En juego</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <p className="text-slate-500">Día</p>
                  <p className="font-bold">{formatMoney(e.precioDia ?? e.precioHora ?? 0)}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <p className="text-slate-500">Noche</p>
                  <p className="font-bold">{formatMoney(e.precioNoche ?? 0)}</p>
                </div>
              </div>
              {e.usaCapacidad && (
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  Capacidad: {e.capacidad} · {e.precioPorPersona ? 'Por persona' : 'Por turno'}
                </p>
              )}
              <button onClick={() => openEdit(e)} className="mt-3 w-full py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800">
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
