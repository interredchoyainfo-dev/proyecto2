import { useEffect, useState, useCallback } from 'react';
import { useMesasStore } from '../../store/useMesasStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Icon } from '../../components/ui/Icon';
import type { Pedido, DetallePedido, ItemEstado } from '../../types';

function elapsed(fromIso: string) {
  const ms = Date.now() - new Date(fromIso).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins < 1) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function printComanda(pedido: Pedido, mesaNum: string | number, items: DetallePedido[]) {
  const w = window.open('', '_blank', 'width=320,height=600');
  if (!w) return;
  const lines = items
    .map(
      (i) =>
        `<div style="margin:6px 0;border-bottom:1px dashed #ccc;padding-bottom:4px">
          <strong>${i.cantidad}x ${i.nombre}</strong>
          ${i.notas ? `<div style="font-size:12px;color:#555">→ ${i.notas}</div>` : ''}
        </div>`
    )
    .join('');
  w.document.write(`<!DOCTYPE html><html><head><title>Comanda</title>
    <style>
      @page { size: 58mm auto; margin: 2mm; }
      body { font-family: monospace; font-size: 13px; width: 54mm; margin: 0; padding: 4px; color: #000; }
      h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
      .meta { font-size: 12px; margin-bottom: 8px; text-align: center; }
      .line { border-top: 1px dashed #000; margin: 8px 0; }
    </style></head><body>
    <h1>COCINA</h1>
    <div class="meta"><strong>MESA ${mesaNum}</strong><br/>
    ${new Date(pedido.createdAt).toLocaleString('es-AR')}<br/>
    Pedido #${pedido.id.slice(-6)}</div>
    <div class="line"></div>
    ${lines}
    <div class="line"></div>
    <div class="meta">${pedido.clienteNombre || ''}</div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  w.document.close();
}

type ColKey = 'nuevos' | 'preparando' | 'listos' | 'historial';

interface CardData {
  pedido: Pedido;
  items: DetallePedido[];
  mesaNum: string | number;
  col: ColKey;
}

export default function CocinaKDS() {
  const pedidos = useMesasStore((s) => s.pedidos);
  const mesas = useMesasStore((s) => s.mesas);
  const updateItemEstado = useMesasStore((s) => s.updateItemEstado);
  const updatePedidoEstado = useMesasStore((s) => s.updatePedidoEstado);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [, setTick] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const getMesaNum = (mesaId?: string) => {
    if (!mesaId) return '—';
    return mesas.find((m) => m.id === mesaId)?.numero ?? '?';
  };

  const cocinaItems = (p: Pedido) =>
    p.items.filter(
      (i) => i.destinoComanda === 'cocina' || i.destinoComanda === 'ambos' || !i.destinoComanda
    );

  const buildCards = useCallback((): Record<ColKey, CardData[]> => {
    const result: Record<ColKey, CardData[]> = {
      nuevos: [],
      preparando: [],
      listos: [],
      historial: [],
    };

    for (const p of pedidos) {
      const items = cocinaItems(p);
      if (items.length === 0) continue;
      const mesaNum = getMesaNum(p.mesaId);

      const pendientes = items.filter((i) => i.estadoItem === 'pendiente');
      const enMarcha = items.filter((i) => i.estadoItem === 'en_marcha');
      const listos = items.filter((i) => i.estadoItem === 'listo');
      const entregados = items.filter((i) => i.estadoItem === 'entregado');

      if (pendientes.length > 0 && !['entregado', 'cancelado'].includes(p.estado)) {
        result.nuevos.push({ pedido: p, items: pendientes, mesaNum, col: 'nuevos' });
      }
      if (enMarcha.length > 0 && !['entregado', 'cancelado'].includes(p.estado)) {
        result.preparando.push({ pedido: p, items: enMarcha, mesaNum, col: 'preparando' });
      }
      if (listos.length > 0 && !['entregado', 'cancelado'].includes(p.estado)) {
        result.listos.push({ pedido: p, items: listos, mesaNum, col: 'listos' });
      }
      // Historial: pedidos con todos cocina items entregados o estado entregado
      if (
        p.estado === 'entregado' ||
        (entregados.length > 0 && pendientes.length === 0 && enMarcha.length === 0 && listos.length === 0)
      ) {
        result.historial.push({
          pedido: p,
          items: items.filter((i) => i.estadoItem === 'entregado'),
          mesaNum,
          col: 'historial',
        });
      }
    }
    // Sort historial newest first, limit
    result.historial = result.historial.slice(-20).reverse();
    return result;
  }, [pedidos, mesas]);

  const cols = buildCards();

  const advanceAll = (card: CardData, next: ItemEstado) => {
    card.items.forEach((item) => {
      updateItemEstado(card.pedido.id, item.id, next);
    });
    if (next === 'listo') {
      addNotification({
        title: '¡Listo para retirar!',
        message: `Mesa ${card.mesaNum} · ${card.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}`,
        type: 'kitchen',
        meta: { pedidoId: card.pedido.id, mesaNumero: card.mesaNum },
      });
    }
    if (next === 'entregado') {
      // After state update, check - for simplicity mark pedido if all cocina items will be delivered
      const remaining = cocinaItems(card.pedido).filter(
        (i) => !card.items.some((c) => c.id === i.id) && i.estadoItem !== 'entregado'
      );
      if (remaining.length === 0) {
        updatePedidoEstado(card.pedido.id, 'entregado');
      }
    }
  };

  const colConfig: { key: ColKey; title: string; color: string; action?: string; next?: ItemEstado }[] = [
    { key: 'nuevos', title: 'NUEVOS', color: 'border-red-500 bg-red-500/5', action: 'Tomar', next: 'en_marcha' },
    { key: 'preparando', title: 'PREPARANDO', color: 'border-amber-500 bg-amber-500/5', action: 'Listo', next: 'listo' },
    { key: 'listos', title: 'LISTOS', color: 'border-emerald-500 bg-emerald-500/5', action: 'Retirado', next: 'entregado' },
    { key: 'historial', title: 'HISTORIAL', color: 'border-slate-500 bg-slate-500/5' },
  ];

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-[90] bg-black text-white p-3 overflow-auto'
    : 'space-y-4';

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h1 className={`font-bold flex items-center gap-2 ${fullscreen ? 'text-xl text-white' : 'text-2xl'}`}>
            <Icon name="skillet" />
            Cocina KDS
          </h1>
          {!fullscreen && (
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Nuevos → Preparando → Listos → Historial
            </p>
          )}
        </div>
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 ${
            fullscreen ? 'bg-white/10 text-white' : 'bg-slate-100 dark:bg-slate-800'
          }`}
        >
          <Icon name={fullscreen ? 'fullscreen_exit' : 'fullscreen'} size={18} />
          {fullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 ${fullscreen ? 'min-h-[calc(100vh-5rem)]' : ''}`}>
        {colConfig.map((col) => (
          <div
            key={col.key}
            className={`rounded-2xl border-2 ${col.color} flex flex-col ${fullscreen ? 'min-h-0' : ''}`}
          >
            <div className={`px-3 py-2 font-black text-sm tracking-wide flex items-center justify-between ${fullscreen ? 'text-white' : ''}`}>
              <span>{col.title}</span>
              <span className="text-xs opacity-70">{cols[col.key].length}</span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[70vh]">
              {cols[col.key].length === 0 ? (
                <p className={`text-xs text-center py-8 opacity-40 ${fullscreen ? 'text-white' : 'text-slate-500'}`}>
                  Vacío
                </p>
              ) : (
                cols[col.key].map((card) => (
                  <div
                    key={`${card.pedido.id}-${col.key}`}
                    className={`rounded-xl p-3 shadow-md ${
                      fullscreen ? 'bg-white/10 text-white border border-white/10' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-2xl font-black">M{card.mesaNum}</p>
                        <p className="text-[10px] opacity-60">
                          Llegó hace {elapsed(card.pedido.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => printComanda(card.pedido, card.mesaNum, card.items)}
                        className="p-1.5 rounded-lg hover:bg-black/10"
                        title="Imprimir 58mm"
                      >
                        <Icon name="print" size={18} />
                      </button>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {card.items.map((item) => (
                        <div key={item.id} className="text-sm">
                          <span className="font-bold">
                            {item.cantidad}x {item.nombre}
                          </span>
                          {item.notas && (
                            <p className="text-xs opacity-70 italic">→ {item.notas}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {card.pedido.clienteNombre && (
                      <p className="text-[10px] opacity-50 mb-2">{card.pedido.clienteNombre}</p>
                    )}
                    {col.action && col.next && (
                      <button
                        onClick={() => advanceAll(card, col.next!)}
                        className={`w-full py-2 rounded-lg text-xs font-bold ${
                          col.key === 'nuevos'
                            ? 'bg-red-500 text-white'
                            : col.key === 'preparando'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-500 text-white'
                        }`}
                      >
                        {col.action}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
