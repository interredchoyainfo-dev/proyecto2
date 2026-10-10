import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from './firebase';
import { useStore } from '../store/useStore';
import { useMesasStore } from '../store/useMesasStore';
import { useOfertasStore } from '../store/useOfertasStore';
import { getApiTenant, setApiTenant } from './api';
import type { Product, Mesa, Pedido, Reservation, Client, Espacio, CashSession, CashMovement } from '../types';

let currentListeningTenant: string | null = null;
const unsubscribes: Unsubscribe[] = [];

// Helper para limpiar valores undefined antes de enviar a Firestore
function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_key, val) => (val === undefined ? null : val)));
}

/** Obtiene el ID del tenant activo actual */
export function getCurrentTenant(): string {
  return currentListeningTenant || getApiTenant() || 'giovanni';
}

/** Helper para obtener una colección aislada dentro del namespace del negocio */
export function getTenantCollection(colName: string, tenantId?: string) {
  const tid = (tenantId || getCurrentTenant()).toLowerCase().trim();
  return collection(firestore, 'negocios', tid, colName);
}

/** Helper para obtener un documento aislado dentro del namespace del negocio */
export function getTenantDoc(colName: string, docId: string, tenantId?: string) {
  const tid = (tenantId || getCurrentTenant()).toLowerCase().trim();
  return doc(firestore, 'negocios', tid, colName, docId);
}

/**
 * Escucha en tiempo real todas las colecciones de Firestore del NEGOCIO ESPECÍFICO.
 * Si se cambia de negocio (ej. /giovanni -> /oasispadel), desuscribe los anteriores
 * y suscribe a la base de datos del nuevo negocio.
 */
export function initFirestoreRealtimeSync(rawTenantId?: string) {
  const targetTenant = (rawTenantId || getApiTenant() || 'giovanni').toLowerCase().trim();

  // Si ya estamos escuchando exactamente a este negocio, no duplicar listeners
  if (currentListeningTenant === targetTenant && unsubscribes.length > 0) {
    return;
  }

  // Cancelar suscripciones del negocio anterior
  if (unsubscribes.length > 0) {
    unsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore
      }
    });
    unsubscribes.length = 0;
  }

  currentListeningTenant = targetTenant;
  setApiTenant(targetTenant);

  console.log(`[MultiTenant Firestore] Sincronizando en tiempo real con negocio: "${targetTenant}"`);

  try {
    // 1. PRODUCTOS DEL NEGOCIO
    const unsubProductos = onSnapshot(
      getTenantCollection('productos', targetTenant),
      (snap) => {
        if (!snap.empty) {
          const products = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
          useStore.setState({ products });
        } else {
          seedInitialTenantCollectionIfEmpty('productos', targetTenant);
        }
      },
      (err) => console.warn(`Firestore productos error (${targetTenant}):`, err)
    );
    unsubscribes.push(unsubProductos);

    // Mesas y pedidos operativos se sincronizan desde la API SQLite autenticada.
    // No abrir listeners Firestore para estas colecciones: evita lecturas duplicadas y
    // que una copia antigua sobrescriba el circuito único de pedidos.
    
    // Reservas guardadas antes del cambio: lectura de compatibilidad para no ocultar registros históricos.
    // Las nuevas reservas se escriben en SQLite; si un ID existe en ambos, prevalece SQLite.
    const unsubReservas = onSnapshot(
      getTenantCollection('reservas', targetTenant),
      (snap) => {
        const legacyRows = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          negocioId: targetTenant,
          _legacyFirestore: true,
        } as Reservation & { _legacyFirestore: boolean }));
        const current = useStore.getState().reservations;
        const other = current.filter((r) => (r.negocioId || 'giovanni').toLowerCase() !== targetTenant);
        const currentTenantRows = current.filter((r) => (r.negocioId || 'giovanni').toLowerCase() === targetTenant);
        const byId = new Map<string, any>();
        legacyRows.forEach((r) => byId.set(r.id, r));
        currentTenantRows.forEach((r) => byId.set(r.id, r));
        useStore.setState({ reservations: [...other, ...byId.values()] });
      },
      (err) => console.warn(`No se pudieron leer reservas históricas de Firestore (${targetTenant}); se mantiene SQLite como fuente principal:`, err)
    );
    unsubscribes.push(unsubReservas);

    // 5. CLIENTES DEL NEGOCIO
    const unsubClientes = onSnapshot(
      getTenantCollection('clientes', targetTenant),
      (snap) => {
        if (!snap.empty) {
          const clients = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client));
          useStore.setState({ clients });
        } else {
          seedInitialTenantCollectionIfEmpty('clientes', targetTenant);
        }
      },
      (err) => console.warn(`Firestore clientes error (${targetTenant}):`, err)
    );
    unsubscribes.push(unsubClientes);

    // Los espacios ya no se sincronizan con Firestore.
    // La única fuente de verdad es la API SQLite multi-tenant de Render.
    
    // 7. OFERTAS DEL NEGOCIO
    const unsubOfertas = onSnapshot(
      getTenantCollection('ofertas', targetTenant),
      (snap) => {
        if (!snap.empty) {
          const ofertas = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
          useOfertasStore.setState({ ofertas });
        }
      },
      (err) => console.warn(`Firestore ofertas error (${targetTenant}):`, err)
    );
    unsubscribes.push(unsubOfertas);

  } catch (error) {
    console.error(`Error al inicializar Firestore Sync para "${targetTenant}":`, error);
  }
}

