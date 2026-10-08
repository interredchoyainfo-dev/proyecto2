import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';

export interface Oferta {
  id: string;
  titulo: string;
  descripcion: string;
  descuentoPct?: number;
  descuentoMonto?: number;
  activo: boolean;
  // Programación
  fechaDesde?: string; // YYYY-MM-DD
  fechaHasta?: string;
  diasSemana?: number[]; // 0-6, vacío = todos
  horaDesde?: string; // HH:mm
  horaHasta?: string;
  createdAt: string;
}

interface OfertasState {
  ofertas: Oferta[];
  addOferta: (data: Omit<Oferta, 'id' | 'createdAt'>) => void;
  updateOferta: (id: string, data: Partial<Oferta>) => void;
  deleteOferta: (id: string) => void;
  toggleActivo: (id: string) => void;
  getOfertasActivasAhora: () => Oferta[];
}

export function isOfertaVigente(o: Oferta, now = new Date()): boolean {
  if (!o.activo) return false;
  const today = now.toISOString().split('T')[0];
  if (o.fechaDesde && today < o.fechaDesde) return false;
  if (o.fechaHasta && today > o.fechaHasta) return false;
  if (o.diasSemana && o.diasSemana.length > 0 && !o.diasSemana.includes(now.getDay())) return false;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (o.horaDesde && hhmm < o.horaDesde) return false;
  if (o.horaHasta && hhmm > o.horaHasta) return false;
  return true;
}

import { persistOferta, deleteOfertaDb } from '../components/DbSync';

export const useOfertasStore = create<OfertasState>()(
  persist(
    (set, get) => ({
      ofertas: [
        {
          id: 'of1',
          titulo: '2x1 en Cervezas',
          descripcion: 'Llevá 2 cervezas artesanales al precio de 1',
          descuentoPct: 50,
          activo: true,
          diasSemana: [5, 6], // Vie y Sáb
          horaDesde: '18:00',
          horaHasta: '23:00',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'of2',
          titulo: 'Happy Hour Papas',
          descripcion: '20% off en papas fritas y cheddar',
          descuentoPct: 20,
          activo: true,
          horaDesde: '17:00',
          horaHasta: '20:00',
          createdAt: new Date().toISOString(),
        },
      ],

      addOferta: (data) => {
        const full = { ...data, id: `of${Date.now()}`, createdAt: new Date().toISOString() };
        set((s) => ({
          ofertas: [...s.ofertas, full],
        }));
        persistOferta(full, true);
      },

      updateOferta: (id, data) => {
        set((s) => ({
          ofertas: s.ofertas.map((o) => (o.id === id ? { ...o, ...data } : o)),
        }));
        persistOferta({ id, ...data }, false);
      },

      deleteOferta: (id) => {
        set((s) => ({ ofertas: s.ofertas.filter((o) => o.id !== id) }));
        deleteOfertaDb(id);
      },

      toggleActivo: (id) => {
        const item = get().ofertas.find((o) => o.id === id);
        if (!item) return;
        const nuevoActivo = !item.activo;
        set((s) => ({
          ofertas: s.ofertas.map((o) => (o.id === id ? { ...o, activo: nuevoActivo } : o)),
        }));
        persistOferta({ id, activo: nuevoActivo }, false);
      },

      getOfertasActivasAhora: () => get().ofertas.filter((o) => isOfertaVigente(o)),
    }),
    { name: 'giovanni-ofertas-storage-v2', storage: createJSONStorage(() => idbStorage) }
  )
);
