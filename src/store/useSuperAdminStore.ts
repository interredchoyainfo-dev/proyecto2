import { api } from '../lib/api';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModuleId, Negocio, ThemeConfig } from '../types';
import { useEspaciosStore } from './useEspaciosStore';
import { useStore } from './useStore';
import { useMesasStore } from './useMesasStore';

export interface TenantFull extends Negocio {
  plan: 'trial' | 'basic' | 'pro' | 'enterprise';
  modulos: Record<ModuleId, boolean>;
  usuariosCount: number;
  mesasCount: number;
  espaciosCount: number;
  lastActive?: string;
  adminUser?: string;
  adminPassword?: string;
}

export const THEME_PRESETS = [
  {
    id: 'superadmin',
    label: 'Púrpura SuperAdmin (SaaS)',
    primaryColor: '#8B5CF6',
    accentColor: '#A78BFA',
    secondaryColor: '#121722',
    previewBg: 'from-violet-600 to-purple-800',
  },
  {
    id: 'gold',
    label: 'Dorado Eléctrico (Original)',
    primaryColor: '#FBBF24',
    accentColor: '#F59E0B',
    secondaryColor: '#EC6A06',
    previewBg: 'from-amber-400 to-yellow-600',
  },
  {
    id: 'emerald',
    label: 'Verde Césped Deportivo',
    primaryColor: '#10B981',
    accentColor: '#34D399',
    secondaryColor: '#059669',
    previewBg: 'from-emerald-500 to-teal-700',
  },
  {
    id: 'blue',
    label: 'Azul Padel Pro',
    primaryColor: '#3B82F6',
    accentColor: '#60A5FA',
    secondaryColor: '#1D4ED8',
    previewBg: 'from-blue-500 to-indigo-700',
  },
  {
    id: 'red',
    label: 'Rojo Fuego & Piel',
    primaryColor: '#EF4444',
    accentColor: '#F87171',
    secondaryColor: '#DC2626',
    previewBg: 'from-red-500 to-rose-700',
  },
];

export const ALL_MODULES: { id: ModuleId; label: string; description: string }[] = [
  { id: 'bar', label: 'Bar / Mesas', description: 'Gestión de mesas, pedidos y salón' },
  { id: 'reservas', label: 'Reservas', description: 'Canchas, turnos y reservas online' },
  { id: 'cocina', label: 'Cocina KDS', description: 'Pantalla de comandas para cocina' },
  { id: 'caja', label: 'Caja', description: 'Apertura, cierre y movimientos de caja' },
  { id: 'inventario', label: 'Inventario', description: 'Stock por sector' },
  { id: 'mozos', label: 'App Mozos', description: 'Comandera móvil para mozos' },
  { id: 'delivery', label: 'Delivery', description: 'Gestión de repartos' },
  { id: 'torneos', label: 'Torneos', description: 'Organización de torneos y fixtures' },
  { id: 'escuela', label: 'Escuela', description: 'Clases y alumnos' },
  { id: 'access_control', label: 'Control de Accesos', description: 'Check-in QR' },
  { id: 'smart_center', label: 'Smart Center IoT', description: 'Luces, barreras y dispositivos' },
  { id: 'finanzas', label: 'Finanzas', description: 'Reportes y P&L' },
  { id: 'empleados', label: 'Empleados', description: 'RRHH y turnos' },
  { id: 'analytics_ai', label: 'Analytics AI', description: 'Predicciones de ocupación' },
];

