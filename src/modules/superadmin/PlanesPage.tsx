import { Icon } from '../../components/ui/Icon';

const planes = [
  {
    id: 'trial',
    nombre: 'Trial',
    precio: 0,
    descripcion: '15 días de prueba completa',
    features: ['Hasta 2 canchas', 'Hasta 5 mesas', 'Módulos básicos', 'Soporte por email'],
    color: 'from-slate-600 to-slate-700',
  },
  {
    id: 'basic',
    nombre: 'Basic',
    precio: 29900,
    descripcion: 'Para complejos chicos y medianos',
    features: ['Hasta 4 canchas', 'Hasta 15 mesas', 'Reservas + Caja + Bar', 'App Mozos', 'Soporte prioritario'],
    color: 'from-blue-600 to-indigo-700',
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precio: 59900,
    descripcion: 'El plan más elegido por los clubes',
    features: ['Canchas ilimitadas', 'Mesas ilimitadas', 'Todos los módulos operativos', 'Delivery + KDS', 'Analytics básico', 'Soporte 24/7'],
    color: 'from-violet-600 to-purple-700',
    popular: true,
  },
  {
    id: 'enterprise',
    nombre: 'Enterprise',
    precio: 129900,
    descripcion: 'Para cadenas, sedes y clubs grandes',
    features: ['Todo Pro', 'Multi-sucursal', 'IoT Smart Center', 'Analytics AI', 'API access', 'Account manager'],
    color: 'from-amber-600 to-orange-700',
  },
];

function formatMoney(n: number) {
  if (n === 0) return 'Gratis';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function PlanesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Planes y Suscripciones SaaS</h1>
        <p className="text-slate-400 text-sm">Catálogo de suscripciones y facturación para complejos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {planes.map((p) => (
          <div
            key={p.id}
            className={`relative bg-[#121722] rounded-2xl border p-6 flex flex-col shadow-xl transition-all ${
              p.popular ? 'border-violet-500 ring-2 ring-violet-500/30' : 'border-white/10 hover:border-white/20'
            }`}
          >
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-violet-600/50">
                Más Elegido
              </span>
            )}
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-4 shadow-md`}>
              <Icon name="payments" className="text-white" size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">{p.nombre}</h3>
            <p className="text-xs text-slate-400 mb-3">{p.descripcion}</p>
            <p className="text-3xl font-black text-white mb-1">
              {formatMoney(p.precio)}
              {p.precio > 0 && <span className="text-xs font-normal text-slate-400">/mes</span>}
            </p>
            <ul className="mt-4 space-y-2.5 flex-1 border-t border-white/5 pt-4">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                  <Icon name="check" size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
