import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMesasStore } from '../../store/useMesasStore';
import type { MesaEstado } from '../../types';

const estadoStyle: Record<MesaEstado, string> = {
  libre: 'bg-emerald-500 text-white',
  ocupada: 'bg-amber-500 text-white',
  reservada: 'bg-blue-500 text-white',
  cuenta_pedida: 'bg-violet-600 text-white',
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function MozoMesas() {
  const allMesas = useMesasStore((s) => s.mesas);
  const getPedidoByMesa = useMesasStore((s) => s.getPedidoByMesa);
  const createPedido = useMesasStore((s) => s.createPedido);
  const navigate = useNavigate();
  const { negocioId } = useParams();
  const mesas = useMemo(() => allMesas.filter((m) => (m.negocioId || 'giovanni').toLowerCase() === (negocioId || 'giovanni').toLowerCase()), [allMesas, negocioId]);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const handleMesaClick = (mesaId: string, estado: MesaEstado) => {
    const pedido = getPedidoByMesa(mesaId, negocioId);
    if (pedido) {
      navigate(`/${negocioId}/app/mozos/pedido/${pedido.id}`);
      return;
    }
    // Mesa libre/reservada: crear pedido en borrador SIN marcar ocupada hasta que haya ítems
    // Marcamos ocupada solo al agregar el primer producto (en addItemToPedido) o al enviar
    const pedidoId = createPedido({
      tipoPedido: 'salon',
      mesaId,
      mozoId: 'u-mozo',
      negocioId: negocioId || 'giovanni',
    });
    // Revertir a libre si se abrió solo para mirar — la ocupación real al agregar items
    // createPedido marca ocupada; la corregimos:
    useMesasStore.getState().updateMesaEstado(mesaId, estado === 'reservada' ? 'reservada' : 'libre', undefined, negocioId || 'giovanni');
    navigate(`/${negocioId}/app/mozos/pedido/${pedidoId}`);
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold">Mis Mesas</h1>
      <p className="text-xs text-slate-500">Tocá una mesa para ver o tomar pedido. Solo se ocupa al agregar productos.</p>

      <div className="grid grid-cols-3 gap-3">
        {mesas
          .slice()
          .sort((a, b) => a.numero - b.numero)
          .map((mesa) => {
            const pedido = getPedidoByMesa(mesa.id, negocioId);
            const hasItems = (pedido?.items.length || 0) > 0;
            const displayEstado =
              pedido && hasItems
                ? mesa.estado === 'cuenta_pedida'
                  ? 'cuenta_pedida'
                  : 'ocupada'
                : mesa.estado === 'reservada'
                ? 'reservada'
                : pedido && !hasItems
                ? 'libre'
                : mesa.estado;

            return (
              <button
                key={mesa.id}
                onClick={() => handleMesaClick(mesa.id, mesa.estado)}
                className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center shadow-md active:scale-95 transition-transform ${estadoStyle[displayEstado]}`}
              >
                <span className="text-3xl font-black">{mesa.numero}</span>
                <span className="text-[10px] font-semibold uppercase mt-0.5 opacity-90">
                  {displayEstado === 'cuenta_pedida' ? 'Cuenta' : displayEstado}
                </span>
                {pedido && hasItems && (
                  <span className="absolute bottom-2 text-[10px] font-bold bg-black/20 px-1.5 py-0.5 rounded">
                    {formatMoney(pedido.total)}
                  </span>
                )}
                {pedido?.items.some((i) => i.estadoItem === 'listo') && (
                  <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-white animate-ping" />
                )}
                {pedido?.items.some((i) => i.estadoItem === 'listo') && (
                  <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-white" />
                )}
              </button>
            );
          })}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {Object.entries({
          libre: 'Libre',
          ocupada: 'Ocupada',
          reservada: 'Reservada',
          cuenta_pedida: 'Cuenta',
        }).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-3 h-3 rounded-full ${estadoStyle[k as MesaEstado]}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
