import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from './idbStorage';
import type { Espacio, CourtStatus } from '../types';
import { persistEspacio, deleteEspacioDb } from '../components/DbSync';

const initialEspacios: Espacio[] = [
  // Giovanni
  { id: 'c1', negocioId: 'giovanni', name: 'Cancha 1 (Fútbol 5)', type: 'futbol', status: 'libre', precioHora: 15000, isActive: true },
  { id: 'c2', negocioId: 'giovanni', name: 'Cancha 2 (Fútbol 7)', type: 'futbol', status: 'reservada', precioHora: 15000, isActive: true, currentReservationId: 'r1' },
  { id: 'c3', negocioId: 'giovanni', name: 'Cancha 3 (Fútbol Pro)', type: 'futbol', status: 'en_juego', precioHora: 18000, isActive: true, currentReservationId: 'r2' },
  { id: 'c4', negocioId: 'giovanni', name: 'Cancha 4 (Pádel)', type: 'padel', status: 'libre', precioHora: 12000, isActive: true },
  { id: 's1', negocioId: 'giovanni', name: 'Salón de Eventos', type: 'quincho', status: 'mantenimiento', precioHora: 50000, isActive: true },

  // Oasis Padel Club (Totalmente independiente)
  { id: 'op-c1', negocioId: 'oasispadel', name: 'Cancha 1 Panorámica', type: 'padel', status: 'libre', precioDia: 14000, precioNoche: 16000, isActive: true },
  { id: 'op-c2', negocioId: 'oasispadel', name: 'Cancha 2 Cristal', type: 'padel', status: 'libre', precioDia: 14000, precioNoche: 16000, isActive: true },
  { id: 'op-c3', negocioId: 'oasispadel', name: 'Cancha 3 Central Pro', type: 'padel', status: 'libre', precioDia: 16000, precioNoche: 18000, isActive: true },
  { id: 'op-c4', negocioId: 'oasispadel', name: 'Cancha 4 Techada', type: 'padel', status: 'libre', precioDia: 15000, precioNoche: 17000, isActive: true },

  // Demo
  { id: 'demo-c1', negocioId: 'demo', name: 'Cancha Demo 1', type: 'padel', status: 'libre', precioHora: 10000, isActive: true },
  { id: 'demo-c2', negocioId: 'demo', name: 'Cancha Demo 2', type: 'futbol', status: 'libre', precioHora: 12000, isActive: true },
];

interface EspaciosState {
  espacios: Espacio[];
  addEspacio: (data: Omit<Espacio, 'id' | 'status' | 'isActive'> & { negocioId?: string }) => void;
  updateEspacio: (id: string, data: Partial<Espacio>) => void;
  deleteEspacio: (id: string) => void;
  updateStatus: (id: string, status: CourtStatus, reservationId?: string) => void;
  toggleActive: (id: string) => void;
  ensureTenantEspacios: (negocioId: string) => void;
  getEspaciosByTenant: (negocioId: string) => Espacio[];
}

export const useEspaciosStore = create<EspaciosState>()(
  persist(
    (set, get) => ({
      espacios: initialEspacios,

      getEspaciosByTenant: (negocioId) => {
        const clean = (negocioId || 'giovanni').toLowerCase();
        return get().espacios.filter(
          (e) => (e.negocioId || 'giovanni').toLowerCase() === clean
        );
      },

      ensureTenantEspacios: (negocioId) => {
        const clean = (negocioId || 'giovanni').toLowerCase();
        const existing = get().espacios.filter(
          (e) => (e.negocioId || 'giovanni').toLowerCase() === clean
        );
        if (existing.length === 0) {
          const starterEspacios: Espacio[] = [
            {
              id: `esp-${clean}-1`,
              negocioId: clean,
              name: 'Cancha 1 (Pádel)',
              type: 'padel',
              status: 'libre',
              precioDia: 12000,
              precioNoche: 15000,
              isActive: true,
            },
            {
              id: `esp-${clean}-2`,
              negocioId: clean,
              name: 'Cancha 2 (Pádel)',
              type: 'padel',
              status: 'libre',
              precioDia: 12000,
              precioNoche: 15000,
              isActive: true,
            },
          ];
          set((s) => ({ espacios: [...s.espacios, ...starterEspacios] }));
        }
      },

      addEspacio: (data) => {
        const targetNegocio = (data.negocioId || 'giovanni').toLowerCase();
        const full: Espacio = {
          ...data,
          id: `esp-${targetNegocio}-${Date.now()}`,
          negocioId: targetNegocio,
          status: 'libre' as CourtStatus,
          isActive: true,
        };
        set((s) => ({
          espacios: [...s.espacios, full],
        }));
        persistEspacio(full, true);
      },

      updateEspacio: (id, data) => {
        let updated: Espacio | undefined;
        set((s) => {
          const espacios = s.espacios.map((e) => {
            if (e.id === id) {
              updated = { ...e, ...data };
              return updated;
            }
            return e;
          });
          return { espacios };
        });
        if (updated) persistEspacio(updated, false);
      },

      deleteEspacio: (id) => {
        set((s) => ({
          espacios: s.espacios.filter((e) => e.id !== id),
        }));
        deleteEspacioDb(id);
      },

      updateStatus: (id, status, reservationId) => {
        set((s) => ({
          espacios: s.espacios.map((e) =>
            e.id === id
              ? { ...e, status, currentReservationId: reservationId }
              : e
          ),
        }));
        persistEspacio({ id, status, currentReservationId: reservationId }, false);
      },

      toggleActive: (id) => {
        const esp = get().espacios.find((e) => e.id === id);
        if (!esp) return;
        const nuevoActive = !esp.isActive;
        set((s) => ({
          espacios: s.espacios.map((e) =>
            e.id === id ? { ...e, isActive: nuevoActive } : e
          ),
        }));
        persistEspacio({ id, isActive: nuevoActive }, false);
      },
    }),
    { name: 'giovanni-espacios-storage', storage: idbStorage as any }
  )
);
