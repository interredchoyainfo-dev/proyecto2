import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSuperAdminStore, THEME_PRESETS } from '../../store/useSuperAdminStore';
import { Icon } from '../../components/ui/Icon';
import type { ModuleId } from '../../types';

export default function TenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const tenants = useSuperAdminStore((s) => s.tenants);
  const modulesCatalog = useSuperAdminStore((s) => s.modulesCatalog);
  const toggleModule = useSuperAdminStore((s) => s.toggleModule);
  const updatePlan = useSuperAdminStore((s) => s.updatePlan);
  const updateTenant = useSuperAdminStore((s) => s.updateTenant);
  const toggleTenantActive = useSuperAdminStore((s) => s.toggleTenantActive);

  const tenant = tenants.find((t) => t.id === tenantId || t.slug === tenantId);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editNombre, setEditNombre] = useState(tenant?.nombre || '');
  const [editSlug, setEditSlug] = useState(tenant?.slug || '');
  const [editPlan, setEditPlan] = useState(tenant?.plan || 'trial');
  const [editAdminUser, setEditAdminUser] = useState(tenant?.adminUser || 'admin');
  const [editAdminPassword, setEditAdminPassword] = useState(tenant?.adminPassword || 'admin');
  const [editThemePreset, setEditThemePreset] = useState(tenant?.theme?.preset || 'superadmin');
  const [editDescripcion, setEditDescripcion] = useState(tenant?.descripcion || '');
  const [editSubtitulo, setEditSubtitulo] = useState((tenant as any)?.subtitulo || 'TU LUGAR DEPORTIVO');

  if (!tenant) {
    return (
      <div className="text-center py-20 bg-[#121722] rounded-2xl border border-white/10 p-8">
        <Icon name="search_off" size={48} className="text-slate-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Complejo no encontrado</h2>
        <p className="text-slate-400 text-sm mt-1">El identificador "{tenantId}" no existe en la base de datos.</p>
        <Link
          to="/superadmin/tenants"
          className="text-violet-400 hover:text-violet-300 font-semibold text-sm mt-4 inline-flex items-center gap-1"
        >
          <Icon name="arrow_back" size={16} />
          Volver a la lista de complejos
        </Link>
      </div>
    );
  }

  const activeCount = Object.values(tenant.modulos).filter(Boolean).length;

  const handleOpenEdit = () => {
    setEditNombre(tenant.nombre);
    setEditSlug(tenant.slug);
    setEditPlan(tenant.plan);
    setEditAdminUser(tenant.adminUser || 'admin');
    setEditAdminPassword(tenant.adminPassword || 'admin');
    setEditThemePreset(tenant.theme?.preset || 'superadmin');
    setEditDescripcion(tenant.descripcion || '');
    setEditSubtitulo((tenant as any)?.subtitulo || 'TU LUGAR DEPORTIVO');
    setShowEdit(true);
  };

  const handleSaveEdit = () => {
    if (!editNombre.trim() || !editSlug.trim()) return;
    const cleanSlug = editSlug.trim().toLowerCase().replace(/\s+/g, '-');
    const selectedPreset = THEME_PRESETS.find((p) => p.id === editThemePreset) || THEME_PRESETS[0];
    updateTenant(tenant.id, {
      nombre: editNombre.trim(),
      slug: cleanSlug,
      plan: editPlan,
      adminUser: editAdminUser.trim(),
      adminPassword: editAdminPassword.trim(),
      descripcion: editDescripcion.trim(),
      subtitulo: editSubtitulo.trim(),
      theme: {
        primaryColor: selectedPreset.primaryColor,
        accentColor: selectedPreset.accentColor,
        secondaryColor: selectedPreset.secondaryColor,
        preset: selectedPreset.id,
      },
    });
    setShowEdit(false);
    if (cleanSlug !== tenant.slug) {
      navigate(`/superadmin/tenants/${cleanSlug}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#121722] border border-white/10 shadow-xl">
        <div className="flex items-start gap-4">
          <Link
            to="/superadmin/tenants"
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 mt-1 transition-colors"
          >
            <Icon name="arrow_back" size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-white">{tenant.nombre}</h1>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  tenant.isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {tenant.isActive ? '● Activo' : '○ Suspendido'}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Ruta: <code className="text-violet-300">/{tenant.slug}</code> · Registrado el {tenant.createdAt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleOpenEdit}
            className="px-3.5 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Icon name="edit" size={15} />
            <span>Editar Datos</span>
          </button>
          <button
            onClick={() => toggleTenantActive(tenant.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              tenant.isActive
                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {tenant.isActive ? 'Suspender Negocio' : 'Activar Negocio'}
          </button>
          <a
            href={`/${tenant.slug}/dashboard`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-violet-600/30 transition-all"
          >
            <Icon name="dashboard" size={15} />
            <span>Panel Admin</span>
          </a>
          <a
            href={`/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Icon name="visibility" size={15} />
            <span>Portal Cliente</span>
          </a>
        </div>
      </div>

      {/* Edit Tenant Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121722] rounded-2xl border border-violet-500/40 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Icon name="edit" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Editar Datos del Complejo</h3>
                  <p className="text-xs text-slate-400">Cambiar nombre o ruta URL</p>
                </div>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nombre Comercial del Complejo
                </label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="Ej. Oasis Padel Club"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Slug / Ruta URL
                </label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="oasis-padel-club"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Plan de Suscripción
                </label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0E121B] text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                >
                  <option value="trial">Trial (Prueba)</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              {/* Edit Admin Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/20">
                <div>
                  <label className="block text-xs font-semibold text-violet-300 mb-1">
                    Usuario Administrador
                  </label>
                  <input
                    type="text"
                    value={editAdminUser}
                    onChange={(e) => setEditAdminUser(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-violet-300 mb-1">
                    Contraseña Administrador
                  </label>
                  <input
                    type="text"
                    value={editAdminPassword}
                    onChange={(e) => setEditAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Theme Preset Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Paleta de Colores del Lugar
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {THEME_PRESETS.map((p) => {
                    const isSelected = editThemePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditThemePreset(p.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-violet-500 bg-violet-600/20 ring-1 ring-violet-500'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full shrink-0 border border-white/30"
                          style={{ backgroundColor: p.primaryColor }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{p.label}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description editor */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Descripción o Lema del Complejo
                </label>
                <textarea
                  rows={2}
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                  placeholder="Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-all shadow-md shadow-violet-600/30 flex items-center gap-1.5"
              >
                <Icon name="check" size={16} />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description & Theme Preview Card */}
      <div className="bg-[#121722] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Icon name="info" size={16} className="text-violet-400" />
            <span>Lema & Descripción del Complejo</span>
          </div>
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">{(tenant as any)?.subtitulo || 'TU LUGAR DEPORTIVO'}</p>
          <p className="text-sm text-slate-200 italic leading-relaxed">
            "{tenant.descripcion || 'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha.'}"
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 p-3 rounded-xl bg-white/[0.03] border border-white/10">
          <div
            className="w-8 h-8 rounded-xl shadow-lg border border-white/20 flex items-center justify-center"
            style={{ backgroundColor: tenant.theme?.primaryColor || '#8B5CF6' }}
          >
            <Icon name="palette" size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              {THEME_PRESETS.find((p) => p.id === tenant.theme?.preset)?.label || 'Personalizado'}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              {tenant.theme?.primaryColor || '#8B5CF6'}
            </p>
          </div>
        </div>
      </div>

      {/* Admin Credentials Card */}
      <div className="bg-[#121722] rounded-2xl border border-violet-500/30 p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
            <Icon name="key" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Credenciales de Acceso a Administración</h3>
            <p className="text-xs text-slate-400">
              Acceso independiente al panel administrativo de este negocio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <span className="text-slate-400">Usuario:</span>{' '}
            <strong className="text-white">{tenant.adminUser || 'admin'}</strong>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <span className="text-slate-400">Contraseña:</span>{' '}
            <strong className="text-violet-300">{tenant.adminPassword || 'admin'}</strong>
          </div>
          <button
            onClick={handleOpenEdit}
            className="px-3.5 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-all flex items-center gap-1"
          >
            <Icon name="edit" size={14} />
            <span>Editar Clave</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Plan Activo', value: tenant.plan, icon: 'payments' },
          { label: 'Usuarios / Staff', value: tenant.usuariosCount, icon: 'group' },
          { label: 'Mesas Registradas', value: tenant.mesasCount, icon: 'table_restaurant' },
          { label: 'Canchas / Espacios', value: tenant.espaciosCount, icon: 'stadium' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#121722] rounded-2xl border border-white/10 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">{s.label}</span>
              <Icon name={s.icon} size={16} />
            </div>
            <p className="text-xl font-black text-white capitalize">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Plan selector */}
      <div className="bg-[#121722] rounded-2xl border border-white/10 p-6 shadow-xl">
        <h3 className="font-bold text-white text-sm mb-1">Nivel de Suscripción</h3>
        <p className="text-xs text-slate-400 mb-4">Seleccioná el plan habilitado para este complejo</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['trial', 'basic', 'pro', 'enterprise'] as const).map((p) => {
            const isSelected = tenant.plan === p;
            return (
              <button
                key={p}
                onClick={() => updatePlan(tenant.id, p)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'border-violet-500 bg-violet-600/20 shadow-md shadow-violet-600/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase text-white tracking-wider">{p}</span>
                  {isSelected && <Icon name="check_circle" size={16} className="text-violet-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  {p === 'trial' ? 'Prueba gratuita' : p === 'basic' ? 'Básico' : p === 'pro' ? 'Profesional' : 'Empresarial'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modules */}
      <div className="bg-[#121722] rounded-2xl border border-white/10 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-white text-sm">Módulos Habilitados</h3>
            <p className="text-xs text-slate-400">Activa o desactiva módulos para este inquilino</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
            {activeCount} de {modulesCatalog.length} activos
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modulesCatalog.map((mod) => {
            const enabled = tenant.modulos[mod.id as ModuleId];
            return (
              <button
                key={mod.id}
                onClick={() => toggleModule(tenant.id, mod.id as ModuleId)}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all ${
                  enabled
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : 'border-white/10 bg-white/[0.02] opacity-60 hover:opacity-100'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    enabled ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  <Icon name={enabled ? 'check' : 'close'} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-white">{mod.label}</p>
                    <span className={`text-[10px] font-bold uppercase ${enabled ? 'text-violet-400' : 'text-slate-500'}`}>
                      {enabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{mod.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
