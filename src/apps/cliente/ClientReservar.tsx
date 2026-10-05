import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { useStore } from '../../store/useStore';
import { Icon } from '../../components/ui/Icon';

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

const SPACE_META: Record<string, { tag: string; blurb: string; img: string; capacity?: string }> = {
  quincho: {
    tag: 'EVENTOS',
    blurb: 'Disfruta de tu lugar en familia',
    img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    capacity: '70 personas',
  },
  padel: {
    tag: 'DEPORTES INTENSOS',
    blurb: 'Canchas vitradas',
    img: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80',
  },
  futbol: {
    tag: 'DEPORTES INTENSOS',
    blurb: 'Césped sintético',
    img: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
  salon: {
    tag: 'EVENTOS',
    blurb: 'El lugar ideal para tu evento',
    img: 'https://images.unsplash.com/photo-1519167758481-83f29da75953?w=800&q=80',
  },
  cancha: {
    tag: 'DEPORTES',
    blurb: 'Listo para jugar',
    img: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
  },
  tenis: {
    tag: 'DEPORTES',
    blurb: 'Cancha profesional',
    img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80',
  },
};

function metaFor(type: string) {
  return (
    SPACE_META[type] || {
      tag: 'ESPACIO',
      blurb: 'Reservá tu turno',
      img: 'https://images.unsplash.com/photo-1461896836934-ffe607ba3671?w=800&q=80',
    }
  );
}

function getAvailableHours(
  date: string,
  espacioId: string,
  reservations: { courtId?: string; date?: string; startTime: string }[]
) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const booked = new Set(
    reservations.filter((r) => r.courtId === espacioId && r.date === date).map((r) => r.startTime)
  );
  return ALL_HOURS.filter((h) => {
    if (booked.has(h)) return false;
    if (date < today) return false;
    if (date === today) {
      const [hh, mm] = h.split(':').map(Number);
      if (hh < currentHour) return false;
      if (hh === currentHour && mm <= currentMin) return false;
    }
    return true;
  });
}

