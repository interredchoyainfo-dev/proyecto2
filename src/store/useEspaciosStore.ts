import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "./idbStorage";
import type { Espacio, EspacioStatus } from "../types";
import { persistEspacio, deleteEspacioDb } from "../components/DbSync";

// Solo el negocio base giovanni cuenta con espacios iniciales de ejemplo
const initialEspacios: Espacio[] = [
  { id: "c1", negocioId: "giovanni", name: "Cancha 1 (Fútbol 5)", type: "futbol", status: "libre", precioHora: 15000, isActive: true },
  { id: "c2", negocioId: "giovanni", name: "Cancha 2 (Fútbol 7)", type: "futbol", status: "reservada", precioHora: 15000, isActive: true, currentReservationId: "r1" },
  { id: "c3", negocioId: "giovanni", name: "Cancha 3 (Fútbol Pro)", type: "futbol", status: "en_juego", precioHora: 18000, isActive: true, currentReservationId: "r2" },
  { id: "c4", negocioId: "giovanni", name: "Cancha 4 (Pádel)", type: "padel", status: "libre", precioHora: 12000, isActive: true },
  { id: "s1", negocioId: "giovanni", name: "Salón de Eventos", type: "quincho", status: "mantenimiento", precioHora: 50000, isActive: true },
];

interface EspaciosState {
  espacios: Espacio[];
  addEspacio: (data: Omit<Espacio, "id" | "status" | "isActive"> & { negocioId?: string }) => void;
  updateEspacio: (id: string, data: Partial<Espacio>) => void;
  deleteEspacio: (id: string) => void;
  deleteEspaciosByTenant: (negocioId: string) => void;
  updateStatus: (id: string, status: EspacioStatus, reservationId?: string) => void;
  toggleActive: (id: string) => void;
  ensureTenantEspacios: (negocioId: string) => void;
  getEspaciosByTenant: (negocioId: string) => Espacio[];
}

export const useEspaciosStore = create<EspaciosState>()(
  persist(
    (set, get) => ({
      espacios: initialEspacios,

      getEspaciosByTenant: (negocioId) => {
        const clean = (negocioId || "giovanni").toLowerCase();
        return get().espacios.filter(
          (e) => (e.negocioId || "giovanni").toLowerCase() === clean
        );
      },

      // No crea espacios fantasma automáticamente para otros negocios
      ensureTenantEspacios: (_negocioId) => {
        // Los espacios solo son los creados explícitamente por el usuario
      },

      addEspacio: (data) => {
        const targetNegocio = (data.negocioId || "giovanni").toLowerCase();
        const full: Espacio = {
          ...data,
          id: `esp-${targetNegocio}-${Date.now()}`,
          negocioId: targetNegocio,
          status: "libre" as EspacioStatus,
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

      deleteEspaciosByTenant: (negocioId) => {
        const clean = (negocioId || "giovanni").toLowerCase();
        set((s) => ({
          espacios: s.espacios.filter(
            (e) => (e.negocioId || "giovanni").toLowerCase() !== clean
          ),
        }));
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
    {
      name: "giovanni-espacios-storage-v4",
      storage: createJSONStorage(() => idbStorage),
      migrate: (persistedState: any) => {
        if (!persistedState || !Array.isArray(persistedState.espacios)) {
          return { espacios: initialEspacios };
        }
        // Limpieza automática de espacios ficticios anteriores
        const cleaned = persistedState.espacios.filter((e: Espacio) => {
          if (!e || !e.id) return false;
          const nid = (e.negocioId || "giovanni").toLowerCase();
          if (e.id.startsWith("op-") || e.id.startsWith("demo-") || e.id.startsWith("esp-oasispadel-1") || e.id.startsWith("esp-oasispadel-2")) {
            return false;
          }
          if (nid === "oasispadel" && ["c1", "c2", "c3", "c4", "s1"].includes(e.id)) {
            return false;
          }
          return true;
        });
        return { ...persistedState, espacios: cleaned };
      },
    }
  )
);
