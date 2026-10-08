import { Outlet, NavLink, useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../core/services/ConfigContext';
import { Icon } from '../components/ui/Icon';

const navItems = [
  { to: 'dashboard', label: 'Dashboard', icon: 'dashboard', module: null },
  { to: 'reservas', label: 'Reservas', icon: 'calendar_month', module: 'reservas' },
  { to: 'espacios', label: 'Espacios / Canchas', icon: 'stadium', module: 'reservas' },
  { to: 'mesas', label: 'Mesas / Salón', icon: 'table_restaurant', module: 'bar' },
  { to: 'pos', label: 'Punto de Venta', icon: 'point_of_sale', module: 'bar' },
  { to: 'cocina', label: 'PANTALLA COCINA', icon: 'skillet', module: 'cocina' },
  { to: 'inventario', label: 'Inventario', icon: 'inventory_2', module: 'inventario' },
  { to: 'ofertas', label: 'Ofertas', icon: 'local_offer', module: null },
  { to: 'caja', label: 'Control de Caja', icon: 'account_balance_wallet', module: 'caja' },
  { to: 'clientes', label: 'Clientes', icon: 'group', module: null },
  { to: 'configuracion', label: 'Configuración', icon: 'settings', module: null },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { config, isModuleActive } = useConfig();
  const { negocioId } = useParams();
  const navigate = useNavigate();

  const visibleItems = navItems.filter(
    (item) => !item.module || isModuleActive(item.module as any)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Icon name="sports_soccer" className="text-white" size={22} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm leading-tight truncate">
                {config?.negocio.nombre || 'Complejo'}
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Admin
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={`/${negocioId}/${item.to}`}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <Icon name={collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'} />
            {!collapsed && <span className="text-xs">Colapsar</span>}
          </button>
        </div>
      </aside>

      {/* Header */}
      <header
        className={`fixed top-0 right-0 z-30 h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 transition-all duration-300 ${
          collapsed ? 'left-[72px]' : 'left-64'
        }`}
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Panel de Administración
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {user?.rol === 'superadmin' && (
            <Link
              to="/superadmin"
              className="px-3 py-1.5 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/30 text-violet-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Volver a la consola SaaS SuperAdmin"
            >
              <Icon name="admin_panel_settings" size={16} />
              <span className="hidden sm:inline">Consola SuperAdmin</span>
            </Link>
          )}

          <button
            onClick={() => document.documentElement.classList.toggle('dark')}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle tema"
          >
            <Icon name="dark_mode" />
          </button>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.nombre?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-tight">{user?.nombre}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user?.rol}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate(negocioId ? `/${negocioId}/login` : '/login');
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 ml-1"
              title="Cerrar sesión"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${
          collapsed ? 'pl-[72px]' : 'pl-64'
        }`}
      >
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
