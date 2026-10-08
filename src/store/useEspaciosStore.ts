import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "./idbStorage";
import type { Espacio, EspacioStatus } from "../types";
import { api } from "../lib/api";



interface EspaciosState {
  espacios: Espacio[];
  fetchEspacios: (negocioId: string) => Promise<void>;
  addEspacio: (negocioIdOrData: string | (Omit<Espacio, "id" | "status" | "isActive"> & { negocioId?: string }), maybeData?: Omit<Espacio, "id" | "status" | "isActive" | "negocioId">) => Promise<Espacio>;
  updateEspacio: (id: string, data: Partial<Espacio>) => Promise<void>;
  deleteEspacio: (id: string, negocioId?: string) => Promise<void>;
  deleteEspaciosByTenant: (negocioId: string) => void;
  updateStatus: (id: string, status: EspacioStatus, reservationId?: string) => void;
  toggleActive: (id: string) => void;
  ensureTenantEspacios: (negocioId: string) => void;
  getEspaciosByTenant: (negocioId: string) => Espacio[];
}

export const useEspaciosStore = create<EspaciosState>()(
  persist(
    (set, get) => ({
      espacios: [],

      getEspaciosByTenant: (negocioId) => {
        const clean = (negocioId || "giovanni").toLowerCase().trim();
        return get().espacios.filter(
          (e) => (e.negocioId || "giovanni").toLowerCase().trim() === clean
        );
      },

      ensureTenantEspacios: (_negocioId) => {
        // Los espacios solo son los creados explícitamente por el usuario
      },

      fetchEspacios: async (negocioId) => {
        const clean = (negocioId || "giovanni").toLowerCase().trim();
        try {
          const remote = await api.getEspacios(clean);
          if (Array.isArray(remote)) {
            set((s) => {
              const other = s.espacios.filter(
                (e) => (e.negocioId || "giovanni").toLowerCase().trim() !== clean
              );
              return { espacios: [...other, ...remote] };
            });
          }
        } catch (err) {
          console.warn(`[useEspaciosStore] Error fetching espacios para ${clean}:`, err);
        }
      },

      addEspacio: async (negocioIdOrData, maybeData) => {
        let targetNegocio: string;
        let data: any;

        if (typeof negocioIdOrData === 'string') {
          targetNegocio = negocioIdOrData.toLowerCase().trim();
          data = maybeData || {};
        } else {
          targetNegocio = (negocioIdOrData.negocioId || "giovanni").toLowerCase().trim();
          data = negocioIdOrData;
        }

        const id = `esp-${targetNegocio}-${crypto.randomUUID().slice(0, 8)}`;
        const full: Espacio = {
          ...data,
          id,
          negocioId: targetNegocio,
          status: "libre" as EspacioStatus,
          isActive: true,
        };

        // Actualización optimista local
        set((s) => ({
          espacios: [...s.espacios, full],
        }));

        // Persistencia en backend real
        try {
          const created = await api.createEspacio(targetNegocio, full);
          if (created && created.id) {
            set((s) => ({
              espacios: s.espacios.map((e) => (e.id === full.id ? created : e)),
            }));
            return created;
          }
        } catch (err) {
          console.warn(`[useEspaciosStore] Error persistiendo espacio en backend:`, err);
        }

        return full;
      },

      updateEspacio: async (id, data) => {
        // Protege contra la modificación involuntaria de tenant, id o createdAt
        const { negocioId: _n, id: _i, ...safePayload } = data as any;
        let targetEspacio: Espacio | undefined;

        set((s) => {
          const espacios = s.espacios.map((e) => {
            if (e.id === id) {
              targetEspacio = { ...e, ...safePayload };
              return targetEspacio;
            }
            return e;
          });
          return { espacios };
        });

        if (targetEspacio) {
          const tNegocio = targetEspacio.negocioId || "giovanni";
          try {
            await api.updateEspacio(tNegocio, id, targetEspacio);
          } catch (err) {
            console.warn(`[useEspaciosStore] Error actualizando espacio en backend:`, err);
          }
        }
      },

      deleteEspacio: async (id, negocioId) => {
        const esp = get().espacios.find((e) => e.id === id);
        const tNegocio = negocioId || esp?.negocioId || "giovanni";

        set((s) => ({
          espacios: s.espacios.filter((e) => e.id !== id),
        }));

        try {
          await api.deleteEspacio(tNegocio, id);
        } catch (err) {
          console.warn(`[useEspaciosStore] Error eliminando espacio en backend:`, err);
        }
      },

      deleteEspaciosByTenant: (negocioId) => {
        const clean = (negocioId || "giovanni").toLowerCase().trim();
        set((s) => ({
          espacios: s.espacios.filter(
            (e) => (e.negocioId || "giovanni").toLowerCase().trim() !== clean
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
        const esp = get().espacios.find((e) => e.id === id);
        if (esp) {
          api.updateEspacio(esp.negocioId || "giovanni", id, { status, currentReservationId: reservationId }).catch(() => {});
        }
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
        api.updateEspacio(esp.negocioId || "giovanni", id, { isActive: nuevoActive }).catch(() => {});
      },
    }),
    {
      name: "giovanni-espacios-storage-v5",
      storage: createJSONStorage(() => idbStorage),
      migrate: (persistedState: any) => {
        // Al migrar, limpiar cualquier dato hardcodeado legacy
        if (!persistedState || !Array.isArray(persistedState.espacios)) {
          return { espacios: [] };
        }
        // Eliminar IDs hardcodeados legacy (c1-c4, s1, op-*, demo-*)
        const legacyIds = new Set(['c1', 'c2', 'c3', 'c4', 's1']);
        const cleaned = persistedState.espacios.filter((e: Espacio) => {
          if (!e || !e.id) return false;
          if (legacyIds.has(e.id)) return false;
          if (e.id.startsWith('op-') || e.id.startsWith('demo-')) return false;
          return true;
        });
        return { ...persistedState, espacios: cleaned };
      },
    }
  )
);
