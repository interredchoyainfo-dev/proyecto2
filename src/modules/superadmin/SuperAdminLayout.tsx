import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';

const nav = [
  { to: '/superadmin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/superadmin/tenants', label: 'Negocios (Tenants)', icon: 'store' },
  { to: '/superadmin/planes', label: 'Planes & Precios', icon: 'payments' },
  { to: '/superadmin/modulos', label: 'Catálogo Módulos', icon: 'extension' },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden h-16 bg-[#121722] border-b border-white/10 px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
            <Icon name="admin_panel_settings" className="text-white" size={20} />
          </div>
          <span className="font-bold text-sm tracking-tight">SuperAdmin SaaS</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300"
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} size={20} />
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-[#121722] border-r border-white/10 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/30 ring-1 ring-white/20">
            <Icon name="admin_panel_settings" className="text-white" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-sm tracking-tight">SuperAdmin</p>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Consola Multi-Tenant</p>
          </div>
        </div>

        {/* Main Nav */}
        <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Plataforma SaaS
            </p>
            <nav className="space-y-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 font-semibold'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Quick Access to Tenant Apps */}
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Acceso a Complejos
            </p>
            <div className="space-y-1 text-xs">
              <Link
                to="/giovanni"
                target="_blank"
                className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Portal Cliente (/giovanni)</span>
                </div>
                <Icon name="open_in_new" size={14} className="text-slate-500" />
              </Link>
              <Link
                to="/giovanni/dashboard"
                target="_blank"
                className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Panel Admin (/giovanni)</span>
                </div>
                <Icon name="open_in_new" size={14} className="text-slate-500" />
              </Link>
            </div>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-white/10 shrink-0 bg-[#0E121B]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300">
              {user?.nombre?.charAt(0) || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user?.nombre || 'Super Admin'}</p>
              <p className="text-[10px] text-violet-400 font-mono">superadmin@saas</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/superadmin/login');
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-white/5"
          >
            <Icon name="logout" size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col bg-[#0A0A0F]">
        {/* Top bar */}
        <div className="h-16 px-6 border-b border-white/10 hidden md:flex items-center justify-between bg-[#121722]/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">https://complejo.saas/superadmin</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ● Online / Sistema Operativo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/giovanni"
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Icon name="visibility" size={14} />
              <span>Ver App Complejo</span>
            </Link>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
