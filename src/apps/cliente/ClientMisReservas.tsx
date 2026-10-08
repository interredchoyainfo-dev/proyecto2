import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { Icon } from '../../components/ui/Icon';

const C = {
  surfaceCard: '#121722',
  surfaceContainer: '#1f1f25',
  surfaceContainerHigh: '#2a292f',
  surfaceBase: '#0A0A0F',
  accent: '#FBBF24',
  sportsPitch: '#10B981',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  onSurface: '#e4e1e9',
  error: '#ffb4ab',
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function ClientMisReservas() {
  const reservations = useStore((s) => s.reservations);
  const espacios = useEspaciosStore((s) => s.espacios);
  const [phone, setPhone] = useState('');
  const [searched, setSearched] = useState(false);

  const mine = searched
    ? reservations.filter(
        (r) =>
          r.clientPhone.replace(/\D/g, '').includes(phone.replace(/\D/g, '')) ||
          r.clientPhone === phone
      )
    : [];

  const getEspacioName = (id: string) => espacios.find((e) => e.id === id)?.name || id;

  const statusColor = (status: string) => {
    if (status === 'pagado') return { bg: 'rgba(16,185,129,0.15)', color: '#10B981' };
    if (status === 'senado') return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    return { bg: 'rgba(100,116,139,0.15)', color: '#64748B' };
  };

  return (
    <div className="p-4 space-y-6" style={{ color: C.onSurface }}>
      {/* Header */}
      <div className="flex flex-col gap-1 pt-2">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full self-start"
          style={{ background: C.surfaceContainerHigh }}
        >
          <Icon name="person" size={14} style={{ color: C.accent }} />
          <span className="font-extrabold uppercase tracking-widest" style={{ color: C.accent, fontSize: '10px' }}>
            MI CUENTA
          </span>
        </div>
        <h1 className="font-black uppercase tracking-tight text-[32px] leading-none mt-2" style={{ color: C.textPrimary }}>
          MIS <span style={{ color: C.accent }}>TURNOS</span>
        </h1>
        <p className="text-sm leading-relaxed max-w-sm" style={{ color: C.textSecondary }}>
          Ingresá el teléfono con el que reservaste para ver tus turnos y el estado de cada reserva.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="phone" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }} />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && phone.length >= 4 && setSearched(true)}
            placeholder="Ej: 11-2345-6789"
            type="tel"
            className="w-full pl-11 pr-4 py-3 rounded-xl focus:outline-none transition-colors"
            style={{ background: C.surfaceContainer, color: C.textPrimary, border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>
        <button
          onClick={() => setSearched(true)}
          disabled={phone.length < 4}
          className="px-5 py-3 rounded-xl font-black uppercase tracking-wider disabled:opacity-40 active:scale-[0.98] transition-all text-sm"
          style={{ background: C.accent, color: C.surfaceBase }}
        >
          Buscar
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-3">
          {mine.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: C.surfaceContainer }}
              >
                <Icon name="event_busy" size={48} style={{ color: C.textMuted, opacity: 0.4 }} />
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: C.textPrimary }}>Sin turnos encontrados</p>
                <p className="text-sm mt-1" style={{ color: C.textMuted }}>
                  No encontramos reservas con ese teléfono
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: C.textPrimary }}>{mine.length} turno{mine.length !== 1 ? 's' : ''} encontrado{mine.length !== 1 ? 's' : ''}</span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: C.sportsPitch }}
                />
              </div>
              {mine
                .slice()
                .reverse()
                .map((r) => {
                  const sc = statusColor(r.paymentStatus);
                  return (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl shadow-md"
                      style={{ background: C.surfaceCard, border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-col">
                          <p className="font-black text-lg uppercase tracking-tight" style={{ color: C.textPrimary }}>
                            {getEspacioName(r.espacioId || (r as any).courtId || '')}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Icon name="calendar_today" size={14} style={{ color: C.textMuted }} />
                            <p className="text-sm" style={{ color: C.textSecondary }}>
                              {r.date} · {r.startTime} – {r.endTime}
                            </p>
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          {r.paymentStatus}
                        </span>
                      </div>

                      <div
                        className="flex items-center justify-between pt-3"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon name="payments" size={16} style={{ color: C.textMuted }} />
                          <span className="text-sm" style={{ color: C.textSecondary }}>Total</span>
                        </div>
                        <span className="font-black text-lg" style={{ color: C.accent }}>
                          {formatMoney(r.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      )}

      {/* Club metrics */}
      {!searched && (
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: C.surfaceCard, border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-2">
            <Icon name="verified" size={20} style={{ color: C.accent }} />
            <span className="font-black uppercase tracking-tight text-[17px]" style={{ color: C.textPrimary }}>
              Beneficios del Socio
            </span>
          </div>
          {[
            { icon: 'check_circle', text: 'Confirmación instantánea de reservas', color: C.sportsPitch },
            { icon: 'bolt', text: 'Acceso prioritario a nuevos turnos', color: C.accent },
            { icon: 'star', text: 'Descuentos en gastronomía y eventos', color: C.textPrimary },
            { icon: 'local_offer', text: 'Promos exclusivas para clientes frecuentes', color: '#FBBF24' },
          ].map((b) => (
            <div key={b.text} className="flex items-center gap-3">
              <Icon name={b.icon} size={18} style={{ color: b.color }} />
              <span className="text-sm" style={{ color: C.textSecondary }}>{b.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
