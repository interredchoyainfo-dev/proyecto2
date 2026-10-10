import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMesasStore } from '../../store/useMesasStore';
import { Icon } from '../../components/ui/Icon';
import type { Pedido, DetallePedido } from '../../types';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function kitchenStatus(items: DetallePedido[]): {
  label: string;
  color: string;
  icon: string;
} {
  const cocina = items.filter(
    (i) => i.destinoComanda === 'cocina' || i.destinoComanda === 'ambos' || !i.destinoComanda
  );
  if (cocina.length === 0) {
    return { label: 'Solo bar', color: 'bg-slate-500/10 text-slate-600', icon: 'local_bar' };
  }
  const pendientes = cocina.filter((i) => i.estadoItem === 'pendiente').length;
  const preparando = cocina.filter((i) => i.estadoItem === 'en_marcha').length;
  const listos = cocina.filter((i) => i.estadoItem === 'listo').length;
  const entregados = cocina.filter((i) => i.estadoItem === 'entregado').length;

  if (listos > 0) {
    return {
      label: listos === cocina.length ? 'Listo para retirar' : `${listos} listo(s) · retirar`,
      color: 'bg-emerald-500/15 text-emerald-600',
      icon: 'notifications_active',
    };
  }
  if (preparando > 0) {
    return {
      label: 'En preparación',
      color: 'bg-amber-500/15 text-amber-600',
      icon: 'skillet',
    };
  }
  if (pendientes > 0) {
    return {
      label: 'Enviado a cocina',
      color: 'bg-red-500/15 text-red-600',
      icon: 'send',
    };
  }
  if (entregados === cocina.length) {
    return {
      label: 'Retirado',
      color: 'bg-slate-500/10 text-slate-500',
      icon: 'check_circle',
    };
  }
  return { label: 'Sin cocina', color: 'bg-slate-500/10 text-slate-500', icon: 'info' };
}

function tipoLabel(p: Pedido): { label: string; color: string } {
  if (p.tipoPedido === 'mostrador' || (p.clienteNombre && !p.mozoId)) {
    return { label: 'Auto pedido', color: 'bg-violet-500/15 text-violet-600' };
  }
  if (p.tipoPedido === 'delivery') {
    return { label: 'Delivery', color: 'bg-blue-500/15 text-blue-600' };
  }
  return { label: 'Mesa', color: 'bg-emerald-500/10 text-emerald-600' };
}

export default function MozoPedidosList() {
  // Suscripción directa al array (reactivo)
  const pedidos = useMesasStore((s) => s.pedidos);
  const allMesas = useMesasStore((s) => s.mesas);
  const updateItemEstado = useMesasStore((s) => s.updateItemEstado);
  const navigate = useNavigate();
  const { negocioId } = useParams();
  const currentNegocio = (negocioId || 'giovanni').toLowerCase();
  const mesas = useMemo(() => allMesas.filter((m) => (m.negocioId || 'giovanni').toLowerCase() === currentNegocio), [allMesas, currentNegocio]);
  const [, setTick] = useState(0);

  // Re-render cada 2s para tiempos y sensación en vivo
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const activos = useMemo(() => {
    return pedidos
      .filter((p) => (p.negocioId || 'giovanni').toLowerCase() === currentNegocio)
      // Un pedido cobrado/cerrado nunca debe reaparecer por conservar ítems listos.
      .filter((p) => !['entregado', 'cancelado'].includes(p.estado))
      .filter((p) => p.items.length > 0)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pedidos, currentNegocio]);

  // Priorizar los que tienen algo listo
  const sorted = useMemo(() => {
    return activos.slice().sort((a, b) => {
      const aListo = a.items.some((i) => i.estadoItem === 'listo') ? 1 : 0;
      const bListo = b.items.some((i) => i.estadoItem === 'listo') ? 1 : 0;
      return bListo - aListo;
    });
  }, [activos]);

  const getMesaNum = (mesaId?: string) => {
    if (!mesaId) return '—';
    return mesas.find((m) => m.id === mesaId)?.numero ?? '?';
  };

  const marcarRetirado = (e: React.MouseEvent, p: Pedido) => {
    e.stopPropagation();
    p.items
      .filter((i) => i.estadoItem === 'listo')
      .forEach((i) => updateItemEstado(p.id, i.id, 'entregado'));
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Pedidos activos</h1>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          En vivo
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Icon name="receipt_long" size={48} className="mx-auto mb-3 opacity-40" />
          <p>No hay pedidos activos</p>
          <p className="text-xs mt-1">Los de mesa, bar y menú aparecen acá solos</p>
        </div>
      ) : (
        sorted.map((p) => {
          const kitchen = kitchenStatus(p.items);
          const tipo = tipoLabel(p);
          const hasListo = p.items.some((i) => i.estadoItem === 'listo');
          const mesaNum = getMesaNum(p.mesaId);

          return (
            <button
              key={p.id}
              onClick={() => navigate(`/${negocioId}/app/mozos/pedido/${p.id}`)}
              className={`w-full p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                hasListo
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                    hasListo ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  {mesaNum}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">
                      {p.mesaId ? `Mesa ${mesaNum}` : p.clienteNombre || 'Pedido'}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tipo.color}`}>
                      {tipo.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.items.length} ítems · {formatMoney(p.total)}
                  </p>
                </div>
                <Icon name="chevron_right" className="text-slate-400 shrink-0" />
              </div>

              {/* Estado cocina */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${kitchen.color}`}
                >
                  <Icon name={kitchen.icon} size={14} />
                  {kitchen.label}
                </span>
                {hasListo && (
                  <span
                    role="button"
                    onClick={(e) => marcarRetirado(e, p)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white"
                  >
                    Marcar retirado
                  </span>
                )}
              </div>

              {/* Mini detalle ítems listos */}
              {hasListo && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 font-medium">
                  {p.items
                    .filter((i) => i.estadoItem === 'listo')
                    .map((i) => `${i.cantidad}x ${i.nombre}`)
                    .join(' · ')}
                </p>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
