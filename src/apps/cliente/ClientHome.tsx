import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useConfig } from '../../core/services/ConfigContext';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { useOfertasStore, isOfertaVigente } from '../../store/useOfertasStore';
import { Icon } from '../../components/ui/Icon';

// Design tokens from reference
const C = {
  surface: '#131318',
  surfaceCard: '#121722',
  surfaceContainer: '#1f1f25',
  surfaceContainerHigh: '#2a292f',
  surfaceContainerHighest: '#35343a',
  surfaceContainerLowest: '#0e0e13',
  surfaceBase: '#0A0A0F',
  surfaceElevated: '#1A202E',
  accent: '#FBBF24',
  primary: '#ffc174',
  primaryContainer: '#f59e0b',
  secondaryContainer: '#ec6a06',
  sportsPitch: '#10B981',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  onSurface: '#e4e1e9',
  onSurfaceVariant: '#d8c3ad',
  actionViolet: '#6D28D9',
  error: '#ffb4ab',
  errorContainer: '#93000a',
};

const SPACE_META: Record<string, { tag: string; blurb: string; img: string; accentColor: string }> = {
  quincho: {
    tag: 'SOCIAL & FESTEJOS',
    blurb: 'Asadores premium, vajilla y sonido profesional',
    accentColor: '#FBBF24',
    img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  },
  padel: {
    tag: 'DEPORTES INTENSOS',
    blurb: 'Canchas vidriadas panorámicas · Césped azul WPT',
    accentColor: '#f59e0b',
    img: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80',
  },
  futbol: {
    tag: 'DEPORTES INTENSOS',
    blurb: 'Césped FIFA Forbex 50mm con caucho cryo',
    accentColor: '#10B981',
    img: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
  salon: {
    tag: 'SOCIAL & FESTEJOS',
    blurb: 'Asadores premium, vajilla y sonido profesional',
    accentColor: '#FBBF24',
    img: 'https://images.unsplash.com/photo-1519167758481-83f29da75953?w=800&q=80',
  },
  cancha: {
    tag: 'DEPORTES INTENSOS',
    blurb: 'Césped sintético premium',
    accentColor: '#10B981',
    img: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
  },
  tenis: {
    tag: 'DEPORTES INTENSOS',
    blurb: 'Cancha profesional',
    accentColor: '#f59e0b',
    img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80',
  },
  voley: {
    tag: 'DEPORTES INTENSOS',
    blurb: 'Arena blanca sílice pura · 2 canchas pro',
    accentColor: '#FBBF24',
    img: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
  },
  piscina: {
    tag: 'RELAX & RECUPERACIÓN',
    blurb: 'Área climatizada con solárium · Vestuarios VIP',
    accentColor: '#38bdf8',
    img: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80',
  },
};

function metaFor(type: string) {
  return (
    SPACE_META[type] || {
      tag: 'ESPACIO',
      blurb: 'Reservá tu turno',
      accentColor: '#FBBF24',
      img: 'https://images.unsplash.com/photo-1461896836934-ffe607ba3671?w=800&q=80',
    }
  );
}

export default function ClientHome() {
  const { negocioId } = useParams();
  const { config } = useConfig();
  const tenantName = config?.negocio.nombre || 'Complejo Deportivo';
  const currentNegocio = (negocioId || 'giovanni').toLowerCase();
  const allEspacios = useEspaciosStore((s) => s.espacios);
  const espacios = useMemo(
    () => allEspacios.filter((e) => e.isActive && (e.negocioId || 'giovanni').toLowerCase() === currentNegocio),
    [allEspacios, currentNegocio]
  );
  const allOfertas = useOfertasStore((s) => s.ofertas);
  const ofertas = useMemo(() => allOfertas.filter((o) => isOfertaVigente(o)), [allOfertas]);
  const [weather, setWeather] = useState({ temp: 20, desc: 'Parcialmente nublado', hum: 65, code: 2 });

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-34.6&longitude=-58.4&current=temperature_2m,relative_humidity_2m,weather_code'
    )
      .then((r) => r.json())
      .then((d) => {
        const code = d.current?.weather_code ?? 2;
        const descs: Record<number, string> = {
          0: 'Despejado',
          1: 'Mayormente despejado',
          2: 'Parcialmente nublado',
          3: 'Nublado',
          61: 'Lluvia',
          63: 'Lluvia intensa',
          80: 'Chaparrones',
        };
        setWeather({
          temp: Math.round(d.current?.temperature_2m ?? 20),
          desc: descs[code] || 'Parcialmente nublado',
          hum: d.current?.relative_humidity_2m ?? 65,
          code,
        });
      })
      .catch(() => {});
  }, []);

  const weatherIcon = weather.code === 0 ? 'wb_sunny' : weather.code >= 61 ? 'rainy' : 'partly_cloudy_day';

  return (
    <div style={{ background: C.surface, color: C.onSurface }}>
      {/* ── HERO ── */}
      <section className="relative px-4 pt-5 pb-8 overflow-hidden">
        {/* Ambient glows */}
        <div
          className="absolute -top-16 -right-12 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(245,158,11,0.12)' }}
        />
        <div
          className="absolute top-24 -left-16 w-48 h-48 rounded-full blur-2xl pointer-events-none"
          style={{ background: 'rgba(236,106,6,0.08)' }}
        />

        <div className="relative z-10 flex flex-col gap-3">
          {/* Premium badge */}
          <div
            className="inline-flex items-center gap-2 self-start py-1 px-3 rounded-full backdrop-blur-md shadow-sm"
            style={{ background: 'rgba(42,41,47,0.85)' }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: C.accent }}
            />
            <span
              className="font-extrabold uppercase tracking-widest"
              style={{ color: C.accent, fontSize: '10px', letterSpacing: '0.1em' }}
            >
              Complejo Deportivo Premium
            </span>
          </div>

          {/* Hero headline */}
          <div className="flex flex-col mt-1">
            <h1
              className="uppercase font-black tracking-tight leading-tight"
              style={{ fontSize: '30px', lineHeight: '34px', letterSpacing: '-0.02em', color: C.textPrimary }}
            >
              {tenantName}
            </h1>
            <span
              className="uppercase font-black tracking-tight leading-none mt-1"
              style={{
                fontSize: '26px',
                lineHeight: '30px',
                letterSpacing: '-0.02em',
                background: `linear-gradient(to right, ${C.accent}, ${C.primaryContainer}, ${C.secondaryContainer})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {(config?.negocio as any)?.subtitulo || 'TU LUGAR DEPORTIVO'}
            </span>
          </div>

          {/* Subtitle */}
          <p className="text-sm max-w-sm leading-relaxed mt-1" style={{ color: C.textSecondary }}>
            {config?.negocio.descripcion || 'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha.'}
          </p>

          {/* Weather card */}
          <div
            className="mt-2 w-full rounded-xl p-3 flex items-center justify-between shadow-md backdrop-blur-lg"
            style={{ background: 'rgba(18,23,34,0.92)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0"
                style={{ background: C.surfaceContainerHigh }}
              >
                <Icon name={weatherIcon} size={28} style={{ color: C.accent }} />
              </div>
              <div className="flex flex-col">
                <span
                  className="uppercase font-bold tracking-wider"
                  style={{ color: C.textMuted, fontSize: '10px', letterSpacing: '0.08em' }}
                >
                  Estado del Tiempo
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-extrabold uppercase tracking-tight text-lg" style={{ color: C.textPrimary }}>
                    {weather.desc}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.sportsPitch }} />
                  <span className="font-semibold text-xs" style={{ color: C.sportsPitch }}>
                    Canchas Óptimas
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="font-extrabold leading-none" style={{ fontSize: '32px', color: C.textPrimary }}>
                {weather.temp}
                <span className="text-lg" style={{ color: C.textMuted }}>°C</span>
              </span>
              <span className="text-xs mt-1" style={{ color: C.textSecondary }}>
                {weather.hum}% humedad
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-1 flex flex-col gap-2">
            <Link
              to={`/${negocioId}/reservar`}
              className="w-full h-14 rounded-xl shadow-xl flex items-center justify-center gap-2 font-black uppercase tracking-wider text-lg active:scale-[0.98] transition-transform"
              style={{ background: C.textPrimary, color: C.surfaceBase }}
            >
              <span>Reservar Ahora</span>
              <Icon name="arrow_forward" size={22} />
            </Link>
            <div className="flex items-center justify-center gap-4 py-1" style={{ color: C.textMuted }}>
              <div className="flex items-center gap-1 text-xs">
                <Icon name="check_circle" size={16} style={{ color: C.sportsPitch }} />
                <span>Confirmación al instante</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Icon name="lock" size={16} style={{ color: C.accent }} />
                <span>Sin seña previa</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NUESTROS ESPACIOS ── */}
      <section className="flex flex-col px-4 py-3">
        <div className="flex items-end justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className="uppercase font-extrabold tracking-tight text-[22px]"
                style={{ color: C.textPrimary }}
              >
                Nuestros
              </span>
              <span
                className="uppercase font-extrabold tracking-tight text-[22px]"
                style={{ color: C.accent }}
              >
                Espacios
              </span>
            </div>
            <span
              className="uppercase tracking-wider mt-0.5"
              style={{ color: C.textMuted, fontSize: '10px', fontWeight: 800 }}
            >
              Campos homologados para alta competición
            </span>
          </div>
          <Link
            to={`/${negocioId}/reservar`}
            className="flex items-center gap-1 uppercase font-bold tracking-wider hover:opacity-80 transition-opacity"
            style={{ color: C.accent, fontSize: '10px' }}
          >
            <span>Disponibilidad</span>
            <Icon name="arrow_forward" size={14} />
          </Link>
        </div>

        {espacios.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center border border-dashed"
            style={{ background: C.surfaceCard, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Icon name="sports_tennis" size={32} style={{ color: C.textMuted }} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold" style={{ color: C.textPrimary }}>
              Próximamente canchas e instalaciones
            </p>
            <p className="text-xs mt-1" style={{ color: C.textMuted }}>
              El complejo está configurando sus espacios para reservas.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {espacios.map((e) => {
            const m = metaFor(e.type);
            return (
              <Link
                key={e.id}
                to={`/${negocioId}/reservar?espacio=${e.id}`}
                className="group relative rounded-xl overflow-hidden shadow-lg active:scale-[0.99] transition-transform"
                style={{ background: C.surfaceCard }}
              >
                <div className="relative w-full h-52 bg-cover bg-center overflow-hidden">
                  <img
                    src={e.imageUrl || m.img}
                    alt={e.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(ev) => {
                      if (m.img && (ev.target as HTMLImageElement).src !== m.img)
                        (ev.target as HTMLImageElement).src = m.img;
                    }}
                  />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${C.surfaceCard} 0%, rgba(18,23,34,0.4) 50%, transparent 100%)` }} />
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-full backdrop-blur-md font-extrabold uppercase"
                      style={{ background: 'rgba(10,10,15,0.8)', color: C.textPrimary, fontSize: '10px' }}
                    >
                      {m.tag}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-full backdrop-blur-md font-black uppercase"
                      style={{ background: 'rgba(16,185,129,0.9)', color: C.surfaceBase, fontSize: '10px' }}
                    >
                      Turnos Hoy
                    </span>
                  </div>
                  {/* Bottom info */}
                  <div className="absolute bottom-3 inset-x-3 flex items-end justify-between">
                    <div className="flex flex-col">
                      <div className="w-8 h-1 rounded-full mb-1" style={{ background: m.accentColor }} />
                      <h3
                        className="font-black uppercase tracking-tight"
                        style={{ fontSize: '22px', color: C.textPrimary }}
                      >
                        {e.name}
                      </h3>
                      <span className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>
                        {m.blurb}
                      </span>
                    </div>
                    <div
                      className="backdrop-blur-md px-3 py-1.5 rounded-lg flex flex-col items-end"
                      style={{ background: 'rgba(26,32,46,0.92)' }}
                    >
                      <span className="uppercase" style={{ color: C.textMuted, fontSize: '10px', fontWeight: 800 }}>
                        Turno 60m
                      </span>
                      <span className="font-bold text-[17px] leading-none" style={{ color: C.accent }}>
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
                          e.precioHora || 12000
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
          </div>
        )}
      </section>

      {/* ── PROMO BANNER ── */}
      {ofertas.length > 0 && (
        <section className="px-4 py-2">
          <div
            className="relative overflow-hidden rounded-xl p-5 shadow-xl"
            style={{ background: `linear-gradient(135deg, ${C.actionViolet} 0%, rgba(109,40,217,0.9) 60%, ${C.surfaceCard} 100%)` }}
          >
            <div
              className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full blur-2xl pointer-events-none"
              style={{ background: 'rgba(245,158,11,0.2)' }}
            />
            <div className="flex items-center gap-2 mb-2">
              <Icon name="local_offer" size={18} style={{ color: C.accent }} />
              <span
                className="uppercase tracking-wider font-black"
                style={{ color: C.accent, fontSize: '10px', letterSpacing: '0.08em' }}
              >
                Destacado Gastronómico
              </span>
            </div>
            <h2
              className="uppercase font-black tracking-tight leading-tight"
              style={{ fontSize: '28px', color: C.textPrimary }}
            >
              PROMOCIÓN SEMANAL
            </h2>
            <p className="text-sm mt-1 font-medium" style={{ color: C.onSurface }}>
              {ofertas[0].titulo} —{' '}
              <span className="font-bold" style={{ color: C.accent }}>
                {ofertas[0].descripcion}
              </span>
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: C.textMuted }}>
                <Icon name="schedule" size={18} style={{ color: C.textSecondary }} />
                <span className="text-xs font-medium" style={{ color: C.textSecondary }}>
                  Miér a Dom · 19:00 a 22:30hs
                </span>
              </div>
              <Link
                to={`/${negocioId}/menu`}
                className="px-5 py-2.5 rounded-lg font-black uppercase tracking-wider shadow-md active:scale-95 transition-transform flex items-center gap-1.5 text-sm"
                style={{ background: C.textPrimary, color: C.surfaceBase }}
              >
                <span>Ver Ofertas</span>
                <Icon name="restaurant" size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURE CARDS ── */}
      <section className="flex flex-col gap-4 px-4 py-4">
        {/* Eventos únicos */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3 shadow-md relative overflow-hidden"
          style={{ background: C.surfaceCard }}
        >
          <div className="flex items-center justify-between">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner"
              style={{ background: 'rgba(224,168,0,0.18)', color: C.accent }}
            >
              <Icon name="star" size={26} style={{ color: C.accent }} />
            </div>
            <span
              className="uppercase tracking-wider"
              style={{ color: C.textMuted, fontSize: '10px', fontWeight: 800 }}
            >
              Social & Empresas
            </span>
          </div>
          <div className="flex flex-col mt-1">
            <h3 className="font-black uppercase tracking-tight text-[22px]" style={{ color: C.textPrimary }}>
              EVENTOS <span className="font-medium" style={{ color: C.textSecondary }}>ÚNICOS</span>
            </h3>
            <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
              Celebrá cumpleaños, torneos corporativos cerrados y jornadas de integración con coordinación y catering profesional.
            </p>
          </div>
          <a
            href={`https://wa.me/5491100000000?text=${encodeURIComponent(`Hola! Quiero info de eventos en ${tenantName}`)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 font-extrabold uppercase tracking-wide text-[17px] hover:underline"
            style={{ color: C.accent }}
          >
            <span>Contactar por WhatsApp</span>
            <Icon name="chat" size={18} />
          </a>
        </div>

        {/* Zona de Desafío */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3 shadow-md relative overflow-hidden"
          style={{ background: C.surfaceCard }}
        >
          <div className="flex items-center justify-between">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner"
              style={{ background: 'rgba(147,0,10,0.28)', color: C.error }}
            >
              <Icon name="sports_kabaddi" size={26} style={{ color: C.error }} />
            </div>
            <span
              className="px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px]"
              style={{ background: 'rgba(147,0,10,0.35)', color: C.error }}
            >
              Matchmaking Activo
            </span>
          </div>
          <div className="flex flex-col mt-1">
            <h3 className="font-black uppercase tracking-tight text-[22px]" style={{ color: C.textPrimary }}>
              ZONA DE DESAFÍO
            </h3>
            <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
              ¿Te falta un jugador para el fútbol o pareja para el pádel? Entrá a la bolsa de jugadores libres y encontrá tu próximo reto competitivo.
            </p>
          </div>
          {/* Players counter */}
          <div
            className="flex items-center gap-3 py-2 px-3 rounded-lg"
            style={{ background: 'rgba(31,31,37,0.6)' }}
          >
            <div className="flex -space-x-2">
              {['MG', 'FR'].map((init, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                  style={{ background: i === 0 ? C.primaryContainer : C.secondaryContainer, color: i === 0 ? '#2a1700' : '#fff' }}
                >
                  {init}
                </div>
              ))}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                style={{ background: C.sportsPitch, color: C.surfaceBase }}
              >
                +9
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: C.textSecondary }}>
              11 jugadores buscando partido ahora
            </span>
          </div>
          <button
            className="mt-1 w-full h-12 rounded-lg font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 text-[17px]"
            style={{ background: C.error, color: C.surfaceBase }}
          >
            <span>Ingresar al Desafío</span>
            <Icon name="swords" size={20} />
          </button>
        </div>

        {/* Escuela de fútbol */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3 shadow-md relative overflow-hidden"
          style={{ background: C.surfaceCard }}
        >
          <div className="flex items-center justify-between">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner"
              style={{ background: C.surfaceContainerHigh }}
            >
              <Icon name="military_tech" size={26} style={{ color: '#ffddb8' }} />
            </div>
            <span
              className="uppercase tracking-wider"
              style={{ color: C.textMuted, fontSize: '10px', fontWeight: 800 }}
            >
              Edades 5 a 16 años
            </span>
          </div>
          <div className="flex flex-col mt-1">
            <h3 className="font-black uppercase tracking-tight text-[22px]" style={{ color: C.textPrimary }}>
              ESCUELA DE FÚTBOL
            </h3>
            <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
              Formación técnica integral para los futuros cracks. Entrenamientos dinámicos, valores deportivos y seguimiento físico profesional.
            </p>
          </div>
          <button
            className="mt-2 w-full h-12 rounded-lg font-bold uppercase tracking-wider shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2 text-[17px]"
            style={{ background: C.surfaceContainerHighest, color: C.textPrimary }}
          >
            <span>Información e Inscripciones</span>
            <Icon name="edit_calendar" size={18} />
          </button>
        </div>

        {/* El Tercer Tiempo */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3 shadow-md relative overflow-hidden"
          style={{ background: C.surfaceCard }}
        >
          <div
            className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-xl pointer-events-none"
            style={{ background: 'rgba(245,158,11,0.1)' }}
          />
          <div className="flex items-center justify-between">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner"
              style={{ background: 'rgba(245,158,11,0.18)' }}
            >
              <Icon name="sports_bar" size={26} style={{ color: C.accent }} />
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: C.surfaceContainerHigh }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: C.sportsPitch }} />
              <span className="font-bold text-[10px] uppercase" style={{ color: C.textPrimary }}>
                Cocina Abierta
              </span>
            </div>
          </div>
          <div className="flex flex-col mt-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-black uppercase tracking-tight text-[22px]" style={{ color: C.textPrimary }}>
                EL TERCER
              </h3>
              <h3 className="font-black uppercase tracking-tight text-[22px]" style={{ color: C.accent }}>
                TIEMPO
              </h3>
            </div>
            <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
              La experiencia no termina en el pitazo final. Cervezas tiradas artesanales, smash burgers, tablas de picadas y tragos de autor junto a la cancha.
            </p>
          </div>
          <Link
            to={`/${negocioId}/menu`}
            className="mt-2 w-full py-3 rounded-lg font-black uppercase tracking-wider shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 text-[17px]"
            style={{
              background: `linear-gradient(to right, ${C.accent}, ${C.primaryContainer}, ${C.secondaryContainer})`,
              color: C.surfaceBase,
            }}
          >
            <span>Ver Menú del Bar</span>
            <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
      </section>

      {/* ── TRUST METRICS ── */}
      <section className="px-4 pt-1 pb-8">
        <div
          className="grid grid-cols-3 gap-1 rounded-xl p-4 text-center"
          style={{ background: 'rgba(14,14,19,0.8)' }}
        >
          {[
            { value: '5+', label: 'Canchas Pro', color: C.accent },
            { value: '100%', label: 'Iluminación LED', color: C.textPrimary },
            { value: '24/7', label: 'Seguridad VIP', color: C.secondaryContainer },
          ].map((m) => (
            <div key={m.label} className="flex flex-col items-center justify-center">
              <span className="font-black text-[22px]" style={{ color: m.color }}>
                {m.value}
              </span>
              <span
                className="uppercase mt-0.5"
                style={{ color: C.textMuted, fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
