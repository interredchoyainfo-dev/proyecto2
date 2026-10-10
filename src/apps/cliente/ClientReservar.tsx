import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { useStore } from '../../store/useStore';
import { api } from '../../lib/api';
import { Icon } from '../../components/ui/Icon';

const C = {
  surface: '#131318',
  surfaceCard: '#121722',
  surfaceContainer: '#1f1f25',
  surfaceContainerHigh: '#2a292f',
  surfaceContainerLowest: '#0e0e13',
  surfaceBase: '#0A0A0F',
  surfaceDim: '#131318',
  accent: '#FBBF24',
  primaryContainer: '#f59e0b',
  secondaryContainer: '#ec6a06',
  sportsPitch: '#10B981',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  onSurface: '#e4e1e9',
  onSurfaceVariant: '#d8c3ad',
  tertiary: '#ffc32d',
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

const ALL_HOURS = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00', '23:00',
];

const SPACE_META: Record<string, { tag: string; blurb: string; img: string; icon: string; accentColor: string; capacity?: string }> = {
  quincho: { tag: 'EVENTOS PRIVADOS', blurb: 'Disfruta en familia', img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80', icon: 'celebration', accentColor: '#FBBF24', capacity: '70 personas' },
  padel: { tag: 'DEPORTES INTENSOS', blurb: 'Canchas vidriadas panorámicas', img: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80', icon: 'sports_tennis', accentColor: '#f59e0b' },
  futbol: { tag: 'DEPORTES INTENSOS', blurb: 'Césped sintético premium', img: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80', icon: 'sports_soccer', accentColor: '#10B981' },
  salon: { tag: 'EVENTOS PRIVADOS', blurb: 'Disfruta en familia', img: 'https://images.unsplash.com/photo-1519167758481-83f29da75953?w=800&q=80', icon: 'celebration', accentColor: '#FBBF24', capacity: '70 personas' },
  cancha: { tag: 'DEPORTES INTENSOS', blurb: 'Césped sintético premium', img: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80', icon: 'sports_soccer', accentColor: '#10B981' },
  tenis: { tag: 'DEPORTES INTENSOS', blurb: 'Cancha profesional', img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80', icon: 'sports_tennis', accentColor: '#f59e0b' },
  voley: { tag: 'DEPORTES INTENSOS', blurb: 'Arena blanca sílice pura · 2 canchas pro', img: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80', icon: 'sports_volleyball', accentColor: '#FBBF24' },
  piscina: { tag: 'RELAX & NATACIÓN', blurb: 'Área climatizada', img: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80', icon: 'pool', accentColor: '#38bdf8' },
};

function metaFor(type: string) {
  return SPACE_META[type] || { tag: 'ESPACIO', blurb: 'Reservá tu turno', img: 'https://images.unsplash.com/photo-1461896836934-ffe607ba3671?w=800&q=80', icon: 'place', accentColor: '#FBBF24' };
}

function getAvailableHours(
  date: string,
  espacioId: string,
  reservations: { espacioId?: string; courtId?: string; date?: string; startTime: string; personas?: number; estado?: string; status?: string }[],
  capacidad?: number,
) {
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const activeForSpace = reservations.filter((r) =>
    (r.espacioId === espacioId || r.courtId === espacioId) &&
    r.date === date &&
    !['cancelada', 'cancelado', 'canceled', 'cancelled'].includes(String(r.estado || r.status || '').toLowerCase())
  );
  return ALL_HOURS.filter((h) => {
    if (date < today) return false;
    if (date === today) {
      const [hh, mm] = h.split(':').map(Number);
      if (hh < currentHour || (hh === currentHour && mm <= currentMin)) return false;
    }
    const bookingsAtHour = activeForSpace.filter((r) => r.startTime === h);
    if (capacidad && capacidad > 0) {
      const occupied = bookingsAtHour.reduce((sum, r) => sum + Math.max(1, Number(r.personas) || 1), 0);
      return occupied < capacidad;
    }
    return bookingsAtHour.length === 0;
  });
}

// Generate next 7 days for date strip
function getNextDays(n = 7) {
  const days = [];
  const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().split('T')[0],
      day: i === 0 ? 'HOY' : DAYS[d.getDay()],
      num: d.getDate(),
      month: MONTHS[d.getMonth()],
    });
  }
  return days;
}

export default function ClientReservar() {
  const { negocioId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentNegocio = (negocioId || 'giovanni').toLowerCase();
  const allEspacios = useEspaciosStore((s) => s.espacios);
  const espacios = useMemo(
    () => allEspacios.filter((e) => e.isActive && (e.negocioId || 'giovanni').toLowerCase() === currentNegocio),
    [allEspacios, currentNegocio]
  );
  const updateStatus = useEspaciosStore((s) => s.updateStatus);
  const clients = useStore((s) => s.clients);
  const config = useStore((s) => s.config);
  const reservations = useStore((s) => s.reservations);

  const [filter, setFilter] = useState('todos');
  const [step, setStep] = useState(1);
  const [espacioId, setEspacioId] = useState(searchParams.get('espacio') || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('18:00');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);
  const [savingReservation, setSavingReservation] = useState(false);
  const [reservationError, setReservationError] = useState('');
  const [whatsAppUrl, setWhatsAppUrl] = useState('');
  const [paymentType, setPaymentType] = useState<'pendiente' | 'senado' | 'pagado'>('pendiente');
  const [senaAmount, setSenaAmount] = useState(0);
  const [personas, setPersonas] = useState(1);
  const days = useMemo(() => getNextDays(7), []);

  const espacio = espacios.find((e) => e.id === espacioId);
  const endHour = (() => {
    const [h, m] = startTime.split(':').map(Number);
    return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  })();

  const startHourNum = parseInt(startTime.split(':')[0], 10);
  const nightStart = config.nightStartHour ?? 18;
  const priceCfg = config.prices?.find((p) => p.espacioId === espacioId || (p as any).courtId === espacioId);
  const isNight = startHourNum >= (priceCfg?.nightStartHour ?? nightStart);
  const basePrice = isNight
    ? (espacio?.precioNoche ?? priceCfg?.nightPrice ?? espacio?.precioHora ?? 15000)
    : (espacio?.precioDia ?? priceCfg?.dayPrice ?? espacio?.precioHora ?? 12000);
  const amount = espacio?.usaCapacidad && espacio?.precioPorPersona ? basePrice * Math.max(1, personas) : basePrice;

  const ocupadosEnTurno = espacio?.usaCapacidad
    ? reservations.filter((r) => (r.espacioId === espacioId || (r as any).courtId === espacioId) && r.date === date && r.startTime === startTime && !['cancelada', 'cancelado', 'canceled', 'cancelled'].includes(String((r as any).estado || (r as any).status || '').toLowerCase())).reduce((s, r) => s + Math.max(1, Number(r.personas) || 1), 0)
    : 0;
  const cuposLibres = espacio?.usaCapacidad ? Math.max(0, (espacio.capacidad || 0) - ocupadosEnTurno) : null;
  const availableHours = espacioId ? getAvailableHours(date, espacioId, reservations.filter((r) => (r.negocioId || 'giovanni').toLowerCase() === currentNegocio), espacio?.usaCapacidad ? espacio.capacidad : undefined) : [];

  const dayPrice = (id: string) => {
    const p = config.prices?.find((x) => x.espacioId === id || (x as any).courtId === id);
    return p?.dayPrice ?? espacios.find((e) => e.id === id)?.precioHora ?? 12000;
  };
  const nightPrice = (id: string) => {
    const p = config.prices?.find((x) => x.espacioId === id || (x as any).courtId === id);
    return p?.nightPrice ?? Math.round((espacios.find((e) => e.id === id)?.precioHora || 12000) * 1.25);
  };

  const filtered = espacios.filter((e) => {
    if (filter === 'todos') return true;
    if (filter === 'recreativos') return ['quincho', 'salon', 'piscina'].includes(e.type);
    if (filter === 'deportes') return ['futbol', 'padel', 'tenis', 'cancha', 'voley'].includes(e.type);
    return true;
  });

  useEffect(() => { if (searchParams.get('espacio')) setStep(2); }, [searchParams]);
  useEffect(() => {
    if (availableHours.length && !availableHours.includes(startTime)) setStartTime(availableHours[0]);
  }, [date, espacioId, availableHours.join(',')]);

  const handleConfirm = async () => {
    if (!espacioId || !name.trim() || !phone.trim() || savingReservation) return;
    setSavingReservation(true);
    setReservationError('');
    setWhatsAppUrl('');
    try {
      const existingClient = clients.find((c) => c.phone === phone || c.name.toLowerCase() === name.toLowerCase());
      const clientId = existingClient?.id || `cl${Date.now()}`;
      const paid = paymentType === 'pagado' ? amount : paymentType === 'senado' ? senaAmount || Math.round(amount * 0.3) : 0;
      const payload = {
        negocioId: currentNegocio,
        espacioId,
        clientId,
        clientName: name.trim(),
        clientPhone: phone.trim(),
        date,
        startTime,
        endTime: endHour,
        paymentStatus: paymentType,
        paymentMethod: paymentType !== 'pendiente' ? 'transferencia' : 'efectivo',
        amount,
        paidAmount: paid,
        senaPagada: paid,
        saldoPendiente: Math.max(0, amount - paid),
        personas: espacio?.usaCapacidad ? personas : undefined,
        estado: 'confirmada',
      };

      // No mostramos éxito hasta que el servidor confirme que guardó la reserva.
      const saved = await api.createPublicReserva(currentNegocio, payload);
      useStore.setState((state) => ({
        reservationPersistenceError: null,
        reservations: [
          ...state.reservations.filter((r) => r.id !== saved.id),
          { ...payload, ...saved, negocioId: currentNegocio },
        ],
      }));
      updateStatus(espacioId, 'reservada');

      try {
        const tenantResponse = await api.getPublicTenant(currentNegocio);
        const tenant = tenantResponse?.tenant;
        const rawPhone = String(tenant?.whatsapp || tenant?.whatsApp || tenant?.telefonoWhatsapp || '').replace(/\D/g, '');
        const normalizedPhone = rawPhone.startsWith('54')
          ? rawPhone
          : rawPhone.length === 10
            ? `549${rawPhone}`
            : rawPhone.replace(/^0+/, '');
        if (normalizedPhone) {
          const message = [
            `Hola, quiero confirmar/consultar mi reserva en ${tenant?.nombre || currentNegocio}.`,
            '',
            'DATOS DE LA RESERVA',
            `Código: ${saved.id}`,
            `Nombre: ${name.trim()}`,
            `Teléfono: ${phone.trim()}`,
            `Espacio: ${espacio?.name || espacioId}`,
            `Fecha: ${date}`,
            `Horario: ${startTime} a ${endHour}`,
            `Personas: ${espacio?.usaCapacidad ? personas : 'No informado'}`,
            `Importe total: ${formatMoney(amount)}`,
            `Seña abonada: ${formatMoney(paid)}`,
            `Saldo pendiente: ${formatMoney(Math.max(0, amount - paid))}`,
            `Estado de pago: ${paymentType}`,
          ].join('\n');
          setWhatsAppUrl(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`);
        }
      } catch (error) {
        console.warn('La reserva quedó guardada, pero no se pudo recuperar el WhatsApp del negocio:', error);
      }
      setDone(true);
    } catch (error) {
      console.error('No se pudo guardar la reserva:', error);
      setReservationError(error instanceof Error ? error.message : 'No se pudo guardar la reserva. Revisá la conexión e intentá nuevamente.');
    } finally {
      setSavingReservation(false);
    }
  };

  // ── DONE STATE ──
  if (done) {
    return (
      <div className="p-6 text-center space-y-5 min-h-[60vh] flex flex-col items-center justify-center" style={{ color: C.onSurface }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.18)' }}>
          <Icon name="check_circle" size={56} style={{ color: C.sportsPitch }} />
        </div>
        <h2 className="text-2xl font-black" style={{ color: C.textPrimary }}>¡Reserva confirmada!</h2>
        <p className="text-sm" style={{ color: C.textSecondary }}>
          {espacio?.name} · {date} · {startTime} – {endHour}
        </p>
        <p className="text-sm" style={{ color: C.textSecondary }}>
          La reserva quedó guardada en el sistema.
        </p>
        {whatsAppUrl && (
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-14 rounded-xl font-black text-lg uppercase tracking-wider flex items-center justify-center gap-2"
            style={{ background: '#25D366', color: '#fff' }}
          >
            <Icon name="whatsapp" size={22} /> Enviar reserva por WhatsApp
          </a>
        )}
        {!whatsAppUrl && (
          <p className="text-xs" style={{ color: C.textMuted }}>
            No hay un WhatsApp configurado para este negocio. La reserva sí quedó guardada.
          </p>
        )}
        <button
          onClick={() => navigate(`/${negocioId}/mis-reservas`)}
          className="w-full h-14 rounded-xl font-black text-lg uppercase tracking-wider"
          style={{ background: C.accent, color: C.surfaceBase }}
        >
          Ver mis turnos
        </button>
        <button onClick={() => navigate(`/${negocioId}`)} className="text-sm" style={{ color: C.textMuted }}>
          Volver al inicio
        </button>
      </div>
    );
  }

  // ── STEP 1: CHOOSE SPACE ──
  if (step === 1) {
    return (
      <div style={{ color: C.onSurface }}>
        {/* Header */}
        <header className="flex flex-col items-start gap-3 px-4 pt-4 pb-2">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full shadow-inner"
            style={{ background: C.surfaceContainer }}
          >
            <span style={{ color: C.accent, fontSize: '12px' }}>★★★★★</span>
            <span className="font-extrabold uppercase tracking-widest" style={{ color: C.accent, fontSize: '10px' }}>
              COMPLEJO PREMIUM
            </span>
          </div>
          <div>
            <h1 className="font-extrabold uppercase tracking-tight leading-none" style={{ fontSize: '32px', color: C.textPrimary }}>
              ELIGE TU <span style={{ color: C.accent }}>ESPACIO</span>
            </h1>
            <p className="text-sm mt-2 max-w-sm leading-relaxed" style={{ color: C.textSecondary }}>
              Reservá las mejores instalaciones con tecnología de punta y servicios exclusivos.
            </p>
          </div>
        </header>

        {/* Date strip */}
        <section className="px-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="uppercase font-bold tracking-wider" style={{ color: C.textMuted, fontSize: '10px' }}>
              SELECCIONAR FECHA
            </span>
            <button
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: C.accent }}
              onClick={() => {}}
            >
              <Icon name="calendar_month" size={16} />
              <span>Ver calendario</span>
            </button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
            {days.map((d) => {
              const active = d.iso === date;
              return (
                <button
                  key={d.iso}
                  onClick={() => setDate(d.iso)}
                  className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl transition-all active:scale-95"
                  style={
                    active
                      ? { background: C.accent, color: C.surfaceBase, boxShadow: '0 0 16px rgba(251,191,36,0.25)' }
                      : { background: C.surfaceContainer, color: C.textSecondary }
                  }
                >
                  <span className="font-bold uppercase" style={{ fontSize: '10px' }}>{d.day}</span>
                  <span className="font-extrabold leading-tight text-xl" style={{ color: active ? C.surfaceBase : C.textPrimary }}>{d.num}</span>
                  <span className="uppercase" style={{ fontSize: '10px', color: active ? C.surfaceBase : C.textMuted }}>{d.month}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter pills */}
        <section className="px-4 mb-4 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { id: 'todos', label: 'TODOS' },
            { id: 'deportes', label: 'DEPORTES' },
            { id: 'recreativos', label: 'RECREATIVOS' },
            { id: 'eventos', label: 'EVENTOS' },
          ].map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="flex-shrink-0 px-5 py-2.5 rounded-full font-extrabold uppercase tracking-wide transition-all"
                style={
                  active
                    ? { background: C.accent, color: C.surfaceBase, boxShadow: '0 2px 12px rgba(251,191,36,0.3)', fontSize: '10px' }
                    : { background: C.surfaceContainer, color: C.textSecondary, fontSize: '10px' }
                }
              >
                {f.label}
              </button>
            );
          })}
        </section>

        {/* Facility cards */}
        <div className="flex flex-col gap-5 px-4 pb-8">
          {filtered.map((e) => {
            const m = metaFor(e.type);
            return (
              <article
                key={e.id}
                className="flex flex-col w-full rounded-2xl overflow-hidden shadow-xl transition-all duration-300 active:scale-[0.99]"
                style={{ background: C.surfaceCard, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
              >
                {/* Image */}
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={e.imageUrl || m.img}
                    alt={e.name}
                    className="w-full h-full object-cover"
                    onError={(ev) => {
                      if (m.img && (ev.target as HTMLImageElement).src !== m.img)
                        (ev.target as HTMLImageElement).src = m.img;
                    }}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(18,23,34,1) 0%, transparent 50%, rgba(0,0,0,0.5) 100%)' }} />
                  {/* Status badge */}
                  <div
                    className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md"
                    style={{ background: 'rgba(19,19,24,0.8)' }}
                  >
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.sportsPitch }} />
                    <span className="font-extrabold uppercase tracking-wider" style={{ color: C.sportsPitch, fontSize: '10px' }}>
                      DISPONIBLE HOY
                    </span>
                  </div>
                  {/* Sport icon */}
                  <div
                    className="absolute top-3 right-3 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center shadow-md"
                    style={{ background: 'rgba(19,19,24,0.8)', color: C.accent }}
                  >
                    <Icon name={m.icon} size={18} />
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-0.5">
                      <h2 className="font-extrabold uppercase tracking-tight text-[22px]" style={{ color: C.textPrimary }}>
                        {e.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase" style={{ color: C.accent, fontSize: '10px' }}>{m.tag}</span>
                        <span style={{ color: C.textMuted, fontSize: '10px' }}>•</span>
                        <span className="text-xs" style={{ color: C.textSecondary }}>{m.blurb}</span>
                      </div>
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: C.surfaceContainerHigh, color: C.accent }}
                    >
                      <Icon name="emoji_events" size={20} />
                    </div>
                  </div>

                  {/* Capacity */}
                  {m.capacity && (
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit"
                      style={{ background: 'rgba(42,41,47,0.6)' }}
                    >
                      <Icon name="reduce_capacity" size={16} style={{ color: C.accent }} />
                      <span className="font-extrabold uppercase" style={{ color: C.accent, fontSize: '10px' }}>
                        CAPACIDAD MÁX: {m.capacity}
                      </span>
                    </div>
                  )}

                  {/* Pricing */}
                  <div
                    className="grid grid-cols-2 gap-2.5 p-2.5 rounded-xl"
                    style={{ background: C.surfaceContainerLowest }}
                  >
                    {[
                      { label: 'Diurno', icon: 'wb_sunny', price: dayPrice(e.id), iconColor: C.tertiary },
                      { label: 'Nocturno', icon: 'bedtime', price: nightPrice(e.id), iconColor: C.accent },
                    ].map((t) => (
                      <div
                        key={t.label}
                        className="flex flex-col p-2 rounded-lg"
                        style={{ background: 'rgba(31,31,37,0.5)' }}
                      >
                        <div className="flex items-center gap-1" style={{ color: C.textMuted }}>
                          <Icon name={t.icon} size={15} style={{ color: t.iconColor }} />
                          <span className="uppercase font-bold" style={{ fontSize: '10px' }}>{t.label}</span>
                        </div>
                        <span className="font-extrabold text-[17px] mt-1" style={{ color: C.textPrimary }}>
                          {formatMoney(t.price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => { setEspacioId(e.id); setStep(2); }}
                    className="w-full h-12 rounded-xl font-extrabold uppercase text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    style={{ background: C.textPrimary, color: C.surfaceBase }}
                  >
                    <span>RESERVAR AHORA</span>
                    <Icon name="arrow_forward" size={20} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Bottom trust footer */}
        <footer
          className="mx-4 mb-6 p-4 rounded-2xl flex items-center gap-3"
          style={{ background: 'rgba(31,31,37,0.8)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.1)', color: C.accent }}
          >
            <Icon name="verified" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[17px]" style={{ color: C.textPrimary }}>Servicios Incluidos</span>
            <span className="text-xs" style={{ color: C.textSecondary }}>
              Vestuarios climatizados, estacionamiento privado y bar tercer tiempo.
            </span>
          </div>
        </footer>
      </div>
    );
  }

  // ── STEPS 2 & 3 ──
  return (
    <div className="p-4 space-y-5" style={{ color: C.onSurface }}>
      <button
        onClick={() => (step === 2 ? setStep(1) : setStep(2))}
        className="flex items-center gap-1 font-medium"
        style={{ color: C.accent }}
      >
        <Icon name="arrow_back" size={16} />
        {espacio?.name || 'Volver'}
      </button>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full"
            style={{ background: step >= s ? C.accent : 'rgba(255,255,255,0.08)' }}
          />
        ))}
      </div>

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-black" style={{ color: C.textPrimary }}>Fecha y horario</h2>

          {/* Date chips */}
          <div>
            <span className="text-xs mb-2 block" style={{ color: C.textMuted }}>Seleccioná la fecha</span>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {getNextDays(7).map((d) => {
                const active = d.iso === date;
                return (
                  <button
                    key={d.iso}
                    onClick={() => setDate(d.iso)}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl transition-all active:scale-95"
                    style={active ? { background: C.accent, color: C.surfaceBase } : { background: C.surfaceContainer, color: C.textSecondary }}
                  >
                    <span className="font-bold uppercase" style={{ fontSize: '10px' }}>{d.day}</span>
                    <span className="font-extrabold text-xl leading-tight" style={{ color: active ? C.surfaceBase : C.textPrimary }}>{d.num}</span>
                    <span className="uppercase" style={{ fontSize: '10px', color: active ? C.surfaceBase : C.textMuted }}>{d.month}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hours */}
          <div>
            <span className="text-xs mb-1.5 block" style={{ color: C.textMuted }}>Horarios disponibles</span>
            <div className="grid grid-cols-4 gap-2">
              {availableHours.map((h) => (
                <button
                  key={h}
                  onClick={() => setStartTime(h)}
                  className="py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={
                    startTime === h
                      ? { background: C.accent, color: C.surfaceBase }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: C.onSurfaceVariant }
                  }
                >
                  {h}
                </button>
              ))}
            </div>
            {availableHours.length === 0 && (
              <p className="text-sm mt-2" style={{ color: C.accent }}>No hay horarios disponibles</p>
            )}
          </div>

          {espacio?.usaCapacidad && (
            <div className="p-4 rounded-2xl space-y-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-sm font-medium" style={{ color: C.textPrimary }}>
                Cupos disponibles: <span className="font-black" style={{ color: C.accent }}>{cuposLibres}</span> / {espacio.capacidad}
              </p>
              <label className="text-xs" style={{ color: C.textMuted }}>¿Cuántas personas?</label>
              <input
                type="number" min={1} max={cuposLibres ?? 99} value={personas}
                onChange={(e) => setPersonas(Math.min(Number(e.target.value) || 1, cuposLibres ?? 99))}
                className="w-full px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.textPrimary }}
              />
            </div>
          )}

          {/* Summary */}
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
          >
            <p className="text-sm font-semibold" style={{ color: C.textPrimary }}>
              <strong>{espacio?.name}</strong> · {date} · {startTime} – {endHour}
            </p>
            <p className="text-xs mt-1" style={{ color: C.textMuted }}>
              Tarifa {isNight ? `nocturna (desde ${nightStart}hs)` : 'diurna'}
            </p>
            <p className="text-2xl font-black mt-1" style={{ color: C.accent }}>{formatMoney(amount)}</p>
          </div>

          <button
            onClick={() => setStep(3)}
            disabled={!availableHours.length}
            className="w-full h-14 rounded-xl font-black text-lg uppercase tracking-wider disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background: C.accent, color: C.surfaceBase }}
          >
            Continuar
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-black" style={{ color: C.textPrimary }}>Tus datos</h2>

          {[
            { value: name, onChange: (v: string) => setName(v), placeholder: 'Nombre completo', type: 'text' },
            { value: phone, onChange: (v: string) => setPhone(v), placeholder: 'Teléfono', type: 'tel' },
          ].map((f, i) => (
            <input
              key={i}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              type={f.type}
              className="w-full px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.textPrimary }}
            />
          ))}

          {/* Summary */}
          <div
            className="p-4 rounded-2xl text-sm space-y-1"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {[
              ['Espacio', espacio?.name],
              ['Fecha', date],
              ['Horario', `${startTime} – ${endHour}`],
              ['Total', formatMoney(amount)],
            ].map(([label, val]) => (
              <p key={label} style={{ color: C.onSurface }}>
                <strong>{label}:</strong>{' '}
                <span style={label === 'Total' ? { color: C.accent, fontWeight: 900 } : {}}>{val}</span>
              </p>
            ))}
          </div>

          {/* Payment type */}
          <div>
            <p className="text-xs mb-2" style={{ color: C.textMuted }}>Forma de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'pendiente', label: 'Pagar allá' },
                { id: 'senado', label: 'Seña' },
                { id: 'pagado', label: 'Pago total' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setPaymentType(opt.id); if (opt.id === 'senado' && !senaAmount) setSenaAmount(Math.round(amount * 0.3)); }}
                  className="py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={paymentType === opt.id ? { background: C.accent, color: C.surfaceBase } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.onSurface }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {paymentType === 'senado' && (
              <input
                type="number" value={senaAmount}
                onChange={(e) => setSenaAmount(Number(e.target.value))}
                className="w-full mt-2 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.textPrimary }}
                placeholder="Monto seña"
              />
            )}
          </div>

          {reservationError && (
            <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">
              {reservationError}
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || !phone.trim() || savingReservation}
            className="w-full h-14 rounded-xl font-black text-lg uppercase tracking-wider disabled:opacity-40 active:scale-[0.98] transition-all"
            style={{ background: C.accent, color: C.surfaceBase }}
          >
            {savingReservation ? 'Guardando reserva…' : 'Confirmar reserva'}
          </button>
        </div>
      )}
    </div>
  );
}
