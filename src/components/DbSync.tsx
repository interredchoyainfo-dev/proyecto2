import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, getApiTenant, setApiTenant } from '../lib/api';
import { useStore } from '../store/useStore';
import { useMesasStore } from '../store/useMesasStore';
import { useEspaciosStore } from '../store/useEspaciosStore';
import { useOfertasStore } from '../store/useOfertasStore';
import {
  initFirestoreRealtimeSync,
  getCurrentTenant,
  firebaseSaveProducto,
  firebaseDeleteProducto,
  firebaseSaveMesa,
  firebaseSavePedido,
  firebaseDeletePedido,
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

    // 2. Respaldo y carga inicial desde SQLite de este negocio
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
          useMesasStore.setState({ mesas: data.mesas });
        }
        if (Array.isArray(data.pedidos)) {
          if (data.pedidos.length > 0 || useMesasStore.getState().pedidos.length === 0) {
            useMesasStore.setState({ pedidos: data.pedidos });
          }
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
            negocioId: r.negocioId || activeNegocio,
          }));
          const otherRes = useStore
            .getState()
            .reservations.filter((r) => (r.negocioId || 'giovanni').toLowerCase() !== activeNegocio);
          useStore.setState({ reservations: [...otherRes, ...normalized] });
        }
        if (Array.isArray(data.clientes) && data.clientes.length > 0) {
          useStore.setState({ clients: data.clientes });
        }
        if (Array.isArray(data.ofertas) && data.ofertas.length > 0) {
          useOfertasStore.setState({ ofertas: data.ofertas });
        }
      } catch {
        errorCount++;
        if (errorCount >= 3) setStatus('offline');
      }
    };

    pull();
    const interval = setInterval(() => {
      if (errorCount < 3) pull();
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeNegocio]);

  if (status === 'online') return null;
  return (
    <div className="fixed bottom-20 right-3 z-[200] px-2.5 py-1 rounded-full text-[10px] font-medium shadow-lg bg-amber-500/90 text-black">
      Conectando {activeNegocio}…
    </div>
  );
}

/** Guarda un pedido completo en Firebase y API local del negocio */
export async function persistPedido(pedido: any) {
  const tenant = getCurrentTenant();
  firebaseSavePedido(pedido, tenant);
  try {
    const existing = await api.getPedidos();
    const found = existing.find((p: any) => p.id === pedido.id);
    if (found) await api.updatePedido(pedido.id, pedido);
    else await api.createPedido(pedido);
  } catch {
    /* offline ok */
  }
}

export async function deletePedidoDb(id: string) {
  const tenant = getCurrentTenant();
  firebaseDeletePedido(id, tenant);
  try {
    await api.deletePedido(id);
  } catch {
    /* offline ok */
  }
}

export async function persistMesa(id: string, data: any, isNew = false) {
  const tenant = getCurrentTenant();
  firebaseSaveMesa({ id, ...data }, tenant);
  try {
    if (isNew) await api.createMesa({ id, ...data });
    else await api.updateMesa(id, data);
  } catch {
    /* offline */
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
