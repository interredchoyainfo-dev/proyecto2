import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, getApiTenant, getAuthToken, setApiTenant } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../store/useStore';
import { useMesasStore } from '../store/useMesasStore';
import { useEspaciosStore } from '../store/useEspaciosStore';
import { useOfertasStore } from '../store/useOfertasStore';
import {
  initFirestoreRealtimeSync,
  getCurrentTenant,
  firebaseSaveProducto,
  firebaseDeleteProducto,
  firebaseSaveCliente,
  firebaseDeleteCliente,
  firebaseSaveEspacio,
  firebaseDeleteEspacio,
} from '../lib/firebaseSync';

interface DbSyncProps {
  negocioId?: string;
}

/**
 * Sincroniza Zustand ↔ Firebase Firestore (en tiempo real) + SQLite local de respaldo
 * de forma 100% AISLADA e INDEPENDIENTE para cada negocio / cliente.
 */
export default function DbSync({ negocioId: propNegocioId }: DbSyncProps) {
  const routeParams = useParams<{ negocioId?: string }>();
  const activeNegocio = (propNegocioId || routeParams.negocioId || getApiTenant() || 'giovanni').toLowerCase().trim();

  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  useEffect(() => {
    if (!activeNegocio || activeNegocio === 'superadmin' || activeNegocio === 'login') return;

    setApiTenant(activeNegocio);

    // 1. Iniciar sincronización en tiempo real con la colección del negocio en Firebase.
    // La conexión a Firebase no confirma que la API SQLite esté disponible.
    try {
      initFirestoreRealtimeSync(activeNegocio);
    } catch (e) {
      console.warn(`Error iniciando Firestore para ${activeNegocio}:`, e);
    }

    // La API protegida solo se consulta después de restaurar una sesión válida.
    // El portal público puede seguir usando el catálogo legado de Firestore, pero no debe
    // generar peticiones operativas que el backend correctamente rechaza con 401.
    if (authLoading) {
      setStatus('connecting');
      return;
    }

    // El menú público usa una lectura limitada y sin autenticación a SQLite.
    // Así el pedido del cliente no depende de que Firestore tenga cuota disponible.
    if (!user) {
      let cancelled = false;
      const pullPublicMenu = async () => {
        try {
          const menu = await api.getPublicMenu(activeNegocio);
          if (cancelled) return;
          useStore.setState({ products: menu.productos || [] });
          const otherMesas = useMesasStore.getState().mesas.filter(
            (mesa) => (mesa.negocioId || 'giovanni').toLowerCase().trim() !== activeNegocio
          );
          const publicMesas = (menu.mesas || []).map((mesa: any) => ({
            ...mesa,
            negocioId: activeNegocio,
          }));
          useMesasStore.setState({ mesas: [...otherMesas, ...publicMesas] });
          setStatus('online');
        } catch (error) {
          if (!cancelled) console.warn(`[DbSync] No se pudo cargar el menú público de ${activeNegocio}:`, error);
        }
      };
      pullPublicMenu();
      const publicInterval = setInterval(pullPublicMenu, 30000);
      return () => {
        cancelled = true;
        clearInterval(publicInterval);
      };
    }

    // 2. Fuente de verdad operativa: SQLite por API autenticada.
    let cancelled = false;
    let errorCount = 0;
    let lastPayload = '';

    const pull = async () => {
      try {
        const data = await api.sync(activeNegocio);
        if (cancelled) return;
        errorCount = 0;
        setStatus('online');

        const serialized = JSON.stringify(data);
        if (serialized === lastPayload) return;
        lastPayload = serialized;

        // Poblamos los stores asegurando no pisar con datos vacíos o catálogo incompleto
        if (Array.isArray(data.productos) && data.productos.length > 0) {
          const currentProds = useStore.getState().products;
          if (currentProds.length <= data.productos.length || currentProds.length === 0) {
            useStore.setState({ products: data.productos });
          }
        }
        if (Array.isArray(data.mesas) && data.mesas.length > 0) {
          const currentMesas = useMesasStore.getState().mesas;
          const otherMesas = currentMesas.filter((m) => (m.negocioId || 'giovanni').toLowerCase().trim() !== activeNegocio);
          const tenantMesas = new Map(
            currentMesas
              .filter((m) => (m.negocioId || 'giovanni').toLowerCase().trim() === activeNegocio)
              .map((m) => [m.id, m])
          );
          data.mesas.forEach((mesa: any) => tenantMesas.set(mesa.id, { ...mesa, negocioId: activeNegocio }));
          useMesasStore.setState({ mesas: [...otherMesas, ...tenantMesas.values()] });
        }
        if (Array.isArray(data.pedidos) && data.pedidos.length > 0) {
          const currentPedidos = useMesasStore.getState().pedidos;
          const otherPedidos = currentPedidos.filter((p) => (p.negocioId || 'giovanni').toLowerCase().trim() !== activeNegocio);
          const tenantPedidos = new Map(
            currentPedidos
              .filter((p) => (p.negocioId || 'giovanni').toLowerCase().trim() === activeNegocio)
              .map((p) => [p.id, p])
          );
          data.pedidos.forEach((incoming: any) => {
            const pedido = { ...incoming, negocioId: activeNegocio };
            const existing = tenantPedidos.get(pedido.id);
            // If local state has a newer mutation, do not roll it back with a stale poll response.
            const localTime = existing?.updatedAt ? Date.parse(existing.updatedAt) : NaN;
            const remoteTime = pedido.updatedAt ? Date.parse(pedido.updatedAt) : NaN;
            if (!existing || !Number.isFinite(localTime) || !Number.isFinite(remoteTime) || remoteTime >= localTime) {
              tenantPedidos.set(pedido.id, pedido);
            }
          });
          useMesasStore.setState({ pedidos: [...otherPedidos, ...tenantPedidos.values()] });
        }
        // SQLite/API es la única fuente de verdad para espacios.
        // Reemplazar también con [] es esencial: evita que sobrevivan espacios viejos
        // del almacenamiento local cuando el servidor confirma que el negocio no tiene ninguno.
        if (Array.isArray(data.espacios)) {
          const cleanEspacios = data.espacios
            .filter((e: any) => {
              const id = String(e?.id || '');
              if (activeNegocio !== 'giovanni' && (
                id.startsWith('op-') ||
                id.startsWith('demo-') ||
                ['c1', 'c2', 'c3', 'c4', 's1'].includes(id)
              )) return false;
              return true;
            })
            .map((e: any) => ({ ...e, negocioId: activeNegocio }));
          const otherEspacios = useEspaciosStore
            .getState()
            .espacios.filter((e) => (e.negocioId || 'giovanni').toLowerCase().trim() !== activeNegocio);
          useEspaciosStore.setState({ espacios: [...otherEspacios, ...cleanEspacios] });
        }
        if (Array.isArray(data.reservas)) {
          const normalized = data.reservas.map((r: any) => ({
            ...r,
            espacioId: r.espacioId || r.courtId,
            // The API response is already scoped to activeNegocio. Always use the slug
            // used by the UI so tenant filtering cannot make rows disappear/reappear
            // when the database stores the canonical business ID instead of its slug.
            negocioId: activeNegocio,
            _legacyFirestore: false,
          }));
          const current = useStore.getState().reservations;
          const otherRes = current.filter((r) => (r.negocioId || 'giovanni').toLowerCase() !== activeNegocio);
          const legacyRows = current.filter((r) =>
            (r.negocioId || 'giovanni').toLowerCase() === activeNegocio && Boolean((r as any)._legacyFirestore)
          );
          const byId = new Map<string, any>();
          legacyRows.forEach((r) => byId.set(r.id, r));
          normalized.forEach((r: any) => byId.set(r.id, r));
          useStore.setState({ reservations: [...otherRes, ...byId.values()] });
        }
        if (Array.isArray(data.clientes) && data.clientes.length > 0) {
          useStore.setState({ clients: data.clientes });
        }
        if (Array.isArray(data.ofertas) && data.ofertas.length > 0) {
          useOfertasStore.setState({ ofertas: data.ofertas });
        }
      } catch (error) {
        errorCount++;
        if (errorCount === 1) console.warn(`[DbSync] No se pudo sincronizar ${activeNegocio}; se reintentará:`, error);
        if (errorCount >= 3) setStatus('offline');
      }
    };

    pull();
    const interval = setInterval(() => {
      if (errorCount < 3) pull();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeNegocio, user?.id, authLoading]);

  if (!authLoading && !user) return null;
  if (status === 'online') return null;
  return (
    <div className="fixed bottom-20 right-3 z-[200] px-2.5 py-1 rounded-full text-[10px] font-medium shadow-lg bg-amber-500/90 text-black">
      Conectando {activeNegocio}…
    </div>
  );
}

/** Guarda un pedido completo en Firebase y API local del negocio */
export async function persistPedido(pedido: any) {
  const tenant = String(pedido.negocioId || getCurrentTenant()).toLowerCase();
  try {
    // El menú del cliente no tiene sesión de staff: usa un endpoint público limitado
    // a crear pedidos confirmados, con precio/stock validados por el servidor.
    if (!getAuthToken()) {
      await api.createPublicPedido(tenant, pedido);
      return;
    }
    const existing = await api.getPedidos(tenant);
    const found = existing.find((p: any) => p.id === pedido.id);
    if (found) await api.updatePedido(tenant, pedido.id, pedido);
    else await api.createPedido(tenant, pedido);
  } catch (error) {
    console.error(`[Pedidos] No se pudo guardar el pedido ${pedido.id} en ${tenant}:`, error);
  }
}

export async function deletePedidoDb(id: string) {
  if (!getAuthToken()) return;
  try {
    await api.deletePedido(id);
  } catch (error) {
    console.error(`[Pedidos] No se pudo eliminar el pedido ${id}:`, error);
  }
}

export async function persistMesa(id: string, data: any, isNew = false) {
  // Los clientes públicos no pueden mutar mesas directamente. El endpoint de pedido
  // marca la mesa ocupada dentro de la misma transacción de creación del pedido.
  if (!getAuthToken()) return;
  const tenant = String(data.negocioId || getCurrentTenant()).toLowerCase();
  try {
    if (isNew) await api.createMesa(tenant, { id, ...data });
    else await api.updateMesa(tenant, id, data);
  } catch (error) {
    console.error(`[Mesas] No se pudo guardar la mesa ${id} en ${tenant}:`, error);
  }
}

export async function deleteMesaDb(id: string) {
  try {
    await api.deleteMesa(id);
  } catch {
    /* offline */
  }
}

export async function persistReserva(data: any) {
  const tenant = String(data.negocioId || getApiTenant() || 'giovanni').toLowerCase();
  return api.createReserva(tenant, data);
}

export async function updateReservaDb(id: string, data: any) {
  const tenant = String(data.negocioId || getApiTenant() || 'giovanni').toLowerCase();
  return api.updateReserva(tenant, id, data);
}

export async function deleteReservaDb(id: string) {
  return api.deleteReserva(getApiTenant(), id);
}

export async function persistProducto(data: any, isNew: boolean) {
  const tenant = getCurrentTenant();
  firebaseSaveProducto(data, tenant);
  try {
    if (isNew) await api.createProducto(data);
    else await api.updateProducto(data.id, data);
  } catch {
    /* offline */
  }
}

export async function deleteProductoDb(id: string) {
  const tenant = getCurrentTenant();
  firebaseDeleteProducto(id, tenant);
  try {
    await api.deleteProducto(id);
  } catch {
    /* offline */
  }
}

export async function persistEspacio(data: any, isNew = false) {
  const tenant = getCurrentTenant();
  firebaseSaveEspacio(data, tenant);
  try {
    if (isNew) await api.createEspacio(data);
    else await api.updateEspacio(data.id, data);
  } catch {
    /* offline */
  }
}

export async function deleteEspacioDb(id: string) {
  const tenant = getCurrentTenant();
  firebaseDeleteEspacio(id, tenant);
  try {
    await api.deleteEspacio(id);
  } catch {
    /* offline */
  }
}

export async function persistCliente(data: any, isNew: boolean) {
  const tenant = getCurrentTenant();
  firebaseSaveCliente(data, tenant);
  try {
    if (isNew) await api.createCliente(data);
    else await api.updateCliente(data.id, data);
  } catch {
    /* offline */
  }
}

export async function deleteClienteDb(id: string) {
  const tenant = getCurrentTenant();
  firebaseDeleteCliente(id, tenant);
  try {
    await api.deleteCliente(id);
  } catch {
    /* offline */
  }
}

export async function persistOferta(data: any, isNew: boolean) {
  try {
    if (isNew) await api.createOferta(data);
    else await api.updateOferta(data.id, data);
  } catch {
    /* offline */
  }
}

export async function deleteOfertaDb(id: string) {
  try {
    await api.deleteOferta(id);
  } catch {
    /* offline */
  }
}

export async function persistCajaSesion(data: any) {
  // La API SQLite es la fuente de verdad para caja: evita duplicados y escrituras globales en Firestore.
  const tenant = String(data.negocioId || getCurrentTenant()).toLowerCase();
  return api.updateCajaSesion(tenant, data);
}

export async function persistCajaMovimiento(data: any) {
  // El backend asigna el ID definitivo y valida que exista una caja abierta para este negocio.
  const tenant = String(data.negocioId || getCurrentTenant()).toLowerCase();
  return api.createCajaMovimiento(tenant, data);
}
