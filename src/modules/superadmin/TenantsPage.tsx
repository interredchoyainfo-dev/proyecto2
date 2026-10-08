import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSuperAdminStore, THEME_PRESETS, type TenantFull } from '../../store/useSuperAdminStore';
import { Icon } from '../../components/ui/Icon';

const planColors: Record<string, string> = {
  trial: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  basic: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pro: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const DEFAULT_DESC =
  'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha.';

export default function TenantsPage() {
  const tenants = useSuperAdminStore((s) => s.tenants);
  const createTenant = useSuperAdminStore((s) => s.createTenant);
  const updateTenant = useSuperAdminStore((s) => s.updateTenant);
  const toggleTenantActive = useSuperAdminStore((s) => s.toggleTenantActive);
  const deleteTenant = useSuperAdminStore((s) => s.deleteTenant);
  const resetTenantDataToZero = useSuperAdminStore((s) => s.resetTenantDataToZero);
  const fetchTenants = useSuperAdminStore((s) => s.fetchTenants);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState<'trial' | 'basic' | 'pro' | 'enterprise'>('trial');
  const [adminUser, setAdminUser] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [themePreset, setThemePreset] = useState<string>('superadmin');
  const [descripcion, setDescripcion] = useState(DEFAULT_DESC);
  const [search, setSearch] = useState('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [editSubtitulo, setEditSubtitulo] = useState('TU LUGAR DEPORTIVO');

  const handleResetToZero = (t: TenantFull) => {
    const ok = window.confirm(
      `¿Estás seguro de reiniciar todas las reservas, ventas y movimientos de caja de "${t.nombre}" a 0?\n\nLos espacios y la configuración se mantendrán intactos. Ideal para dejar en 0 antes de entregar al cliente.`
    );
    if (!ok) return;
    resetTenantDataToZero(t.id);
    setSuccessBanner(`Se reiniciaron los datos de "${t.nombre}" a cero exitosamente.`);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleDeleteTenant = (t: TenantFull) => {
    if (t.slug.toLowerCase() === 'giovanni' || t.id.toLowerCase() === 'giovanni') {
      alert('El complejo Giovanni es la base del sistema y no puede eliminarse.');
      return;
    }
    const ok = window.confirm(
      `¿ATENCIÓN: Estás seguro de eliminar permanentemente el negocio "${t.nombre}" (/${t.slug})?\n\nEsta acción borrará el complejo y todos sus datos asociados.`
    );
    if (!ok) return;
    deleteTenant(t.id);
    setSuccessBanner(`El negocio "${t.nombre}" fue eliminado exitosamente.`);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  // Edit tenant state
  const [editingTenant, setEditingTenant] = useState<TenantFull | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editPlan, setEditPlan] = useState<'trial' | 'basic' | 'pro' | 'enterprise'>('trial');
  const [editAdminUser, setEditAdminUser] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editThemePreset, setEditThemePreset] = useState<string>('superadmin');
  const [editDescripcion, setEditDescripcion] = useState('');

  const filtered = tenants.filter(
    (t) =>
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!nombre.trim() || !slug.trim()) return;
    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const selectedPreset = THEME_PRESETS.find((p) => p.id === themePreset) || THEME_PRESETS[0];
    createTenant({
      nombre: nombre.trim(),
      slug: cleanSlug,
      plan,
      adminUser: adminUser.trim() || `admin_${cleanSlug}`,
      adminPassword: adminPassword.trim() || `${cleanSlug}123`,
      descripcion: descripcion.trim(),
      theme: {
        primaryColor: selectedPreset.primaryColor,
        accentColor: selectedPreset.accentColor,
        secondaryColor: selectedPreset.secondaryColor,
        preset: selectedPreset.id,
      },
    });
    setNombre('');
    setSlug('');
    setPlan('trial');
    setAdminUser('');
    setAdminPassword('');
    setThemePreset('superadmin');
    setDescripcion(DEFAULT_DESC);
    setShowForm(false);
    setSuccessBanner(`¡Complejo "${nombre.trim()}" registrado con éxito! Base de datos propia e independiente (${cleanSlug}.sqlite y Firestore) generada automáticamente.`);
    setTimeout(() => setSuccessBanner(null), 8000);
  };

  const handleStartEdit = (t: TenantFull) => {
    setEditingTenant(t);
    setEditNombre(t.nombre);
    setEditSlug(t.slug);
    setEditPlan(t.plan);
    setEditAdminUser(t.adminUser || 'admin');
    setEditAdminPassword(t.adminPassword || 'admin');
    setEditThemePreset(t.theme?.preset || 'superadmin');
    setEditDescripcion(t.descripcion || DEFAULT_DESC);
    setEditSubtitulo((t as any).subtitulo || 'TU LUGAR DEPORTIVO');
  };

  const handleSaveEdit = () => {
    if (!editingTenant || !editNombre.trim() || !editSlug.trim()) return;
    const selectedPreset = THEME_PRESETS.find((p) => p.id === editThemePreset) || THEME_PRESETS[0];
    updateTenant(editingTenant.id, {
      nombre: editNombre.trim(),
      slug: editSlug.trim(),
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
    setEditingTenant(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Negocios & Complejos (Tenants)</h1>
          <p className="text-slate-400 text-sm">
            {tenants.length} complejos deportivos registrados. Podés editar nombres, colores, URLs y planes en tiempo real.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs tracking-wide transition-all shadow-lg shadow-violet-600/30 self-start sm:self-auto"
        >
          <Icon name="add" size={16} />
          <span>{showForm ? 'Cerrar formulario' : 'Nuevo negocio'}</span>
        </button>
      </div>

      {/* Create Tenant Form */}
      {showForm && (
        <div className="bg-[#121722] rounded-2xl border border-violet-500/30 p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-2 text-white">
            <Icon name="add_business" className="text-violet-400" size={20} />
            <h3 className="font-bold text-sm">Crear Nuevo Complejo Deportivo</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Nombre Comercial</label>
              <input
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="Ej. Oasis Padel Club"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Slug URL</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="oasispadel"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Plan de Suscripción</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0E121B] text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              >
                <option value="trial">Trial (Prueba)</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          {/* Admin Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/20">
            <div>
              <label className="block text-[11px] text-violet-300 font-semibold mb-1">
                Usuario de Administración
              </label>
              <input
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder={`Ej. admin_${slug || 'oasis'}`}
                className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-violet-300 font-semibold mb-1">
                Contraseña de Administración
              </label>
              <input
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder={`Ej. ${slug || 'oasis'}123`}
                className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs font-mono"
              />
            </div>
          </div>

          {/* Theme Palette Picker */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
              Paleta de Colores del Lugar
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {THEME_PRESETS.map((p) => {
                const isSelected = themePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setThemePreset(p.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-violet-500 bg-violet-600/20 ring-1 ring-violet-500 shadow-md shadow-violet-600/20'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-white/30"
                      style={{ backgroundColor: p.primaryColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{p.label}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {p.id === 'superadmin' ? 'Igual a SuperAdmin' : p.primaryColor}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Business Description */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              Descripción o Lema del Complejo (Visible para los clientes)
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha."
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-all shadow-md shadow-violet-600/30"
            >
              Registrar Complejo
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121722] rounded-2xl border border-violet-500/40 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Icon name="edit" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Editar Complejo</h3>
                  <p className="text-xs text-slate-400">Modificar datos de <code className="text-violet-300">/{editingTenant.slug}</code></p>
                </div>
              </div>
              <button
                onClick={() => setEditingTenant(null)}
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
                <p className="text-[11px] text-slate-500 mt-1">Este nombre se mostrará en todas las apps, encabezados y menús.</p>
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
                <p className="text-[11px] text-slate-500 mt-1">
                  Acceso directo: <code className="text-violet-400">http://localhost:5175/{editSlug}</code>
                </p>
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

              {/* Edit Theme Preset */}
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

              {/* Edit Description */}
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
                onClick={() => setEditingTenant(null)}
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

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" size={18} className="text-emerald-400" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar complejo por nombre o slug..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-[#121722] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-[#121722] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-white/10 bg-white/[0.02]">
                <th className="p-4 font-semibold">Negocio</th>
                <th className="p-4 font-semibold">Plan</th>
                <th className="p-4 font-semibold">Usuarios</th>
                <th className="p-4 font-semibold">Módulos</th>
                <th className="p-4 font-semibold">Estado</th>
                <th className="p-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((t) => {
                const activeMods = Object.values(t.modulos).filter(Boolean).length;
                return (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-black text-violet-300 text-sm shrink-0 group-hover:scale-105 transition-transform">
                          {t.nombre.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-violet-400 transition-colors">
                            {t.nombre}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs text-slate-400 font-mono">/{t.slug}</p>
                            <span className="text-[10px] text-slate-600">·</span>
                            <span className="text-[10px] text-violet-300 font-mono bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20" title="Credenciales del negocio para ingresar a su administración">
                              🔑 {t.adminUser || 'admin'} : {t.adminPassword || 'admin'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${planColors[t.plan]}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300 font-medium">{t.usuariosCount}</td>
                    <td className="p-4 text-slate-300 font-medium">{activeMods} activos</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          t.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        {t.isActive ? '● Activo' : '○ Suspendido'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleStartEdit(t)}
                          className="p-2 rounded-xl bg-violet-600/15 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 transition-colors flex items-center gap-1"
                          title="Editar nombre, slug o plan"
                        >
                          <Icon name="edit" size={16} />
                          <span className="text-xs font-semibold hidden md:inline">Editar</span>
                        </button>

                        {/* Config / Modules Link */}
                        <Link
                          to={`/superadmin/tenants/${t.id}`}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
                          title="Configuración de Módulos"
                        >
                          <Icon name="settings" size={16} />
                        </Link>

                        {/* Reiniciar negocio a 0 */}
                        <button
                          onClick={() => handleResetToZero(t)}
                          className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition-colors flex items-center gap-1"
                          title="Reiniciar reservas y ventas a 0 para entrega"
                        >
                          <Icon name="history" size={16} />
                          <span className="text-xs font-semibold hidden md:inline">Reiniciar a 0</span>
                        </button>

                        {/* Borrar negocio (excepto giovanni) */}
                        {t.slug.toLowerCase() !== 'giovanni' && t.id.toLowerCase() !== 'giovanni' && (
                          <button
                            onClick={() => handleDeleteTenant(t)}
                            className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-colors flex items-center gap-1"
                            title="Eliminar este negocio"
                          >
                            <Icon name="delete" size={16} />
                            <span className="text-xs font-semibold hidden md:inline">Borrar</span>
                          </button>
                        )}

                        {/* Toggle active button */}
                        <button
                          onClick={() => toggleTenantActive(t.id)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
                          title={t.isActive ? 'Suspender complejo' : 'Activar complejo'}
                        >
                          <Icon
                            name={t.isActive ? 'block' : 'check_circle'}
                            size={16}
                            className={t.isActive ? 'text-amber-400' : 'text-emerald-400'}
                          />
                        </button>

                        {/* Open Admin */}
                        <a
                          href={`/${t.slug}/dashboard`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-semibold text-violet-300 transition-colors flex items-center gap-1"
                          title="Abrir Panel Admin"
                        >
                          <span>Admin</span>
                          <Icon name="open_in_new" size={13} />
                        </a>

                        {/* Open Client */}
                        <a
                          href={`/${t.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-colors flex items-center gap-1"
                          title="Abrir Portal Cliente"
                        >
                          <span>Cliente</span>
                          <Icon name="visibility" size={13} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
