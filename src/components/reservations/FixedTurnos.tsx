import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { Icon } from '../ui/Icon';

type FixedTurn = {
  id: string;
  espacioId: string;
  clientName: string;
  clientPhone?: string;
  dayOfWeek: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  amount: number;
  notes?: string;
  activo: boolean | number;
};

const days = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

const today = () => new Date().toLocaleDateString('en-CA');

export function FixedTurnos() {
  const spaces = useEspaciosStore((s) => s.espacios).filter((s) => s.isActive);
  const spaceNames = useMemo(() => new Map(spaces.map((s) => [s.id, s.name])), [spaces]);
  const [turnos, setTurnos] = useState<FixedTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    espacioId: '',
    clientName: '',
    clientPhone: '',
    dayOfWeek: '4',
    startDate: today(),
    endDate: '',
    startTime: '22:00',
    endTime: '23:00',
    amount: '0',
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      setTurnos(await api.getTurnosFijos());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los turnos fijos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateForm = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.espacioId || !form.clientName.trim() || !form.endDate || form.endDate < form.startDate || form.startTime >= form.endTime) {
      setError('Completá los datos y verificá que la fecha y hora de finalización sean posteriores al inicio.');
      return;
    }
    setSaving(true);
    try {
      await api.createTurnoFijo({
        ...form,
        dayOfWeek: Number(form.dayOfWeek),
        amount: Number(form.amount || 0),
      });
      setForm((current) => ({
        ...current,
        clientName: '',
        clientPhone: '',
        notes: '',
        amount: '0',
      }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el turno fijo.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (turno: FixedTurn) => {
    try {
      await api.updateTurnoFijo(turno.id, { activo: !Boolean(turno.activo) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el turno.');
    }
  };

  const remove = async (turno: FixedTurn) => {
    if (!window.confirm(`¿Eliminar el turno fijo de ${turno.clientName}?`)) return;
    try {
      await api.deleteTurnoFijo(turno.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el turno.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-lg font-bold flex items-center gap-2"><Icon name="event_repeat" /> Turnos fijos recurrentes</h2>
        <p className="text-sm text-slate-500 mt-1">Reservá una franja semanal hasta una fecha de finalización. El sistema bloqueará las reservas que se superpongan.</p>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
          <label className="text-sm">Cancha / espacio
            <select required value={form.espacioId} onChange={(e) => updateForm('espacioId', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5">
              <option value="">Seleccionar espacio</option>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Cliente / equipo
            <input required value={form.clientName} onChange={(e) => updateForm('clientName', e.target.value)} placeholder="Ej.: Liga de los jueves" className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <label className="text-sm">Teléfono
            <input value={form.clientPhone} onChange={(e) => updateForm('clientPhone', e.target.value)} placeholder="Opcional" className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <label className="text-sm">Día de la semana
            <select value={form.dayOfWeek} onChange={(e) => updateForm('dayOfWeek', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5">
              {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Fecha de inicio
            <input type="date" required value={form.startDate} onChange={(e) => updateForm('startDate', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <label className="text-sm">Fecha de finalización
            <input type="date" required min={form.startDate} value={form.endDate} onChange={(e) => updateForm('endDate', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <label className="text-sm">Hora de inicio
            <input type="time" required value={form.startTime} onChange={(e) => updateForm('startTime', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <label className="text-sm">Hora de finalización
            <input type="time" required value={form.endTime} onChange={(e) => updateForm('endTime', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <label className="text-sm">Precio por turno ($)
            <input type="number" min="0" value={form.amount} onChange={(e) => updateForm('amount', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">Notas
            <input value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} placeholder="Liga, torneo, acuerdo de pago..." className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar turno fijo'}</button>
          </div>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-semibold">Turnos registrados</div>
        {loading ? <p className="p-5 text-sm text-slate-500">Cargando turnos…</p> : turnos.length === 0 ? <p className="p-5 text-sm text-slate-500">Todavía no hay turnos fijos.</p> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {turnos.map((t) => (
              <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.clientName} <span className="ml-2 text-xs font-normal text-slate-500">{Boolean(t.activo) ? 'Activo' : 'Pausado'}</span></p>
                  <p className="text-sm text-slate-500">{spaceNames.get(t.espacioId) || t.espacioId} · {days[t.dayOfWeek]?.label} · {t.startTime}–{t.endTime}</p>
                  <p className="text-xs text-slate-500">Del {t.startDate} al {t.endDate}{t.amount ? ` · $${Number(t.amount).toLocaleString('es-AR')} por turno` : ''}{t.notes ? ` · ${t.notes}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void toggle(t)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">{Boolean(t.activo) ? 'Pausar' : 'Reactivar'}</button>
                  <button onClick={() => void remove(t)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
