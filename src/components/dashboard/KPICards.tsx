import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Icon } from '../ui/Icon';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

export function KPICards() {
  const { negocioId } = useParams();
  const getTodayStats = useStore((s) => s.getTodayStats);
  const reservations = useStore((s) => s.reservations);
  const cashMovements = useStore((s) => s.cashMovements);
  const clients = useStore((s) => s.clients);
  const cashSession = useStore((s) => s.cashSession);

  const stats = useMemo(
    () => getTodayStats(negocioId),
    [getTodayStats, reservations, cashMovements, clients, cashSession, negocioId]
  );

  const cards = [
    {
      label: 'Ingresos del día',
      value: formatMoney(stats.revenue),
      icon: 'payments',
      color: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Turnos ocupados',
      value: String(stats.occupiedSlots),
      icon: 'event_available',
      color: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Nuevos clientes',
      value: String(stats.newClients),
      icon: 'person_add',
      color: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Balance de caja',
      value: formatMoney(stats.cashBalance),
      icon: 'account_balance',
      color: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-start gap-4"
        >
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shrink-0`}>
            <Icon name={c.icon} className="text-white" size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
              {c.label}
            </p>
            <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
