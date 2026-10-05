import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { useMesasStore } from '../store/useMesasStore';
import {
  initFirestoreRealtimeSync,
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

/**
 * Sincroniza Zustand ↔ Firebase Firestore (en tiempo real) + SQLite local de respaldo.
 */
export default function DbSync() {
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  useEffect(() => {
    // 1. Iniciar sincronización en tiempo real con Firebase Firestore
    try {
      initFirestoreRealtimeSync();
      setStatus('online');
    } catch (e) {
      console.warn('Error iniciando Firestore:', e);
    }

    // 2. Respaldo opcional con SQLite local
    let cancelled = false;
    let errorCount = 0;
    let lastPayload = '';

    const pull = async () => {
      try {
        const data = await api.sync();
        if (cancelled) return;
        errorCount = 0;

        const serialized = JSON.stringify(data);
        if (serialized === lastPayload) return;
        lastPayload = serialized;

        // Si Firestore aún no pobló nada, SQLite llena datos
        const curProducts = useStore.getState().products;
        if (!curProducts.length && data.productos?.length) {
          useStore.setState({ products: data.productos });
        }
        const curMesas = useMesasStore.getState().mesas;
        if (!curMesas.length && data.mesas?.length) {
          useMesasStore.setState({ mesas: data.mesas });
        }
      } catch {
        errorCount++;
      }
    };

    pull();
    const interval = setInterval(() => {
      if (errorCount < 3) pull();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (status === 'online') return null;
  return (
    <div className="fixed bottom-20 right-3 z-[200] px-2.5 py-1 rounded-full text-[10px] font-medium shadow-lg bg-amber-500/90 text-black">
      Conectando Firebase…
    </div>
  );
}

/** Guarda un pedido completo en Firebase y API local */
export async function persistPedido(pedido: any) {
  firebaseSavePedido(pedido);
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
  firebaseDeletePedido(id);
  try {
    await api.deletePedido(id);
  } catch {
    /* offline ok */
  }
}

export async function persistMesa(id: string, data: any, isNew = false) {
  firebaseSaveMesa({ id, ...data });
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
  firebaseSaveReserva(data);
  try {
    await api.createReserva(data);
  } catch {
    /* offline */
  }
}

export async function updateReservaDb(id: string, data: any) {
  firebaseSaveReserva({ id, ...data });
  try {
    await api.updateReserva(id, data);
  } catch {
    /* offline */
  }
}

export async function deleteReservaDb(id: string) {
  firebaseDeleteReserva(id);
  try {
    await api.deleteReserva(id);
  } catch {
    /* offline */
  }
}

export async function persistProducto(data: any, isNew: boolean) {
  firebaseSaveProducto(data);
  try {
    if (isNew) await api.createProducto(data);
    else await api.updateProducto(data.id, data);
  } catch {
    /* offline */
  }
}

export async function deleteProductoDb(id: string) {
  firebaseDeleteProducto(id);
  try {
    await api.deleteProducto(id);
  } catch {
    /* offline */
  }
}

export async function persistEspacio(data: any, isNew = false) {
  firebaseSaveEspacio(data);
  try {
    if (isNew) await api.createEspacio(data);
    else await api.updateEspacio(data.id, data);
  } catch {
    /* offline */
  }
}

export async function deleteEspacioDb(id: string) {
  firebaseDeleteEspacio(id);
  try {
    await api.deleteEspacio(id);
  } catch {
    /* offline */
  }
}

export async function persistCliente(data: any, isNew: boolean) {
  firebaseSaveCliente(data);
  try {
    if (isNew) await api.createCliente(data);
    else await api.updateCliente(data.id, data);
  } catch {
    /* offline */
  }
}

export async function deleteClienteDb(id: string) {
  firebaseDeleteCliente(id);
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
  firebaseSaveCajaSesion(data);
  try {
    await api.updateCajaSesion(data);
  } catch {
    /* offline */
  }
}

export async function persistCajaMovimiento(data: any) {
  firebaseSaveCajaMovimiento(data);
  try {
    await api.createCajaMovimiento(data);
  } catch {
    /* offline */
  }
}
