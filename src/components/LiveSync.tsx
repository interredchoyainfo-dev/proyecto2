import { useEffect } from 'react';
import { onCrossTabSync } from '../store/crossTabSync';

/**
 * Mantiene la sincronización entre pestañas de manera pasiva y segura.
 * Con Firestore en tiempo real, evitamos llamadas recursivas a rehydrate()
 * que saturaban la CPU y congelaban la pantalla.
 */
export default function LiveSync() {
  useEffect(() => {
    let lastSync = 0;
    const unsub = onCrossTabSync(() => {
      const now = Date.now();
      if (now - lastSync < 2000) return; // Debounce de seguridad
      lastSync = now;
    });

    return () => {
      unsub();
    };
  }, []);

  return null;
}
