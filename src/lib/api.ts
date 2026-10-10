import type { Espacio, Reservation, Product, Mesa, Client, Oferta } from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '')).replace(/\/+$/, '');
const API_URL = API_BASE_URL;

let activeTenant: string = 'giovanni';

/** Establece explícitamente el tenant activo para las llamadas a la API */
export function setApiTenant(tenantId: string) {
  if (tenantId) {
    activeTenant = tenantId.toLowerCase().trim();
  }
}

/** Obtiene el tenant actual según el estado en memoria o la URL del navegador */
export function getApiTenant(): string {
  if (typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && parts[0] !== 'superadmin' && parts[0] !== 'login') {
      return parts[0].toLowerCase().trim();
    }
  }
  return activeTenant || 'giovanni';
}

/** Obtiene el token de autenticación almacenado */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const directToken = localStorage.getItem('giovanni-token');
  if (directToken) return directToken;
  try {
    const stored = localStorage.getItem('giovanni-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.token || null;
    }
  } catch {}
  return null;
}

async function request<T>(path: string, options?: RequestInit, explicitTenant?: string): Promise<T> {
  if (!API_URL) {
    throw new Error('API no configurada: definí VITE_API_URL en el entorno de producción apuntando al backend con SQLite.');
  }
  const currentTenant = explicitTenant || getApiTenant();
  const sep = path.includes('?') ? '&' : '?';
  const urlWithTenant = `${API_URL}${path}${sep}negocioId=${encodeURIComponent(currentTenant)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-negocio-id': currentTenant,
    ...(options?.headers as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(urlWithTenant, {
    ...options,
    headers,
  });

  // Si vence la sesión, no dejar que la interfaz siga mutando solo el estado local.
  // Las rutas públicas de menú/reserva no deben cerrar una sesión por este control.
  if (res.status === 401 && !path.startsWith('/public/')) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('giovanni-auth');
      localStorage.removeItem('giovanni-token');
      const tenant = getApiTenant();
      if (!window.location.pathname.includes('/login')) {
        window.location.assign(`/${tenant}/login`);
      }
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.message || data?.error || res.statusText;
    throw new Error(msg || `API Error ${res.status}`);
  }
  return res.json();
}

const tenantPath = (tenantId?: string) => {
  const t = tenantId || getApiTenant();
  return `/negocios/${encodeURIComponent(t)}`;
};

export const api = {
  health: () => request<{ ok: boolean; tenantId: string; version: string }>('/health'),

  // Tenant Snapshot
  sync: (tenantId?: string) => {
    const t = tenantId || getApiTenant();
    return request<SyncPayload>(`${tenantPath(t)}/sync`, undefined, t);
  },

  // Tenants Management (SuperAdmin)
  getTenants: () => request<{ ok: boolean; tenants: any[] }>('/tenants'),
  getTenant: (id: string) => request<any>(`/tenants/${encodeURIComponent(id)}`),
  getPublicTenant: (slug: string) => request<{ ok: boolean; tenant: any }>(`/public/tenants/${encodeURIComponent(slug)}`, undefined, slug),
  createTenant: (data: any) =>
    request('/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id: string, data: any) =>
    request(`/tenants/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateBusinessSettings: (negocioId: string, data: any) =>
    request<{ success: boolean; tenant?: any }>(`${tenantPath(negocioId)}/configuracion`, { method: 'PUT', body: JSON.stringify(data) }, negocioId),
  deleteTenant: (id: string) =>
    request(`/tenants/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  resetTenant: (id: string) =>
    request(`/tenants/${encodeURIComponent(id)}/reset`, { method: 'POST' }),
  initTenant: (id: string) =>
    request<{ ok: boolean; tenantId: string }>(`/tenants/${encodeURIComponent(id)}/init`, { method: 'POST' }),

  // Espacios
  getEspacios: (negocioId?: string) =>
    request<Espacio[]>(`${tenantPath(negocioId)}/espacios`, undefined, negocioId),
  createEspacio: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<Espacio>(`${tenantPath(t)}/espacios`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  updateEspacio: (arg1: any, arg2: any, arg3?: any) => {
    const t = arg3 !== undefined ? String(arg1) : getApiTenant();
    const id = arg3 !== undefined ? String(arg2) : String(arg1);
    const data = arg3 !== undefined ? arg3 : arg2;
    return request<Espacio>(`${tenantPath(t)}/espacios/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deleteEspacio: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const id = arg2 !== undefined ? String(arg2) : String(arg1);
    return request<{ success: boolean }>(`${tenantPath(t)}/espacios/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },

  // Reservas
  getReservas: (negocioId?: string) =>
    request<Reservation[]>(`${tenantPath(negocioId)}/reservas`, undefined, negocioId),
  createReserva: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<Reservation>(`${tenantPath(t)}/reservas`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  createPublicReserva: (negocioId: string, data: any) =>
    request<Reservation>(`/public/negocios/${encodeURIComponent(negocioId)}/reservas`, { method: 'POST', body: JSON.stringify(data) }, negocioId),
  updateReserva: (arg1: any, arg2: any, arg3?: any) => {
    const t = arg3 !== undefined ? String(arg1) : getApiTenant();
    const id = arg3 !== undefined ? String(arg2) : String(arg1);
    const data = arg3 !== undefined ? arg3 : arg2;
    return request<Reservation>(`${tenantPath(t)}/reservas/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deleteReserva: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const id = arg2 !== undefined ? String(arg2) : String(arg1);
    return request<{ success: boolean }>(`${tenantPath(t)}/reservas/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },



  // Turnos fijos recurrentes
  getTurnosFijos: (negocioId?: string) =>
    request<any[]>(`${tenantPath(negocioId)}/turnos-fijos`, undefined, negocioId),
  createTurnoFijo: (data: any, negocioId?: string) => {
    const t = negocioId || getApiTenant();
    return request<any>(`${tenantPath(t)}/turnos-fijos`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  updateTurnoFijo: (id: string, data: any, negocioId?: string) => {
    const t = negocioId || getApiTenant();
    return request<any>(`${tenantPath(t)}/turnos-fijos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deleteTurnoFijo: (id: string, negocioId?: string) => {
    const t = negocioId || getApiTenant();
    return request<{ success: boolean }>(`${tenantPath(t)}/turnos-fijos/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },

  // Productos
  getProductos: (negocioId?: string) =>
    request<Product[]>(`${tenantPath(negocioId)}/productos`, undefined, negocioId),
  createProducto: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<Product>(`${tenantPath(t)}/productos`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  updateProducto: (arg1: any, arg2: any, arg3?: any) => {
    const t = arg3 !== undefined ? String(arg1) : getApiTenant();
    const id = arg3 !== undefined ? String(arg2) : String(arg1);
    const data = arg3 !== undefined ? arg3 : arg2;
    return request<Product>(`${tenantPath(t)}/productos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deleteProducto: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const id = arg2 !== undefined ? String(arg2) : String(arg1);
    return request<{ success: boolean }>(`${tenantPath(t)}/productos/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },

  // Mesas
  getMesas: (negocioId?: string) =>
    request<Mesa[]>(`${tenantPath(negocioId)}/mesas`, undefined, negocioId),
  createMesa: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<Mesa>(`${tenantPath(t)}/mesas`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  updateMesa: (arg1: any, arg2: any, arg3?: any) => {
    const t = arg3 !== undefined ? String(arg1) : getApiTenant();
    const id = arg3 !== undefined ? String(arg2) : String(arg1);
    const data = arg3 !== undefined ? arg3 : arg2;
    return request<Mesa>(`${tenantPath(t)}/mesas/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deleteMesa: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const id = arg2 !== undefined ? String(arg2) : String(arg1);
    return request<{ success: boolean }>(`${tenantPath(t)}/mesas/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },

  // Clientes
  getClientes: (negocioId?: string) =>
    request<Client[]>(`${tenantPath(negocioId)}/clientes`, undefined, negocioId),
  createCliente: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<Client>(`${tenantPath(t)}/clientes`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  updateCliente: (arg1: any, arg2: any, arg3?: any) => {
    const t = arg3 !== undefined ? String(arg1) : getApiTenant();
    const id = arg3 !== undefined ? String(arg2) : String(arg1);
    const data = arg3 !== undefined ? arg3 : arg2;
    return request<Client>(`${tenantPath(t)}/clientes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deleteCliente: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const id = arg2 !== undefined ? String(arg2) : String(arg1);
    return request<{ success: boolean }>(`${tenantPath(t)}/clientes/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },

  // Pedidos
  getPedidos: (negocioId?: string) =>
    request<any[]>(`${tenantPath(negocioId)}/pedidos`, undefined, negocioId),
  createPedido: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<any>(`${tenantPath(t)}/pedidos`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  // Los pedidos del menú público se guardan en SQLite sin abrir las rutas operativas protegidas.
  createPublicPedido: (negocioId: string, data: any) =>
    request<any>(`/public/negocios/${encodeURIComponent(negocioId)}/pedidos`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, negocioId),
  updatePedido: (arg1: any, arg2: any, arg3?: any) => {
    const t = arg3 !== undefined ? String(arg1) : getApiTenant();
    const id = arg3 !== undefined ? String(arg2) : String(arg1);
    const data = arg3 !== undefined ? arg3 : arg2;
    return request<any>(`${tenantPath(t)}/pedidos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deletePedido: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const id = arg2 !== undefined ? String(arg2) : String(arg1);
    return request<{ success: boolean }>(`${tenantPath(t)}/pedidos/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },

  // Ofertas
  getOfertas: (negocioId?: string) =>
    request<Oferta[]>(`${tenantPath(negocioId)}/ofertas`, undefined, negocioId),
  createOferta: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<Oferta>(`${tenantPath(t)}/ofertas`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  updateOferta: (arg1: any, arg2: any, arg3?: any) => {
    const t = arg3 !== undefined ? String(arg1) : getApiTenant();
    const id = arg3 !== undefined ? String(arg2) : String(arg1);
    const data = arg3 !== undefined ? arg3 : arg2;
    return request<Oferta>(`${tenantPath(t)}/ofertas/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  deleteOferta: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const id = arg2 !== undefined ? String(arg2) : String(arg1);
    return request<{ success: boolean }>(`${tenantPath(t)}/ofertas/${encodeURIComponent(id)}`, { method: 'DELETE' }, t);
  },

  // Caja
  getCajaSesion: (negocioId?: string) =>
    request<any>(`${tenantPath(negocioId)}/caja/sesion`, undefined, negocioId),
  updateCajaSesion: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<any>(`${tenantPath(t)}/caja/sesion`, { method: 'PUT', body: JSON.stringify(data) }, t);
  },
  getCajaMovimientos: (negocioId?: string) =>
    request<any[]>(`${tenantPath(negocioId)}/caja/movimientos`, undefined, negocioId),
  getCajaHistorial: (negocioId?: string) =>
    request<any[]>(`${tenantPath(negocioId)}/caja/historial`, undefined, negocioId),
  abrirCaja: (negocioIdOrData: any, maybeData?: any) => {
    const t = maybeData !== undefined ? String(negocioIdOrData) : getApiTenant();
    const data = maybeData !== undefined ? maybeData : negocioIdOrData;
    return request<any>(`${tenantPath(t)}/caja/abrir`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  cerrarCaja: (negocioIdOrData: any, maybeData?: any) => {
    const t = maybeData !== undefined ? String(negocioIdOrData) : getApiTenant();
    const data = maybeData !== undefined ? maybeData : negocioIdOrData;
    return request<any>(`${tenantPath(t)}/caja/cerrar`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
  createCajaMovimiento: (arg1: any, arg2?: any) => {
    const t = arg2 !== undefined ? String(arg1) : getApiTenant();
    const data = arg2 !== undefined ? arg2 : arg1;
    return request<any>(`${tenantPath(t)}/caja/movimientos`, { method: 'POST', body: JSON.stringify(data) }, t);
  },
};

export interface SyncPayload {
  tenantId?: string;
  productos: Product[];
  mesas: Mesa[];
  espacios: Espacio[];
  reservas: Reservation[];
  clientes: Client[];
  pedidos: any[];
  ofertas: Oferta[];
  cajaSesion: any;
  cajaMovimientos: any[];
}