export default function ClientReservar() {
  const { negocioId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const allEspacios = useEspaciosStore((s) => s.espacios);
  const espacios = useMemo(() => allEspacios.filter((e) => e.isActive), [allEspacios]);
  const updateStatus = useEspaciosStore((s) => s.updateStatus);
  const addReservation = useStore((s) => s.addReservation);
  const addClient = useStore((s) => s.addClient);
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
  const [paymentType, setPaymentType] = useState<'pendiente' | 'senado' | 'pagado'>('pendiente');
  const [senaAmount, setSenaAmount] = useState(0);
  const [personas, setPersonas] = useState(1);

  const espacio = espacios.find((e) => e.id === espacioId);
  const endHour = (() => {
    const [h, m] = startTime.split(':').map(Number);
    return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  })();

  const startHourNum = parseInt(startTime.split(':')[0], 10);
  const nightStart = config.nightStartHour ?? 18;
  const priceCfg = config.prices?.find((p) => p.courtId === espacioId);
  const isNight = startHourNum >= (priceCfg?.nightStartHour ?? nightStart);
  const basePrice = isNight
    ? (espacio?.precioNoche ?? priceCfg?.nightPrice ?? espacio?.precioHora ?? 15000)
    : (espacio?.precioDia ?? priceCfg?.dayPrice ?? espacio?.precioHora ?? 12000);
  const amount =
    espacio?.usaCapacidad && espacio?.precioPorPersona
      ? basePrice * Math.max(1, personas)
      : basePrice;

  // Cupos ocupados en ese turno (suma personas de reservas solapadas)
  const ocupadosEnTurno = espacio?.usaCapacidad
    ? reservations
        .filter(
          (r) =>
            (r.courtId === espacioId || (r as any).espacioId === espacioId) &&
            r.date === date &&
            r.startTime === startTime
        )
        .reduce((s, r) => s + ((r as any).personas || 1), 0)
    : 0;
  const cuposLibres = espacio?.usaCapacidad
    ? Math.max(0, (espacio.capacidad || 0) - ocupadosEnTurno)
    : null;

  const availableHours = espacioId ? getAvailableHours(date, espacioId, reservations) : [];

  useEffect(() => {
    if (searchParams.get('espacio')) setStep(2);
  }, [searchParams]);

  useEffect(() => {
    if (availableHours.length && !availableHours.includes(startTime)) {
      setStartTime(availableHours[0]);
    }
  }, [date, espacioId, availableHours.join(',')]);

  const dayPrice = (id: string) => {
    const p = config.prices?.find((x) => x.courtId === id);
    return p?.dayPrice ?? espacios.find((e) => e.id === id)?.precioHora ?? 12000;
  };
  const nightPrice = (id: string) => {
    const p = config.prices?.find((x) => x.courtId === id);
    return p?.nightPrice ?? Math.round((espacios.find((e) => e.id === id)?.precioHora || 12000) * 1.25);
  };

  const filtered = espacios.filter((e) => {
    if (filter === 'todos') return true;
    if (filter === 'recreativos') return ['quincho', 'salon'].includes(e.type);
    if (filter === 'deportes') return ['futbol', 'padel', 'tenis', 'cancha'].includes(e.type);
    return true;
  });

  const handleConfirm = () => {
    if (!espacioId || !name.trim() || !phone.trim()) return;
    let clientId = clients.find(
      (c) => c.phone === phone || c.name.toLowerCase() === name.toLowerCase()
    )?.id;
    if (!clientId) {
      addClient({ name, phone, isFrequent: false, isSanctioned: false });
      clientId = `cl${Date.now()}`;
    }
    const paid =
      paymentType === 'pagado' ? amount : paymentType === 'senado' ? senaAmount || Math.round(amount * 0.3) : 0;
    addReservation({
      courtId: espacioId,
      clientId,
      clientName: name,
      clientPhone: phone,
      date,
      startTime,
      endTime: endHour,
      paymentStatus: paymentType,
      paymentMethod: paymentType !== 'pendiente' ? 'transferencia' : undefined,
      amount,
      paidAmount: paid,
      ...(espacio?.usaCapacidad ? { personas } as any : {}),
    } as any);
    updateStatus(espacioId, 'reservada');
    setDone(true);
  };

  if (done) {
    return (
      <div className="p-6 text-center space-y-4 min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Icon name="check_circle" size={48} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-black">¡Reserva confirmada!</h2>
        <p className="text-slate-400 text-sm">
          {espacio?.name} · {date} · {startTime} – {endHour}
        </p>
        <button
          onClick={() => navigate(`/${negocioId}/mis-reservas`)}
          className="w-full py-3.5 rounded-2xl bg-amber-400 text-black font-bold"
        >
          Ver mis turnos
        </button>
        <button onClick={() => navigate(`/${negocioId}`)} className="text-slate-400 text-sm">
          Volver al inicio
        </button>
      </div>
    );
  }

  // STEP 1: Choose space - premium cards
  if (step === 1) {
    return (
      <div className="px-5 pt-6 pb-8">
        <div className="mb-5">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-3">
            Complejo premium ★★★★★
          </span>
          <h1 className="text-3xl font-black leading-tight tracking-tight mb-2">
            ELIGE TU
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-500">
              ESPACIO
            </span>
          </h1>
          <p className="text-slate-400 text-sm">
            Reservá las mejores instalaciones con tecnología de punta y servicios exclusivos.
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'recreativos', label: 'Recreativos' },
            { id: 'deportes', label: 'Deportes' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                filter === f.id
                  ? 'bg-amber-400 text-black'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}
            >
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {filtered.map((e) => {
            const m = metaFor(e.type);
            return (
              <div
                key={e.id}
                className="rounded-3xl overflow-hidden bg-[#14141c] border border-white/5"
              >
                <div className="relative h-44">
                  <img
                    src={e.imageUrl || m.img}
                    alt={e.name}
                    className="w-full h-full object-cover"
                    onError={(ev) => {
                      if (m.img && (ev.target as HTMLImageElement).src !== m.img) {
                        (ev.target as HTMLImageElement).src = m.img;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#14141c] via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-[9px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    DISPONIBLE HOY
                  </span>
                </div>
                <div className="p-4 -mt-2">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">{e.name}</h3>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        {m.tag}
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-amber-400/15 flex items-center justify-center">
                      <Icon name="emoji_events" className="text-amber-400" size={18} />
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{m.blurb}</p>
                  {m.capacity && (
                    <p className="text-[11px] text-amber-400 font-bold mb-3 uppercase tracking-wide">
                      Capacidad máx: {m.capacity}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-0.5">
                        <Icon name="light_mode" size={12} /> Diurno
                      </p>
                      <p className="font-black text-sm">{formatMoney(dayPrice(e.id))}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-0.5">
                        <Icon name="dark_mode" size={12} /> Nocturno
                      </p>
                      <p className="font-black text-sm">{formatMoney(nightPrice(e.id))}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEspacioId(e.id);
                      setStep(2);
                    }}
                    className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    RESERVAR AHORA <Icon name="arrow_forward" size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // STEP 2 & 3 - date/time/data
  return (
    <div className="p-5 space-y-5">
      <button
        onClick={() => (step === 2 ? setStep(1) : setStep(2))}
        className="text-sm text-amber-400 flex items-center gap-1 font-medium"
      >
        <Icon name="arrow_back" size={16} /> {espacio?.name || 'Volver'}
      </button>

      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-amber-400' : 'bg-white/10'}`}
          />
        ))}
      </div>

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-black">Fecha y horario</h2>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Horarios disponibles</label>
            <div className="grid grid-cols-4 gap-2">
              {availableHours.map((h) => (
                <button
                  key={h}
                  onClick={() => setStartTime(h)}
                  className={`py-2.5 rounded-xl text-sm font-medium ${
                    startTime === h
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/5 border border-white/10 text-slate-300'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
            {availableHours.length === 0 && (
              <p className="text-sm text-amber-400 mt-2">No hay horarios disponibles</p>
            )}
          </div>
          {espacio?.usaCapacidad && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <p className="text-sm font-medium">
                Cupos disponibles en este turno:{' '}
                <span className="text-amber-400 font-black">{cuposLibres}</span>
                {' / '}{espacio.capacidad}
              </p>
              <label className="text-xs text-slate-500">¿Cuántas personas?</label>
              <input
                type="number"
                min={1}
                max={cuposLibres ?? 99}
                value={personas}
                onChange={(e) => setPersonas(Math.min(Number(e.target.value) || 1, cuposLibres ?? 99))}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10"
              />
              {espacio.precioPorPersona && (
                <p className="text-xs text-slate-400">
                  {formatMoney(basePrice)} por persona × {personas}
                </p>
              )}
            </div>
          )}
          <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/20">
            <p className="text-sm">
              <strong>{espacio?.name}</strong> · {date} · {startTime} – {endHour}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Tarifa {isNight ? 'nocturna' : 'diurna'}
              {isNight ? ` (desde ${nightStart}hs)` : ''}
            </p>
            <p className="text-2xl font-black text-amber-400 mt-1">{formatMoney(amount)}</p>
          </div>
          <button
            onClick={() => setStep(3)}
            disabled={!availableHours.length}
            className="w-full py-3.5 rounded-2xl bg-amber-400 text-black font-bold disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-black">Tus datos</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre completo"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono"
            type="tel"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10"
          />
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm space-y-1">
            <p>
              <strong>Espacio:</strong> {espacio?.name}
            </p>
            <p>
              <strong>Fecha:</strong> {date}
            </p>
            <p>
              <strong>Horario:</strong> {startTime} – {endHour}
            </p>
            <p>
              <strong>Total:</strong> {formatMoney(amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2">Forma de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'pendiente', label: 'Pagar allá' },
                  { id: 'senado', label: 'Seña' },
                  { id: 'pagado', label: 'Pago total' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setPaymentType(opt.id);
                    if (opt.id === 'senado' && !senaAmount) setSenaAmount(Math.round(amount * 0.3));
                  }}
                  className={`py-2.5 rounded-xl text-xs font-medium ${
                    paymentType === opt.id
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {paymentType === 'senado' && (
              <input
                type="number"
                value={senaAmount}
                onChange={(e) => setSenaAmount(Number(e.target.value))}
                className="w-full mt-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10"
                placeholder="Monto seña"
              />
            )}
          </div>
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || !phone.trim()}
            className="w-full py-3.5 rounded-2xl bg-amber-400 text-black font-bold disabled:opacity-40"
          >
            Confirmar reserva
          </button>
        </div>
      )}
    </div>
  );
}
