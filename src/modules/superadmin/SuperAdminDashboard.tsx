import { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Icon } from '../../components/ui/Icon';

export default function SuperAdminDashboard() {
  const getStats = useSuperAdminStore((s) => s.getStats);
  const tenants = useSuperAdminStore((s) => s.tenants);
  const fetchTenants = useSuperAdminStore((s) => s.fetchTenants);
  const stats = useMemo(() => getStats(), [getStats, tenants]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);


  const cards = [
    { label: 'Total Negocios', value: stats.totalTenants, icon: 'store', color: 'from-violet-500 to-purple-600', sub: 'Complejos activos & trial' },
    { label: 'Negocios Activos', value: stats.activeTenants, icon: 'check_circle', color: 'from-emerald-500 to-teal-600', sub: 'En producción' },
    { label: 'En Período Trial', value: stats.trialTenants, icon: 'hourglass_top', color: 'from-amber-500 to-orange-600', sub: 'Prueba gratuita' },
    { label: 'Usuarios Registrados', value: stats.totalUsers, icon: 'group', color: 'from-blue-500 to-indigo-600', sub: 'En toda la red' },
  ];

  const recent = [...tenants]
    .sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-violet-900/30 via-[#121722] to-[#121722] border border-violet-500/20 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase font-bold tracking-wider text-violet-400">SaaS Multi-Tenant Hub</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Consola de SuperAdministrador</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Monitoreo y administración centralizada de todos los complejos deportivos.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/superadmin/tenants"
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs tracking-wide transition-all shadow-lg shadow-violet-600/30 flex items-center gap-1.5"
          >
            <Icon name="add" size={16} />
            <span>Nuevo Complejo</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-[#121722] rounded-2xl border border-white/10 p-5 flex items-start gap-4 shadow-lg hover:border-white/20 transition-all"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shrink-0 shadow-md`}>
              <Icon name={c.icon} className="text-white" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{c.label}</p>
              <p className="text-2xl font-black text-white mt-0.5 tracking-tight">{c.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Tenants Table Card */}
      <div className="bg-[#121722] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white text-base">Complejos Registrados</h2>
            <p className="text-xs text-slate-400 mt-0.5">Últimos negocios activos en la plataforma</p>
          </div>
          <Link
            to="/superadmin/tenants"
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Ver todos ({tenants.length})</span>
            <Icon name="arrow_forward" size={14} />
          </Link>
        </div>

        <div className="divide-y divide-white/5">
          {recent.map((t) => (
            <div
              key={t.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition-colors"
            >
              <Link
                to={`/superadmin/tenants/${t.id}`}
                className="flex items-center gap-3.5 flex-1 min-w-0 group"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-black text-violet-300 text-sm shrink-0 group-hover:scale-105 transition-transform">
                  {t.nombre.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white truncate group-hover:text-violet-400 transition-colors">
                      {t.nombre}
                    </p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/5 text-slate-400 border border-white/10">
                      {t.plan}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Slug: <code className="text-violet-300">/{t.slug}</code> · {t.usuariosCount} usuarios · {t.espaciosCount} canchas
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    t.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}
                >
                  {t.isActive ? '● Activo' : '○ Suspendido'}
                </span>

                <Link
                  to={`/superadmin/tenants/${t.id}`}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
                >
                  Configurar
                </Link>

                <a
                  href={`/${t.slug}/dashboard`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-semibold text-violet-300 transition-colors flex items-center gap-1"
                >
                  <span>Abrir Panel</span>
                  <Icon name="open_in_new" size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
