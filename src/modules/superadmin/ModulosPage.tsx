import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Icon } from '../../components/ui/Icon';
import type { ModuleId } from '../../types';

export default function ModulosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modulesCatalog = useSuperAdminStore((s) => s.modulesCatalog);
  const tenants = useSuperAdminStore((s) => s.tenants);
  const toggleModule = useSuperAdminStore((s) => s.toggleModule);

  const initialTenantId = searchParams.get('tenant') || (tenants[0]?.slug || tenants[0]?.id || '');
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId);

  // Sync state if url changes
  useEffect(() => {
    const urlTenant = searchParams.get('tenant');
    if (urlTenant) {
      setSelectedTenantId(urlTenant);
    }
  }, [searchParams]);

  const selectedTenant =
    tenants.find((t) => t.id === selectedTenantId || t.slug === selectedTenantId) || tenants[0];

  const handleSelectTenant = (val: string) => {
    setSelectedTenantId(val);
    setSearchParams({ tenant: val });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gestión y Auditoría de Módulos</h1>
          <p className="text-slate-400 text-sm">
            Revisá y activá en tiempo real qué módulos tiene habilitados cada complejo deportivo.
          </p>
        </div>
      </div>

      {/* Tenant Selector Bar */}
      <div className="bg-[#121722] rounded-2xl border border-violet-500/30 p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
              <Icon name="tune" size={20} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-400">
                Seleccionar Negocio / Complejo a Inspeccionar
              </p>
              <p className="text-sm font-semibold text-white">
                Revisando módulos de: <span className="text-violet-300 font-bold">{selectedTenant?.nombre}</span>{' '}
                <code className="text-xs text-slate-400 font-mono">({selectedTenant?.slug})</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={selectedTenant?.slug || selectedTenant?.id || ''}
              onChange={(e) => handleSelectTenant(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-white/10 bg-[#0E121B] text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.slug || t.id}>
                  {t.nombre} ({t.slug})
                </option>
              ))}
            </select>

            {selectedTenant && (
              <Link
                to={`/superadmin/tenants/${selectedTenant.slug}`}
                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-violet-600/30"
              >
                <span>Ficha del Complejo</span>
                <Icon name="arrow_forward" size={15} />
              </Link>
            )}
          </div>
        </div>

        {selectedTenant && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedTenant.theme?.primaryColor || '#8B5CF6' }} />
              <span>Paleta activa: <strong className="text-white">{selectedTenant.theme?.preset || 'Personalizada'}</strong></span>
              <span className="text-slate-600">|</span>
              <span>Plan: <strong className="text-white uppercase">{selectedTenant.plan}</strong></span>
            </div>
            <div className="text-violet-400 font-medium">
              {Object.values(selectedTenant.modulos).filter(Boolean).length} de {modulesCatalog.length} módulos activados
            </div>
          </div>
        )}
      </div>

      {/* Modules Cards Grid for Selected Tenant */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulesCatalog.map((mod) => {
          const isEnabled = !!selectedTenant?.modulos[mod.id as ModuleId];
          const totalTenantsWithMod = tenants.filter((t) => t.modulos[mod.id as ModuleId]).length;

          return (
            <div
              key={mod.id}
              className={`rounded-2xl border p-5 transition-all shadow-xl flex flex-col justify-between ${
                isEnabled
                  ? 'bg-[#121722] border-violet-500/40 shadow-violet-900/10'
                  : 'bg-[#121722]/60 border-white/5 opacity-75 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isEnabled
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                          : 'bg-white/5 text-slate-500'
                      }`}
                    >
                      <Icon name={isEnabled ? 'check_circle' : 'cancel'} size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{mod.label}</h3>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">{mod.id}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      isEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {isEnabled ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Global: <strong className="text-slate-300">{totalTenantsWithMod}/{tenants.length}</strong>
                </span>

                {selectedTenant && (
                  <button
                    onClick={() => toggleModule(selectedTenant.id, mod.id as ModuleId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      isEnabled
                        ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400'
                        : 'bg-violet-600 hover:bg-violet-500 text-white border-violet-500/40 shadow-sm'
                    }`}
                  >
                    <Icon name={isEnabled ? 'toggle_off' : 'toggle_on'} size={16} />
                    <span>{isEnabled ? 'Desactivar' : 'Activar'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Module Matrix Table */}
      <div className="bg-[#121722] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Icon name="grid_view" size={18} className="text-violet-400" />
            <h3 className="font-bold text-sm">Matriz de Módulos por Complejo</h3>
          </div>
          <span className="text-xs text-slate-400">Auditoría rápida de todos los complejos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-white/10 bg-white/[0.02]">
                <th className="p-3 font-semibold">Complejo</th>
                {modulesCatalog.map((m) => (
                  <th key={m.id} className="p-3 font-semibold text-center whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-white/[0.02] transition-colors ${
                    selectedTenant?.id === t.id ? 'bg-violet-600/5' : ''
                  }`}
                >
                  <td className="p-3 font-semibold text-white whitespace-nowrap">
                    <button
                      onClick={() => handleSelectTenant(t.slug || t.id)}
                      className="hover:text-violet-400 transition-colors text-left"
                    >
                      {t.nombre}
                      <span className="block text-[10px] text-slate-500 font-mono">/{t.slug}</span>
                    </button>
                  </td>
                  {modulesCatalog.map((m) => {
                    const active = !!t.modulos[m.id as ModuleId];
                    return (
                      <td key={m.id} className="p-3 text-center">
                        <button
                          onClick={() => toggleModule(t.id, m.id as ModuleId)}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center transition-transform hover:scale-110 ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-white/5 text-slate-600'
                          }`}
                          title={`Click para ${active ? 'desactivar' : 'activar'} ${m.label} en ${t.nombre}`}
                        >
                          <Icon name={active ? 'check' : 'remove'} size={14} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
