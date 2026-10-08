import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useConfig } from '../../core/services/ConfigContext';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { useStore } from '../../store/useStore';
import { Icon } from '../../components/ui/Icon';

const statusConfig = {
  libre: { label: 'LIBRE', bg: 'bg-emerald-500', text: 'text-emerald-400' },
  reservada: { label: 'RESERVADA', bg: 'bg-blue-500', text: 'text-blue-400' },
  en_juego: { label: 'EN JUEGO', bg: 'bg-amber-500', text: 'text-amber-400' },
  mantenimiento: { label: 'MANTENIMIENTO', bg: 'bg-red-500', text: 'text-red-400' },
};

export default function TVTurnos() {
  const { config } = useConfig();
  const { negocioId } = useParams();
  const currentNegocio = (negocioId || 'giovanni').toLowerCase();
  const tenantName = config?.negocio.nombre || 'Complejo Deportivo';
  const allEspacios = useEspaciosStore((s) => s.espacios);
  const espacios = useMemo(() => allEspacios.filter((e) => e.isActive && (e.negocioId || 'giovanni').toLowerCase() === currentNegocio), [allEspacios, currentNegocio]);
  const reservations = useStore((s) => s.reservations);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const today = now.toISOString().split('T')[0];
  const todayRes = reservations
    .filter((r) => r.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Icon name="sports_soccer" size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">{tenantName}</h1>
            <p className="text-slate-400 text-sm">Estado de canchas en vivo</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black tabular-nums">
            {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-slate-400 text-sm capitalize">
            {now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Courts grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
        {espacios.map((esp) => {
          const cfg = statusConfig[esp.status] || statusConfig.libre;
          const res = reservations.find((r) => r.id === esp.currentReservationId);
          return (
            <div
              key={esp.id}
              className="rounded-3xl border-2 border-white/10 bg-white/5 p-6 flex flex-col items-center text-center"
            >
              <div className={`w-4 h-4 rounded-full ${cfg.bg} mb-3 animate-pulse`} />
              <h2 className="text-xl font-black mb-1">{esp.name}</h2>
              <p className={`text-sm font-bold uppercase tracking-wider ${cfg.text}`}>
                {cfg.label}
              </p>
              {res && (
                <div className="mt-4 pt-4 border-t border-white/10 w-full">
                  <p className="font-semibold text-sm truncate">{res.clientName}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {res.startTime} – {res.endTime}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming reservations */}
      <div>
        <h3 className="text-lg font-bold text-slate-400 mb-4 uppercase tracking-wider">
          Próximos turnos hoy
        </h3>
        {todayRes.length === 0 ? (
          <p className="text-slate-600">No hay turnos programados para hoy</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayRes.slice(0, 6).map((r) => {
              const esp = espacios.find((e) => e.id === (r.espacioId || (r as any).courtId));
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
                >
                  <div className="w-16 h-16 rounded-xl bg-emerald-500/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-lg font-black text-emerald-400">{r.startTime}</span>
                    <span className="text-[10px] text-slate-500">{r.endTime}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{r.clientName}</p>
                    <p className="text-sm text-slate-400">{esp?.name || r.espacioId || (r as any).courtId}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