/**
 * Si una colección en Firestore está vacía para este negocio,
 * sembramos los datos iniciales de ese negocio SOLO SI ES GIOVANNI (base demo).
 * Otros negocios empiezan 100% limpios.
 */
const seededTenants: Record<string, boolean> = {};

async function seedInitialTenantCollectionIfEmpty(colName: string, tenantId: string) {
  // Solo se debe sembrar datos demo iniciales si el negocio es giovanni
  if (tenantId !== 'giovanni') return;

  const seedKey = `${tenantId}_${colName}`;
  if (seededTenants[seedKey]) return;
  seededTenants[seedKey] = true;

  try {
    const colRef = getTenantCollection(colName, tenantId);
    const snap = await getDocs(colRef);
    if (!snap.empty) return;

    const batch = writeBatch(firestore);

    if (colName === 'productos') {
      const current = useStore.getState().products;
      if (current.length > 0) {
        current.forEach((p) => {
          const ref = getTenantDoc('productos', p.id, tenantId);
          batch.set(ref, sanitize(p));
        });
        await batch.commit();
        console.log(`Firestore (${tenantId}): Migrados ${current.length} productos iniciales.`);
      }
    } else if (colName === 'mesas') {
      const current = useMesasStore.getState().mesas;
      if (current.length > 0) {
        current.forEach((m) => {
          const ref = getTenantDoc('mesas', m.id, tenantId);
          batch.set(ref, sanitize(m));
        });
        await batch.commit();
        console.log(`Firestore (${tenantId}): Migradas ${current.length} mesas iniciales.`);
      }
    } else if (colName === 'espacios') {
      // Intencionalmente vacío: los espacios pertenecen solo a SQLite/API.
      return;
    } else if (colName === 'clientes') {
      const current = useStore.getState().clients;
      if (current.length > 0) {
        current.forEach((c) => {
          const ref = getTenantDoc('clientes', c.id, tenantId);
          batch.set(ref, sanitize(c));
        });
        await batch.commit();
      }
    } else if (colName === 'reservas') {
      const current = useStore.getState().reservations;
      if (current.length > 0) {
        current.forEach((r) => {
          const ref = getTenantDoc('reservas', r.id, tenantId);
          batch.set(ref, sanitize(r));
        });
        await batch.commit();
      }
    }
  } catch (e) {
    console.warn(`No se pudo sembrar colección ${colName} para ${tenantId}:`, e);
  }
}

/** Reinicia reservas, ventas, pedidos y movimientos de caja en Firestore a 0 */
export async function firebaseResetTenantDataToZero(tenantId: string) {
  try {
    const tid = (tenantId || getCurrentTenant()).toLowerCase().trim();
    const batch = writeBatch(firestore);

    const [resSnap, pedSnap, movSnap] = await Promise.all([
      getDocs(getTenantCollection('reservas', tid)),
      getDocs(getTenantCollection('pedidos', tid)),
      getDocs(getTenantCollection('caja_movimientos', tid)),
    ]);

    resSnap.docs.forEach((d) => batch.delete(d.ref));
    pedSnap.docs.forEach((d) => batch.delete(d.ref));
    movSnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();

    // Resetear mesas a libre
    const mesasSnap = await getDocs(getTenantCollection('mesas', tid));
    if (!mesasSnap.empty) {
      const batchMesas = writeBatch(firestore);
      mesasSnap.docs.forEach((d) => {
        batchMesas.update(d.ref, { estado: 'libre', pedidoActivoId: null });
      });
      await batchMesas.commit();
    }
  } catch (err) {
    console.warn(`Error al reiniciar datos en Firestore para ${tenantId}:`, err);
  }
}

