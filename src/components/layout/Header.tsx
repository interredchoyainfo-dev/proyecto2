import { useStore } from '../../store/useStore';
import { Icon } from '../ui/Icon';

export function Header() {
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const cashSession = useStore((s) => s.cashSession);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const currentUser = useStore((s) => s.currentUser);

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-[72px]' : 'left-64'
      }`}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Panel de Administración
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Cash status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            cashSession?.status === 'abierta'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              cashSession?.status === 'abierta' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          {cashSession?.status === 'abierta' ? 'Caja Abierta' : 'Caja Cerrada'}
        </div>

        {/* PWA install hint */}
        <button
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Instalar como App (PWA)"
        >
          <Icon name="install_mobile" />
        </button>

        {/* Dark mode */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={darkMode ? 'Modo claro' : 'Modo oscuro'}
        >
          <Icon name={darkMode ? 'light_mode' : 'dark_mode'} />
        </button>

        {/* User */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
            {(currentUser.name || currentUser.nombre || 'U').charAt(0)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight">{currentUser.name || currentUser.nombre || 'Usuario'}</p>
            <p className="text-[10px] text-slate-500 capitalize">{currentUser.role || currentUser.rol || 'admin'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
