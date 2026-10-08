import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMesasStore } from '../../store/useMesasStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Icon } from '../ui/Icon';
import { ensureProductMedia } from '../../lib/productImages';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

export function POS() {
  const raw = useStore((s) => s.products);
  const products = useMemo(() => raw.filter((p) => p.disponible !== false).map(ensureProductMedia), [raw]);
  const addCashMovement = useStore((s) => s.addCashMovement);
  const cashSession = useStore((s) => s.cashSession);
  const createPedido = useMesasStore((s) => s.createPedido);
  const addItemToPedido = useMesasStore((s) => s.addItemToPedido);
  const updatePedidoEstado = useMesasStore((s) => s.updatePedidoEstado);
  const enviarItemsACocina = useMesasStore((s) => s.enviarItemsACocina);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number; notes?: string }[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [sendKitchen, setSendKitchen] = useState(true);
  const [payMethod, setPayMethod] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = products.filter((p) => {
    const catOk = category === 'all' || p.category === category;
    const q = search.toLowerCase();
    return (
      catOk &&
      (!q ||
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        p.id.includes(q))
    );
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const add = (id: string, notes?: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setCart((prev) => {
      const key = notes || '';
      const ex = prev.find((i) => i.id === id && (i.notes || '') === key);
      if (ex) return prev.map((i) => (i.id === id && (i.notes || '') === key ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id, name: p.name, price: p.price, qty: 1, notes: notes || undefined }];
    });
    setNoteFor(null);
    setNoteText('');
  };

  const checkout = () => {
    if (cart.length === 0) return;
    const pedidoId = createPedido({
      tipoPedido: 'mostrador',
      clienteNombre: clienteNombre || 'Cantina / Mostrador',
    });
    cart.forEach((item) => {
      const product = products.find((p) => p.id === item.id);
      if (product) addItemToPedido(pedidoId, product, item.qty, item.notes);
    });
    if (sendKitchen) {
      enviarItemsACocina(pedidoId);
      addNotification({
        title: 'Pedido cantina → Cocina',
        message: `${clienteNombre || 'Mostrador'}: ${cart.map((i) => `${i.qty}x ${i.name}`).join(', ')}`,
        type: 'kitchen',
      });
    }
    updatePedidoEstado(pedidoId, sendKitchen ? 'confirmado' : 'entregado');
    if (cashSession?.status === 'abierta' && total > 0) {
      addCashMovement({
        type: 'ingreso',
        amount: total,
        method: payMethod,
        description: `POS Cantina${clienteNombre ? ` · ${clienteNombre}` : ''}`,
        relatedPedidoId: pedidoId,
      });
    }
    setCart([]);
    setClienteNombre('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Punto de Venta / Cantina</h1>
        <p className="text-slate-500 text-sm">Productos del inventario · fotos · envío a cocina</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-3">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap capitalize ${
                  category === c ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border'
                }`}
              >
                {c === 'all' ? 'Todos' : c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[65vh] overflow-y-auto">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left"
              >
                <button onClick={() => add(p.id)} className="w-full text-left">
                  <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <Icon name={p.icon || 'restaurant'} size={28} />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-bold leading-tight line-clamp-2">{p.name}</p>
                    {p.description && (
                      <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>
                    )}
                    <p className="text-emerald-600 font-bold text-sm mt-1">{formatMoney(p.price)}</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setNoteFor(p.id);
                    setNoteText('');
                  }}
                  className="w-full text-[10px] text-slate-500 py-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-0.5"
                >
                  <Icon name="edit_note" size={12} /> Observación
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 h-fit sticky top-20 space-y-3">
          <h3 className="font-bold">Pedido cantina</h3>
          <input
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
            placeholder="Nombre / referencia (opcional)"
            className="w-full px-3 py-2 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
          />
          {cart.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Tocá productos para armar el pedido</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="flex justify-between text-sm gap-2">
                  <div>
                    <p className="font-medium">
                      {item.qty}x {item.name}
                    </p>
                    {item.notes && <p className="text-[10px] text-amber-600 italic">→ {item.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(item.price * item.qty)}</p>
                    <button
                      onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}
                      className="text-[10px] text-red-500"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-2">
            <span>Total</span>
            <span className="text-emerald-600">{formatMoney(total)}</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendKitchen} onChange={(e) => setSendKitchen(e.target.checked)} />
            Enviar a cocina / bar
          </label>
          <div className="flex gap-1">
            {(['efectivo', 'transferencia', 'mercadopago'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] capitalize ${
                  payMethod === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {m === 'mercadopago' ? 'Otro' : m}
              </button>
            ))}
          </div>
          <button
            onClick={checkout}
            disabled={!cart.length}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-40"
          >
            Cobrar{sendKitchen ? ' y enviar' : ''}
          </button>
        </div>
      </div>

      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNoteFor(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-sm space-y-3">
            <h3 className="font-bold">Observación</h3>
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej: sin sal, para llevar..."
              className="w-full px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
              autoFocus
            />
            <button
              onClick={() => add(noteFor, noteText.trim() || undefined)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;