/** Elimina todas las colecciones de Firestore asociadas a un tenant */
export async function firebaseDeleteTenantData(tenantId: string) {
  try {
    const tid = (tenantId || '').toLowerCase().trim();
    if (!tid || tid === 'giovanni') return;
    const collections = ['productos', 'mesas', 'pedidos', 'reservas', 'clientes', 'espacios', 'ofertas', 'caja_movimientos'];
    for (const col of collections) {
      const snap = await getDocs(getTenantCollection(col, tid));
      if (!snap.empty) {
        const batch = writeBatch(firestore);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn(`Error borrando tenant en Firestore (${tenantId}):`, err);
  }
}

// ==========================================
// HELPERS DE ESCRITURA EN FIRESTORE (AISLADOS POR NEGOCIO)
// ==========================================

export async function firebaseSaveProducto(producto: Product, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await setDoc(getTenantDoc('productos', producto.id, tid), sanitize(producto), { merge: true });
  } catch (err) {
    console.error('Error al guardar producto en Firestore:', err);
  }
}

export async function firebaseDeleteProducto(id: string, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await deleteDoc(getTenantDoc('productos', id, tid));
  } catch (err) {
    console.error('Error al eliminar producto en Firestore:', err);
  }
}

export async function firebaseSaveMesa(mesa: Mesa, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await setDoc(getTenantDoc('mesas', mesa.id, tid), sanitize(mesa), { merge: true });
  } catch (err) {
    console.error('Error al guardar mesa en Firestore:', err);
  }
}

export async function firebaseSavePedido(pedido: Pedido, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await setDoc(getTenantDoc('pedidos', pedido.id, tid), sanitize(pedido), { merge: true });
  } catch (err) {
    console.error('Error al guardar pedido en Firestore:', err);
  }
}

export async function firebaseDeletePedido(id: string, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await deleteDoc(getTenantDoc('pedidos', id, tid));
  } catch (err) {
    console.error('Error al eliminar pedido en Firestore:', err);
  }
}

export async function firebaseSaveReserva(_reserva: Reservation, _tenantId?: string) {
  // Compatibilidad temporal: las reservas se persisten únicamente en SQLite/API.
  return;
}

export async function firebaseDeleteReserva(id: string, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await deleteDoc(getTenantDoc('reservas', id, tid));
  } catch (err) {
    console.error('Error al eliminar reserva en Firestore:', err);
  }
}

export async function firebaseSaveCliente(cliente: Client, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await setDoc(getTenantDoc('clientes', cliente.id, tid), sanitize(cliente), { merge: true });
  } catch (err) {
    console.error('Error al guardar cliente en Firestore:', err);
  }
}

export async function firebaseDeleteCliente(id: string, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await deleteDoc(getTenantDoc('clientes', id, tid));
  } catch (err) {
    console.error('Error al eliminar cliente en Firestore:', err);
  }
}

// Compatibilidad con llamadas antiguas: los espacios ya no se escriben en Firestore.
// La API SQLite multi-tenant es la única fuente de verdad.
export async function firebaseSaveEspacio(_espacio: Espacio, _tenantId?: string) {
  return;
}

export async function firebaseDeleteEspacio(_id: string, _tenantId?: string) {
  return;
}

export async function firebaseSaveCajaSesion(sesion: CashSession, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await setDoc(getTenantDoc('caja_sesiones', String(sesion.id), tid), sanitize(sesion), { merge: true });
  } catch (err) {
    console.error('Error al guardar sesion de caja en Firestore:', err);
  }
}

export async function firebaseSaveCajaMovimiento(movimiento: CashMovement, tenantId?: string) {
  try {
    const tid = tenantId || getCurrentTenant();
    await setDoc(getTenantDoc('caja_movimientos', movimiento.id, tid), sanitize(movimiento), { merge: true });
  } catch (err) {
    console.error('Error al guardar movimiento de caja en Firestore:', err);
  }
}
