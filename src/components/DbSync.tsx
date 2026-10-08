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
  firebaseSaveReserva,
  firebaseDeleteReserva,
  firebaseSaveCliente,
  firebaseDeleteCliente,
  firebaseSaveEspacio,
  firebaseDeleteEspacio,
  firebaseSaveCajaSesion,
  firebaseSaveCajaMovimiento,
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

    // 1. Iniciar sincronización en tiempo real con la colección del negocio en Firebase
    try {
      initFirestoreRealtimeSync(activeNegocio);
      setStatus('online');
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

        const serialized = JSON.stringify(data);
        if (serialized === lastPayload) return;
        lastPayload = serialized;

        // Poblamos los stores con los datos exclusivos del negocio
        if (data.productos) {
          useStore.setState({ products: data.productos });
        }
        if (data.mesas) {
          useMesasStore.setState({ mesas: data.mesas });
        }
        if (data.pedidos) {
          useMesasStore.setState({ pedidos: data.pedidos });
        }
        if (data.espacios) {
          useEspaciosStore.setState({ espacios: data.espacios });
        }
        if (data.reservas) {
          useStore.setState({ reservations: data.reservas });
        }
        if (data.clientes) {
          useStore.setState({ clients: data.clientes });
        }
        if (data.ofertas) {
          useOfertasStore.setState({ ofertas: data.ofertas });
        }
      } catch {
        errorCount++;
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
  const tenant = getCurrentTenant();
  firebaseSaveReserva(data, tenant);
  try {
    await api.createReserva(data);
  } catch {
    /* offline */
  }
}

export async function updateReservaDb(id: string, data: any) {
  const tenant = getCurrentTenant();
  firebaseSaveReserva({ id, ...data }, tenant);
  try {
    await api.updateReserva(id, data);
  } catch {
    /* offline */
  }
}

export async function deleteReservaDb(id: string) {
  const tenant = getCurrentTenant();
  firebaseDeleteReserva(id, tenant);
  try {
    await api.deleteReserva(id);
  } catch {
    /* offline */
  }
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
  const tenant = getCurrentTenant();
  firebaseSaveCajaSesion(data, tenant);
  try {
    await api.updateCajaSesion(data);
  } catch {
    /* offline */
  }
}

export async function persistCajaMovimiento(data: any) {
  const tenant = getCurrentTenant();
  firebaseSaveCajaMovimiento(data, tenant);
  try {
    await api.createCajaMovimiento(data);
  } catch {
    /* offline */
  }
}
