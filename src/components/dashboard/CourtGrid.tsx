import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { useStore } from '../../store/useStore';
import { Icon } from '../ui/Icon';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function parseTodayTime(dateStr: string, time: string) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function fmtDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const statusStyle: Record<string, string> = {
  libre: 'border-emerald-500/40 bg-emerald-500/5',
  reservada: 'border-blue-500/40 bg-blue-500/5',
  en_juego: 'border-amber-500/50 bg-amber-500/10',
  mantenimiento: 'border-slate-500/40 bg-slate-500/5',
};

export function CourtGrid() {
  const { negocioId } = useParams();
  const currentNegocio = (negocioId || 'giovanni').toLowerCase();
  const getEspaciosByTenant = useEspaciosStore((s) => s.getEspaciosByTenant);
  const allEspacios = useEspaciosStore((s) => s.espacios);
  const espacios = useMemo(() => getEspaciosByTenant(currentNegocio).filter((e) => e.isActive), [allEspacios, currentNegocio, getEspaciosByTenant]);
  const getReservationsByTenant = useStore((s) => s.getReservationsByTenant);
  const allReservations = useStore((s) => s.reservations);
  const reservations = useMemo(() => getReservationsByTenant(currentNegocio), [allReservations, currentNegocio, getReservationsByTenant]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  const cards = useMemo(() => {
    return espacios.map((esp) => {
      const todayRes = reservations.filter(
        (r) =>
          (r.courtId === esp.id || r.espacioId === esp.id) &&
          r.date === today &&
          r.estado !== 'cancelada'
      );

      let current = todayRes.find((r) => {
        const start = parseTodayTime(r.date, r.startTime);
        const end = parseTodayTime(r.date, r.endTime);
        return now >= start && now < end;
      });

      let next = todayRes
        .filter((r) => parseTodayTime(r.date, r.startTime) > now)
        .sort(
          (a, b) =>
            parseTodayTime(a.date, a.startTime).getTime() -
            parseTodayTime(b.date, b.startTime).getTime()
        )[0];

      let phase: 'libre' | 'reservada' | 'en_juego' | 'mantenimiento' = esp.status;
      if (current) phase = 'en_juego';
      else if (next && parseTodayTime(next.date, next.startTime).getTime() - now.getTime() < 60 * 60 * 1000)
        phase = 'reservada';
      else if (!current) phase = esp.status === 'mantenimiento' ? 'mantenimiento' : 'libre';

      let elapsed = 0;
      let remaining = 0;
      if (current) {
        const start = parseTodayTime(current.date, current.startTime);
        const end = parseTodayTime(current.date, current.endTime);
        elapsed = now.getTime() - start.getTime();
        remaining = end.getTime() - now.getTime();
      }

      return { esp, current, next, phase, elapsed, remaining };
    });
  }, [espacios, reservations, tick]);

  return (
    <div>
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Icon name="stadium" className="text-emerald-500" />
        Estado de espacios · ahora
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(({ esp, current, next, phase, elapsed, remaining }) => (
          <div
            key={esp.id}
            className={`rounded-2xl border-2 p-4 ${statusStyle[phase] || statusStyle.libre}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-bold text-lg">{esp.name}</h3>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{esp.type}</p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  phase === 'en_juego'
                    ? 'bg-amber-500 text-white'
                    : phase === 'reservada'
                    ? 'bg-blue-500 text-white'
                    : phase === 'mantenimiento'
                    ? 'bg-slate-500 text-white'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {phase === 'en_juego' ? 'Jugando' : phase === 'reservada' ? 'Reservada' : phase}
              </span>
            </div>

            {current ? (
              <div className="space-y-1.5 text-sm">
                <p className="font-semibold">{current.clientName}</p>
                <p className="text-xs text-slate-500">
                  {current.startTime} → {current.endTime}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 p-2">
                    <p className="text-[10px] text-slate-500">Jugando hace</p>
                    <p className="font-mono font-bold text-amber-600">{fmtDuration(elapsed)}</p>
                  </div>
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 p-2">
                    <p className="text-[10px] text-slate-500">Tiempo restante</p>
                    <p className="font-mono font-bold text-emerald-600">{fmtDuration(remaining)}</p>
                  </div>
                </div>
                <div className="text-xs mt-2 space-y-0.5">
                  <p>
                    Total: <strong>{formatMoney(current.amount)}</strong>
                    {' · '}
                    Pagado: <strong>{formatMoney(current.paidAmount || 0)}</strong>
                  </p>
                  {(current.amount - (current.paidAmount || 0)) > 0 && (
                    <p className="text-red-500 font-medium">
                      Debe: {formatMoney(current.amount - (current.paidAmount || 0))}
                    </p>
                  )}
                  <p className="capitalize text-slate-500">Pago: {current.paymentStatus}</p>
                </div>
              </div>
            ) : next ? (
              <div className="text-sm">
                <p className="text-xs text-slate-500">Próximo turno</p>
                <p className="font-semibold">{next.clientName}</p>
                <p className="text-xs">
                  {next.startTime} – {next.endTime}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-2">Disponible ahora</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
