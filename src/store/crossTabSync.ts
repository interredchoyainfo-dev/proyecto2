/**
 * Sincroniza stores de Zustand entre pestañas del mismo navegador.
 * Usa storage events + BroadcastChannel para cambios casi instantáneos.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
const CHANNEL_NAME = 'giovanni-live-sync';

let bc: BroadcastChannel | null = null;

try {
  bc = new BroadcastChannel(CHANNEL_NAME);
  bc.onmessage = () => {
    listeners.forEach((fn) => fn());
  };
} catch {
  // BroadcastChannel no disponible
}

let _notifyTimer: ReturnType<typeof setTimeout> | null = null;

/** Avisar a otras pestañas que hubo un cambio (debounced) */
export function notifyOtherTabs() {
  if (_notifyTimer) clearTimeout(_notifyTimer);
  _notifyTimer = setTimeout(() => {
    try {
      const key = 'giovanni-live-ping';
      localStorage.setItem(key, String(Date.now()));
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    try {
      bc?.postMessage({ t: Date.now() });
    } catch {
      // ignore
    }
  }, 1000);
}

/** Suscribirse a cambios de otras pestañas */
export function onCrossTabSync(fn: Listener) {
  listeners.add(fn);

  const onStorage = (e: StorageEvent) => {
    if (
      e.key === 'giovanni-live-ping' ||
      e.key === 'giovanni-mesas-storage' ||
      e.key === 'giovanni-admin-storage-v2' ||
      e.key === 'giovanni-espacios-storage' ||
      e.key === 'giovanni-ofertas-storage'
    ) {
      fn();
    }
  };

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}
