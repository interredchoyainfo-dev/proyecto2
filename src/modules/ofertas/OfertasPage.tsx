import { useState, useMemo } from 'react';
import { useOfertasStore, isOfertaVigente } from '../../store/useOfertasStore';
import { Icon } from '../../components/ui/Icon';

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export default function OfertasPage() {
  const ofertas = useOfertasStore((s) => s.ofertas);
  const addOferta = useOfertasStore((s) => s.addOferta);
  const deleteOferta = useOfertasStore((s) => s.deleteOferta);
  const toggleActivo = useOfertasStore((s) => s.toggleActivo);
  const activas = useMemo(() => ofertas.filter((o) => isOfertaVigente(o)), [ofertas]);

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [descuentoPct, setDescuentoPct] = useState(10);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [horaDesde, setHoraDesde] = useState('18:00');
  const [horaHasta, setHoraHasta] = useState('23:00');
  const [dias, setDias] = useState<number[]>([]);

  const toggleDia = (d: number) => {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleCreate = () => {
    if (!titulo.trim()) return;
    addOferta({
      titulo,
      descripcion,
      descuentoPct,
      activo: true,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      horaDesde: horaDesde || undefined,
      horaHasta: horaHasta || undefined,
      diasSemana: dias.length ? dias : undefined,
    });
    setTitulo('');
    setDescripcion('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ofertas y promociones</h1>
          <p className="text-slate-500 text-sm">
            {activas.length} oferta(s) vigentes ahora · {ofertas.length} total
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium"
        >
          <Icon name="add" />
          Nueva oferta
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h3 className="font-semibold">Crear oferta programada</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (ej: 2x1 Cervezas)"
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
            <input
              type="number"
              value={descuentoPct}
              onChange={(e) => setDescuentoPct(Number(e.target.value))}
              placeholder="% descuento"
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción"
              rows={2}
              className="sm:col-span-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 resize-none"
            />
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fecha desde</label>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fecha hasta</label>
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hora desde</label>
              <input type="time" value={horaDesde} onChange={(e) => setHoraDesde(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hora hasta</label>
              <input type="time" value={horaHasta} onChange={(e) => setHoraHasta(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-2 block">Días (vacío = todos)</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDia(i)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold ${
                    dias.includes(i) ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium">
              Guardar oferta
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-slate-500">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ofertas.map((o) => (
          <div
            key={o.id}
            className={`rounded-2xl border p-5 ${
              o.activo
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold">{o.titulo}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{o.descripcion}</p>
              </div>
              {o.descuentoPct != null && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold shrink-0">
                  {o.descuentoPct}% OFF
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 space-y-0.5 mb-3">
              {(o.fechaDesde || o.fechaHasta) && (
                <p>📅 {o.fechaDesde || '…'} → {o.fechaHasta || '…'}</p>
              )}
              {(o.horaDesde || o.horaHasta) && (
                <p>🕐 {o.horaDesde || '00:00'} – {o.horaHasta || '23:59'}</p>
              )}
              {o.diasSemana && o.diasSemana.length > 0 && (
                <p>📆 {o.diasSemana.map((d) => DAY_LABELS[d]).join(' · ')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleActivo(o.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  o.activo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {o.activo ? 'Activa' : 'Inactiva'}
              </button>
              <button
                onClick={() => deleteOferta(o.id)}
                className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
