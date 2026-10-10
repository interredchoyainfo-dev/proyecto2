import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMesasStore } from '../../store/useMesasStore';
import { Icon } from '../../components/ui/Icon';

export default function MozoNuevo() {
  const createPedido = useMesasStore((s) => s.createPedido);
  const allMesas = useMesasStore((s) => s.mesas);
  const navigate = useNavigate();
  const { negocioId } = useParams();
  const mesas = useMemo(() => allMesas.filter((m) => (m.negocioId || 'giovanni').toLowerCase() === (negocioId || 'giovanni').toLowerCase()), [allMesas, negocioId]);

  const libres = mesas.filter((m) => m.estado === 'libre');

  const handleMostrador = () => {
    const id = createPedido({ tipoPedido: 'mostrador', mozoId: 'u-mozo', negocioId: negocioId || 'giovanni' });
    navigate(`/${negocioId}/app/mozos/pedido/${id}`);
  };

  const handleMesa = (mesaId: string) => {
    const id = createPedido({ tipoPedido: 'salon', mesaId, mozoId: 'u-mozo', negocioId: negocioId || 'giovanni' });
    navigate(`/${negocioId}/app/mozos/pedido/${id}`);
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-bold">Nuevo pedido</h1>

      <button
        onClick={handleMostrador}
        className="w-full p-5 rounded-2xl bg-emerald-600 text-white flex items-center gap-4 active:scale-[0.98] transition-transform"
      >
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon name="point_of_sale" size={28} />
        </div>
        <div className="text-left">
          <p className="font-bold">Venta de mostrador</p>
          <p className="text-sm opacity-80">Sin mesa asignada</p>
        </div>
      </button>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">O abrir mesa libre</h2>
        {libres.length === 0 ? (
          <p className="text-sm text-slate-500">No hay mesas libres</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {libres.map((m) => (
              <button
                key={m.id}
                onClick={() => handleMesa(m.id)}
                className="aspect-square rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center font-bold active:scale-95 transition-transform"
              >
                <span className="text-xl">{m.numero}</span>
                <span className="text-[9px] text-slate-500 capitalize">{m.sector}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
