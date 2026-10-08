import { useStore } from '../../store/useStore';
import { useConfig } from '../../core/services/ConfigContext';
import { Icon } from '../ui/Icon';
import type { ViewId } from '../../types';

const navItems: { id: ViewId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'reservations', label: 'Reservas', icon: 'calendar_month' },
  { id: 'pos', label: 'Punto de Venta', icon: 'point_of_sale' },
  { id: 'cash', label: 'Control de Caja', icon: 'account_balance_wallet' },
  { id: 'clients', label: 'Clientes', icon: 'group' },
  { id: 'settings', label: 'Configuración', icon: 'settings' },
];

export function Sidebar() {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  let tenantName = 'Complejo Deportivo';
  try {
    const { config } = useConfig();
    if (config?.negocio.nombre) tenantName = config.negocio.nombre;
  } catch {}

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col ${
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
          <Icon name="sports_soccer" className="text-white" size={22} />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm leading-tight truncate">{tenantName}</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Admin</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon name={item.icon} filled={active} className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse btn */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
        >
          <Icon name={sidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'} />
          {!sidebarCollapsed && <span className="text-xs">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