interface SuperAdminState {
  tenants: TenantFull[];
  loading: boolean;
  modulesCatalog: typeof ALL_MODULES;
  fetchTenants: () => Promise<void>;
  toggleTenantActive: (id: string) => void;
  toggleModule: (tenantId: string, moduleId: ModuleId) => void;
  updatePlan: (tenantId: string, plan: TenantFull['plan']) => void;
  updateTenant: (
    id: string,
    data: Partial<{
      nombre: string;
      slug: string;
      subtitulo: string;
      whatsapp: string;
      plan: TenantFull['plan'];
      descripcion: string;
      theme: ThemeConfig;
      isActive: boolean;
      adminUser: string;
      adminPassword: string;
      modulos: Record<ModuleId, boolean>;
    }>
  ) => Promise<void>;
  deleteTenant: (id: string) => Promise<void>;
  resetTenantDataToZero: (id: string) => Promise<void>;
  createTenant: (data: {
    nombre: string;
    slug: string;
    plan: TenantFull['plan'];
    descripcion?: string;
    theme?: ThemeConfig;
    adminUser?: string;
    adminPassword?: string;
    modulos?: Record<ModuleId, boolean>;
  }) => Promise<void>;
  getStats: () => {
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    totalUsers: number;
  };
}

export const useSuperAdminStore = create<SuperAdminState>()(
  persist(
    (set, get) => ({
      tenants: [],
      loading: false,
      modulesCatalog: ALL_MODULES,

      fetchTenants: async () => {
        set({ loading: true });
        try {
          const res = await api.getTenants();
          if (res?.tenants) {
            set({ tenants: res.tenants as TenantFull[] });
          }
        } catch (err) {
          console.warn('[SuperAdminStore] Error fetching tenants:', err);
        } finally {
          set({ loading: false });
        }
      },

      toggleTenantActive: async (id) => {
        const tenant = get().tenants.find((t) => t.id === id || t.slug === id);
        if (!tenant) return;
        const newActive = !tenant.isActive;
        // Optimistic update
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === id || t.slug === id ? { ...t, isActive: newActive } : t
          ),
        }));
        try {
          await api.updateTenant(tenant.id, { isActive: newActive });
        } catch (err) {
          // Rollback on failure
          set((s) => ({
            tenants: s.tenants.map((t) =>
              t.id === id || t.slug === id ? { ...t, isActive: !newActive } : t
            ),
          }));
          console.error('[SuperAdminStore] toggleTenantActive failed:', err);
        }
      },

      toggleModule: async (tenantId, moduleId) => {
        const tenant = get().tenants.find((t) => t.id === tenantId || t.slug === tenantId);
        if (!tenant) return;
        const newMods = { ...tenant.modulos, [moduleId]: !tenant.modulos[moduleId] };
        // Optimistic
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === tenantId || t.slug === tenantId ? { ...t, modulos: newMods } : t
          ),
        }));
        try {
          await api.updateTenant(tenant.id, { modulos: newMods });
        } catch (err) {
          // Rollback
          set((s) => ({
            tenants: s.tenants.map((t) =>
              t.id === tenantId || t.slug === tenantId ? { ...t, modulos: tenant.modulos } : t
            ),
          }));
          console.error('[SuperAdminStore] toggleModule failed:', err);
        }
      },

      updatePlan: async (tenantId, plan) => {
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === tenantId || t.slug === tenantId ? { ...t, plan } : t
          ),
        }));
        try {
          const tenant = get().tenants.find((t) => t.id === tenantId || t.slug === tenantId);
          if (tenant) await api.updateTenant(tenant.id, { plan });
        } catch (err) {
          console.error('[SuperAdminStore] updatePlan failed:', err);
        }
      },

      updateTenant: async (id, data) => {
        const tenant = get().tenants.find((t) => t.id === id || t.slug === id);
        if (!tenant) return;
        const cleanSlug = data.slug
          ? data.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          : tenant.slug;
        const updated = { ...tenant, ...data, slug: cleanSlug };
        // Optimistic
        set((s) => ({
          tenants: s.tenants.map((t) => (t.id === id || t.slug === id ? updated : t)),
        }));
        try {
          await api.updateTenant(tenant.id, { ...data, slug: cleanSlug });
        } catch (err) {
          // Rollback
          set((s) => ({
            tenants: s.tenants.map((t) => (t.id === id || t.slug === id ? tenant : t)),
          }));
          console.error('[SuperAdminStore] updateTenant failed:', err);
          throw err;
        }
      },

      deleteTenant: async (id) => {
        const tenant = get().tenants.find((t) => t.id === id || t.slug === id);
        if (
          !tenant ||
          tenant.slug.toLowerCase() === 'giovanni' ||
          tenant.id.toLowerCase() === 'giovanni'
        ) {
          return;
        }
        const slug = tenant.slug.toLowerCase();
        // Optimistic
        set((s) => ({
          tenants: s.tenants.filter((t) => t.id !== id && t.slug !== id),
        }));
        try {
          await api.deleteTenant(tenant.id);
          // Clean local caches
          useEspaciosStore.getState().deleteEspaciosByTenant?.(slug);
          useStore.getState().resetTenantData?.(slug);
          useMesasStore.getState().deleteTenantMesas?.(slug);
        } catch (err) {
          // Rollback
          set((s) => ({ tenants: [...s.tenants, tenant] }));
          console.error('[SuperAdminStore] deleteTenant failed:', err);
          throw err;
        }
      },

      resetTenantDataToZero: async (id) => {
        const tenant = get().tenants.find((t) => t.id === id || t.slug === id);
        if (!tenant) return;
        const slug = tenant.slug.toLowerCase();
        try {
          await api.resetTenant(tenant.id);
          useStore.getState().resetTenantData?.(slug);
          useMesasStore.getState().resetTenantPedidos?.(slug);
        } catch (err) {
          console.error('[SuperAdminStore] resetTenantDataToZero failed:', err);
          throw err;
        }
      },

      createTenant: async (data) => {
        const id = data.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const exists = get().tenants.some((t) => t.slug === id || t.id === id);
        if (exists) return;

        const defaultMods = data.modulos ||
          ALL_MODULES.reduce((acc, m) => {
            acc[m.id] = ['bar', 'reservas', 'caja'].includes(m.id);
            return acc;
          }, {} as Record<ModuleId, boolean>);

        const defaultTheme: ThemeConfig = data.theme || {
          primaryColor: '#8B5CF6',
          accentColor: '#A78BFA',
          secondaryColor: '#121722',
          preset: 'superadmin',
        };

        const defaultDesc =
          data.descripcion ||
          'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional.';

        const adminUser = data.adminUser?.trim() || `admin_${id}`;
        const adminPassword = data.adminPassword?.trim() || `${id}123`;

        try {
          const res = await api.createTenant({
            id,
            slug: id,
            nombre: data.nombre,
            descripcion: defaultDesc,
            plan: data.plan,
            theme: defaultTheme,
            modulos: defaultMods,
            adminUser,
            adminPassword,
          }) as any;

          if (res?.tenant) {
            set((s) => ({ tenants: [...s.tenants, res.tenant as TenantFull] }));
          } else {
            // Optimistic fallback
            set((s) => ({
              tenants: [
                ...s.tenants,
                {
                  id,
                  slug: id,
                  nombre: data.nombre,
                  descripcion: defaultDesc,
                  theme: defaultTheme,
                  isActive: true,
                  createdAt: new Date().toISOString().split('T')[0],
                  plan: data.plan,
                  usuariosCount: 1,
                  mesasCount: 0,
                  espaciosCount: 0,
                  adminUser,
                  adminPassword,
                  modulos: defaultMods,
                  lastActive: new Date().toISOString(),
                },
              ],
            }));
          }
        } catch (err) {
          console.error('[SuperAdminStore] createTenant failed:', err);
          throw err;
        }
      },

      getStats: () => {
        const { tenants } = get();
        return {
          totalTenants: tenants.length,
          activeTenants: tenants.filter((t) => t.isActive).length,
          trialTenants: tenants.filter((t) => t.plan === 'trial').length,
          totalUsers: tenants.reduce((sum, t) => sum + (t.usuariosCount || 0), 0),
        };
      },
    }),
    { name: 'giovanni-superadmin-storage' }
  )
);
