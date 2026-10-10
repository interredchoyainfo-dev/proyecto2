import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMesasStore } from '../../store/useMesasStore';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function MozoPedido() {
  const { pedidoId, negocioId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const pedidos = useMesasStore((s) => s.pedidos);
  const mesas = useMesasStore((s) => s.mesas);
  const addItemToPedido = useMesasStore((s) => s.addItemToPedido);
  const removeItemFromPedido = useMesasStore((s) => s.removeItemFromPedido);
  const updatePedidoEstado = useMesasStore((s) => s.updatePedidoEstado);
  const updateMesaEstado = useMesasStore((s) => s.updateMesaEstado);
  const enviarItemsACocina = useMesasStore((s) => s.enviarItemsACocina);
  const cerrarMesa = useMesasStore((s) => s.cerrarMesa);
  const products = useStore((s) => s.products);
  const addCashMovement = useStore((s) => s.addCashMovement);
  const cashSession = useStore((s) => s.cashSession);

  const [tab, setTab] = useState<'pedido' | 'carta'>('pedido');
  const [category, setCategory] = useState('all');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [msg, setMsg] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, []);
  const [payMethod, setPayMethod] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');

  const pedido = pedidos.find((p) => p.id === pedidoId);
  const mesa = pedido?.mesaId ? mesas.find((m) => m.id === pedido.mesaId) : null;

  if (!pedido) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Pedido no encontrado</p>
        <button onClick={() => navigate(`/${negocioId}/app/mozos`)} className="mt-4 text-emerald-600 font-medium">
          Volver
        </button>
      </div>
    );
  }

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = category === 'all' ? products : products.filter((p) => p.category === category);
  const pendientes = pedido.items.filter((i) => i.estadoItem === 'pendiente' && !i.enviadoCocina).length;

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const handleEnviarCocina = () => {
    const n = enviarItemsACocina(pedido.id);
    if (n > 0) flash(`${n} ítem(s) enviados a cocina`);
    else flash('No hay ítems nuevos para enviar');
    setTab('pedido');
  };

  const handlePedirCuenta = () => {
    if (mesa) updateMesaEstado(mesa.id, 'cuenta_pedida');
    updatePedidoEstado(pedido.id, 'listo');
    flash('Cuenta pedida');
  };

  const handleCobrarYCerrar = () => {
    if (pedido.items.length === 0) {
      // Solo cerrar sin cobrar
      if (mesa) {
        updateMesaEstado(mesa.id, 'libre');
        updatePedidoEstado(pedido.id, 'cancelado');
      }
      navigate(`/${negocioId}/app/mozos`);
      return;
    }
    setShowPay(true);
  };

  const confirmCobro = () => {
    // El acceso público puede cerrar la mesa, pero solo una sesión autenticada registra caja.
    if (user && cashSession?.status === 'abierta' && pedido.total > 0) {
      addCashMovement({
        type: 'ingreso',
        amount: pedido.total,
        method: payMethod,
        description: `Cobro Mesa ${mesa?.numero ?? '?'} - ${payMethod} - Pedido ${pedido.id.slice(-6)}`,
        relatedPedidoId: pedido.id,
      });
    }
    if (mesa) cerrarMesa(mesa.id, negocioId || 'giovanni');
    else updatePedidoEstado(pedido.id, 'entregado');
    setShowPay(false);
    navigate(`/${negocioId}/app/mozos`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(`/${negocioId}/app/mozos`)} className="p-1">
          <Icon name="arrow_back" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold">
            {mesa ? `Mesa ${mesa.numero}` : 'Pedido'} · {pedido.estado}
          </h2>
          <p className="text-xs text-slate-500">
            {pedido.items.length} ítems
            {pendientes > 0 && (
              <span className="text-amber-600 font-medium"> · {pendientes} sin enviar</span>
            )}
          </p>
        </div>
        <span className="text-lg font-bold text-emerald-600">{formatMoney(pedido.total)}</span>
      </div>

      {msg && (
        <div className="bg-emerald-600 text-white text-center text-sm py-2 font-medium">{msg}</div>
      )}

      <div className="flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab('pedido')}
          className={`flex-1 py-2.5 text-sm font-medium ${
            tab === 'pedido' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'
          }`}
        >
          Pedido
        </button>
        <button
          onClick={() => setTab('carta')}
          className={`flex-1 py-2.5 text-sm font-medium ${
            tab === 'carta' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'
          }`}
        >
          + Agregar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'pedido' ? (
          <div className="p-4 space-y-2">
            {pedido.items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 mb-3">Todavía no hay productos</p>
                <button
                  onClick={() => setTab('carta')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium"
                >
                  Agregar productos
                </button>
              </div>
            ) : (
              pedido.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {item.cantidad}x {item.nombre}
                    </p>
                    <p className={`text-xs font-medium ${
                      item.estadoItem === 'listo' ? 'text-emerald-600' :
                      item.estadoItem === 'en_marcha' ? 'text-amber-600' :
                      item.estadoItem === 'pendiente' ? 'text-red-500' :
                      'text-slate-500'
                    }`}>
                      {item.estadoItem === 'pendiente' && (item.enviadoCocina ? 'En cocina' : 'Pendiente enviar')}
                      {item.estadoItem === 'en_marcha' && 'En preparación'}
                      {item.estadoItem === 'listo' && '✓ Listo para retirar'}
                      {item.estadoItem === 'entregado' && 'Retirado'}
                      {item.notas && <span className="block text-slate-500 font-normal italic">→ {item.notas}</span>}
                    </p>
                  </div>
                  <span className="font-semibold text-sm">{formatMoney(item.subtotal)}</span>
                  {item.estadoItem === 'pendiente' && (
                    <button
                      onClick={() => removeItemFromPedido(pedido.id, item.id)}
                      className="p-1.5 text-red-500"
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="p-3">
            <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap capitalize ${
                    category === c
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {c === 'all' ? 'Todos' : c}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left"
                >
                  <button
                    onClick={() => {
                      addItemToPedido(pedido.id, p, 1);
                      flash(`+ ${p.name}`);
                    }}
                    className="w-full text-left active:scale-95"
                  >
                    <p className="font-medium text-sm leading-tight">{p.name}</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-1">
                      {formatMoney(p.price)}
                    </p>
                  </button>
                  <button
                    onClick={() => { setNoteFor(p.id); setNoteText(''); }}
                    className="mt-1 text-[10px] text-slate-500 flex items-center gap-0.5"
                  >
                    <Icon name="edit_note" size={12} /> Observación
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {pendientes > 0 && (
          <button
            onClick={handleEnviarCocina}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold flex items-center justify-center gap-2"
          >
            <Icon name="send" />
            Enviar a Cocina ({pendientes})
          </button>
        )}
        
        {pedido.items.length > 0 && mesa?.estado !== 'cuenta_pedida' && (
          <button
            onClick={handlePedirCuenta}
            className="w-full py-2.5 rounded-xl border border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 font-bold flex items-center justify-center gap-2"
          >
            <Icon name="receipt_long" />
            Pedir Cuenta
          </button>
        )}

        <button
          onClick={handleCobrarYCerrar}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2"
        >
          <Icon name="payments" />
          {pedido.items.length === 0
            ? 'Cerrar sin pedido'
            : `Cobrar y Cerrar · ${formatMoney(pedido.total)}`}
        </button>
      </div>

      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNoteFor(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl w-full max-w-lg p-5 space-y-3">
            <h3 className="font-bold">Observación para cocina</h3>
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej: sin sal, bien cocido..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              autoFocus
            />
            <button
              onClick={() => {
                const p = products.find((x) => x.id === noteFor);
                if (p) {
                  addItemToPedido(pedido.id, p, 1, noteText.trim() || undefined);
                  flash(`+ ${p.name}`);
                }
                setNoteFor(null);
                setNoteText('');
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold"
            >
              Agregar al pedido
            </button>
          </div>
        </div>
      )}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPay(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl w-full max-w-lg p-5 space-y-4">
            <h3 className="font-bold text-lg">¿Cómo paga?</h3>
            <p className="text-sm text-slate-500">Total: {formatMoney(pedido.total)}</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'efectivo', label: 'Efectivo', icon: 'payments' },
                { id: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
                { id: 'mercadopago', label: 'Otro / MP', icon: 'qr_code' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPayMethod(m.id)}
                  className={`py-4 rounded-xl text-xs font-medium flex flex-col items-center gap-1 ${
                    payMethod === m.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Icon name={m.icon} size={22} />
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={confirmCobro}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold"
            >
              Confirmar cobro
            </button>
            <button onClick={() => setShowPay(false)} className="w-full py-2 text-slate-500 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
