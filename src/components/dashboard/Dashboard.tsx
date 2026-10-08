import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { KPICards } from './KPICards';
import { CourtGrid } from './CourtGrid';
import { useOfertasStore, isOfertaVigente } from '../../store/useOfertasStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Icon } from '../ui/Icon';

export function Dashboard() {
  const ofertas = useOfertasStore((s) => s.ofertas);
  const notifications = useNotificationStore((s) => s.notifications);

  const ofertasActivas = useMemo(
    () => ofertas.filter((o) => isOfertaVigente(o)),
    [ofertas]
  );
  const notifs = useMemo(() => notifications.slice(0, 5), [notifications]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Vista general del complejo · {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <KPICards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ofertas vigentes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="local_offer" className="text-amber-500" />
              Ofertas vigentes
            </h3>
            <Link to="ofertas" className="text-xs text-emerald-600 font-medium">
              Gestionar
            </Link>
          </div>
          {ofertasActivas.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No hay ofertas activas en este momento</p>
          ) : (
            <div className="space-y-2">
              {ofertasActivas.map((o) => (
                <div key={o.id} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <p className="font-semibold text-sm">{o.titulo}</p>
                  <p className="text-xs text-slate-500">{o.descripcion}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notificaciones recientes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="notifications" className="text-violet-500" />
              Notificaciones
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-violet-500 text-white text-[10px]">{unreadCount}</span>
              )}
            </h3>
          </div>
          {notifs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Sin notificaciones recientes</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifs.map((n) => (
                <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm">
                  <p className="font-medium text-xs">{n.title}</p>
                  <p className="text-[11px] text-slate-500">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CourtGrid />
    </div>
  );
}
