import { useMemo, useRef, useState } from 'react';
import { useConfig } from '../../core/services/ConfigContext';
import { useStore } from '../../store/useStore';
import { useMesasStore } from '../../store/useMesasStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Icon } from '../../components/ui/Icon';
import { ensureProductMedia } from '../../lib/productImages';
import { api, getApiTenant } from '../../lib/api';

const C = {
  surface: '#131318',
  surfaceCard: '#121722',
  surfaceContainer: '#1f1f25',
  surfaceContainerHigh: '#2a292f',
  surfaceContainerLowest: '#0e0e13',
  surfaceBase: '#0A0A0F',
  surfaceElevated: '#1A202E',
  accent: '#FBBF24',
  primaryContainer: '#f59e0b',
  secondaryContainer: '#ec6a06',
  sportsPitch: '#10B981',
  tertiary: '#ffc32d',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  onSurface: '#e4e1e9',
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function ClientMenu() {
  const { config } = useConfig();
  const tenantName = config?.negocio.nombre || 'Sede Principal';
  const rawProducts = useStore((s) => s.products);
  const products = useMemo(() => rawProducts.filter((p) => p.disponible !== false).map(ensureProductMedia), [rawProducts]);
  const createPedido = useMesasStore((s) => s.createPedido);
  const mesas = useMesasStore((s) => s.mesas);
  const addItemToPedido = useMesasStore((s) => s.addItemToPedido);
  const updatePedidoEstado = useMesasStore((s) => s.updatePedidoEstado);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number; notes?: string }[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const pendingPedidoIdRef = useRef<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [orderType, setOrderType] = useState<'llevar' | 'local' | 'delivery'>('llevar');
  const [address, setAddress] = useState('');
  const [mesaId, setMesaId] = useState('');
  const [obsNotes, setObsNotes] = useState<Record<string, string>>({});
  const [showObsModal, setShowObsModal] = useState(false);
  const [obsTarget, setObsTarget] = useState<(typeof products)[0] | null>(null);
  const [obsText, setObsText] = useState('');

  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const filtered = products.filter((p) => {
    const catOk = category === 'all' || p.category === category;
    const q = search.toLowerCase().trim();
    return catOk && (!q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (p: (typeof products)[0], notes?: string) => {
    setCart((prev) => {
      const key = notes || '';
      const existing = prev.find((i) => i.id === p.id && (i.notes || '') === key);
      if (existing) return prev.map((i) => i.id === p.id && (i.notes || '') === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, notes: notes || undefined }];
    });
  };

  const handleOrder = async () => {
    if (submittingRef.current || cart.length === 0) return;
    if (orderType !== 'local' && !name.trim()) return;
    if (orderType === 'local' && !mesaId) return;
    if (orderType === 'delivery' && !address.trim()) return;

    // Bloquea dobles clics y reutiliza el mismo ID si hay que reintentar la conexión.
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      let pedidoId = pendingPedidoIdRef.current;
      if (!pedidoId) {
        const tipoPedido = orderType === 'delivery' ? 'delivery' : orderType === 'local' ? 'salon' : 'mostrador';
        if (orderType === 'local' && mesaId) {
          const existing = useMesasStore.getState().getPedidoByMesa(mesaId);
          if (existing && !['entregado', 'cancelado'].includes(existing.estado)) {
            pedidoId = existing.id;
          } else {
            pedidoId = createPedido({
              tipoPedido: 'salon',
              mesaId,
              clienteNombre: `Mesa ${mesas.find((m) => m.id === mesaId)?.numero}`,
            });
          }
        } else {
          pedidoId = createPedido({
            tipoPedido,
            mesaId: undefined,
            clienteNombre: name,
            clienteTelefono: phone,
            direccionDelivery: orderType === 'delivery' ? address : undefined,
          });
        }
        pendingPedidoIdRef.current = pedidoId;
        cart.forEach((item) => {
          const product = products.find((p) => p.id === item.id);
          if (product) addItemToPedido(pedidoId!, product, item.qty, item.notes);
        });
        updatePedidoEstado(pedidoId, orderType === 'delivery' ? 'listo' : 'confirmado');
      }

      const pedido = useMesasStore.getState().pedidos.find((p) => p.id === pedidoId);
      if (!pedido) throw new Error('No se encontró el pedido preparado para enviar.');
      // Esperar confirmación del servidor antes de mostrar éxito al cliente.
      // El endpoint es idempotente: reintentar con el mismo pedido no duplica stock ni comanda.
      await api.createPublicPedido(getApiTenant(), pedido);

      addNotification({
        title: `Nuevo pedido · ${orderType === 'llevar' ? 'Para llevar' : orderType === 'local' ? 'Comer aquí' : 'Delivery'}`,
        message: `${orderType === 'local' ? 'Mesa' : name}: ${pedido.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}`,
        type: 'info',
      });
      pendingPedidoIdRef.current = null;
      setDone(true);
      setCart([]);
      setShowCheckout(false);
    } catch (error) {
      console.error('No se pudo confirmar el pedido:', error);
      setSubmitError('No pudimos registrar el pedido en el servidor. Revisá la conexión y tocá “Reintentar”; no se va a crear un pedido duplicado.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="p-6 text-center space-y-5 min-h-[50vh] flex flex-col items-center justify-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
          <Icon name="check_circle" size={56} style={{ color: C.accent }} />
        </div>
        <h2 className="text-2xl font-black" style={{ color: C.textPrimary }}>¡Pedido recibido!</h2>
        <p className="text-sm" style={{ color: C.textSecondary }}>
          {orderType === 'delivery' ? 'Tu pedido sale en camino pronto.' : orderType === 'local' ? 'Ya está cargado en tu mesa.' : 'Pasá por el mostrador cuando te avisemos.'}
        </p>
        <button onClick={() => setDone(false)} className="w-full max-w-xs h-14 rounded-xl font-black uppercase tracking-wider text-lg" style={{ background: C.accent, color: C.surfaceBase }}>
          Seguir mirando el menú
        </button>
      </div>
    );
  }

  return (
    <div className="pb-32" style={{ color: C.onSurface }}>
      {/* Header */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h1 className="font-black tracking-tight uppercase text-[28px]" style={{ color: C.textPrimary }}>
              El Bar
            </h1>
            <span
              className="font-extrabold uppercase px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.18)', color: C.accent, fontSize: '10px' }}
            >
              Menú Digital
            </span>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm active:scale-95 transition-transform"
            style={{ background: C.surfaceContainer, color: C.onSurface }}
          >
            <Icon name="location_on" size={16} style={{ color: C.accent }} />
            <span className="font-semibold text-sm truncate max-w-[150px]" style={{ color: C.textPrimary }} title={tenantName}>
              {tenantName}
            </span>
            <Icon name="expand_more" size={16} style={{ color: C.textMuted }} />
          </button>
        </div>
        <div className="flex items-center justify-between" style={{ color: C.textSecondary }}>
          <p className="text-sm">Pedí directo a tu mesa, cancha o mostrador</p>
          <div className="flex items-center gap-1 font-semibold text-xs" style={{ color: C.sportsPitch }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.sportsPitch }} />
            <span>Cocina Abierta</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full mt-2">
          <Icon name="search" size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar burger, café, cerveza o tragos..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl focus:outline-none transition-colors"
            style={{ background: C.surfaceContainer, color: C.textPrimary }}
          />
        </div>
      </div>

      {/* Promo banner */}
      <div className="px-4 my-3">
        <div
          className="relative overflow-hidden rounded-xl p-4 shadow-md flex items-center justify-between"
          style={{ background: C.surfaceElevated }}
        >
          <div className="flex flex-col gap-1 max-w-[65%] z-10">
            <span
              className="font-extrabold uppercase px-2 py-0.5 rounded-full w-max text-[10px]"
              style={{ background: C.secondaryContainer, color: '#4a1c00' }}
            >
              Tercer Tiempo
            </span>
            <h2 className="font-bold leading-tight text-[17px]" style={{ color: C.textPrimary }}>
              Papas Especiales + 2 Pintas
            </h2>
            <p className="text-xs" style={{ color: C.textSecondary }}>
              Promo post-partido con 20% off mostrando tu reserva.
            </p>
            <span className="font-bold text-[17px] mt-1" style={{ color: C.accent }}>$14.500</span>
          </div>
          <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 shadow-md" style={{ background: C.surfaceContainerHigh }}>
            <div className="w-full h-full flex items-center justify-center" style={{ color: C.accent }}>
              <Icon name="local_pizza" size={40} />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky categories */}
      <div
        className="sticky z-20 px-4 py-2.5 overflow-x-auto flex items-center gap-2"
        style={{ top: '64px', background: 'rgba(19,19,24,0.97)', scrollbarWidth: 'none' }}
      >
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="flex-shrink-0 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all active:scale-95"
            style={
              category === c
                ? { background: C.accent, color: C.surfaceBase }
                : { background: C.surfaceContainer, color: C.textSecondary }
            }
          >
            {c === 'all' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="px-4 flex flex-col gap-3 pt-3">
        {filtered.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: C.textMuted }}>No encontramos productos</p>
        ) : (
          filtered.map((p) => (
            <article
              key={p.id}
              className="rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm"
              style={{ background: C.surfaceContainer }}
            >
              {/* Icon / image */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: C.surfaceCard, color: C.accent }}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-xl" loading="lazy" />
                ) : (
                  <Icon name={p.icon || 'restaurant'} size={28} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base truncate" style={{ color: C.textPrimary }}>{p.name}</h3>
                  {(p as any).isPopular && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: 'rgba(224,168,0,0.25)', color: C.accent }}
                    >
                      POPULAR
                    </span>
                  )}
                </div>
                <p className="text-xs line-clamp-1 mt-0.5" style={{ color: C.textSecondary }}>
                  {p.description}
                </p>
                <span className="font-bold text-[17px] mt-1" style={{ color: C.accent }}>
                  {formatMoney(p.price)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  onClick={() => { setObsTarget(p); setObsText(obsNotes[p.id] || ''); setShowObsModal(true); }}
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'rgba(26,32,46,0.6)', color: obsNotes[p.id] ? C.accent : C.textMuted }}
                >
                  {obsNotes[p.id] ? 'Obs. ✓' : 'Obs.'}
                </button>
                <button
                  onClick={() => addToCart(p, obsNotes[p.id])}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm active:scale-95 transition-transform"
                  style={{ background: C.accent, color: C.surfaceBase }}
                >
                  <Icon name="add" size={16} />
                  <span>Agregar</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Floating cart */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 inset-x-4 z-40 max-w-lg mx-auto">
          <div
            className="rounded-2xl p-3 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)] flex items-center justify-between backdrop-blur-md"
            style={{ background: 'rgba(26,32,46,0.97)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.18)' }}
              >
                <Icon name="shopping_bag" size={22} style={{ color: C.accent }} />
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full font-extrabold flex items-center justify-center"
                  style={{ background: C.accent, color: C.surfaceBase, fontSize: '11px' }}
                >
                  {cartCount}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="uppercase" style={{ color: C.textSecondary, fontSize: '10px', fontWeight: 800 }}>Mi Pedido</span>
                <span className="font-bold text-[17px]" style={{ color: C.textPrimary }}>{formatMoney(total)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform"
              style={{ background: C.accent, color: C.surfaceBase }}
            >
              <span>Ver Carrito</span>
              <Icon name="arrow_forward" size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Obs modal */}
      {showObsModal && obsTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(10,10,15,0.8)' }}>
          <div className="w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-4 shadow-2xl" style={{ background: C.surfaceElevated }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="edit_note" size={20} style={{ color: C.accent }} />
                <h4 className="font-bold text-[17px]" style={{ color: C.textPrimary }}>{obsTarget.name}</h4>
              </div>
              <button onClick={() => setShowObsModal(false)} style={{ color: C.textMuted }}>
                <Icon name="close" size={24} />
              </button>
            </div>
            <p className="text-sm" style={{ color: C.textSecondary }}>
              ¿Alguna preferencia o intolerancia? Especificala para la cocina.
            </p>
            <textarea
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              placeholder="Ej: Sin sal, café con leche de almendras, queso aparte..."
              rows={3}
              className="w-full p-3 rounded-xl focus:outline-none"
              style={{ background: C.surfaceContainer, color: C.textPrimary }}
              autoFocus
            />
            <button
              onClick={() => {
                setObsNotes((prev) => ({ ...prev, [obsTarget.id]: obsText }));
                setShowObsModal(false);
              }}
              className="w-full py-3 rounded-xl font-bold text-base"
              style={{ background: C.accent, color: C.surfaceBase }}
            >
              Guardar nota
            </button>
          </div>
        </div>
      )}

      {/* Checkout sheet */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-2 pb-8 sm:pb-10">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowCheckout(false)} />
          <div
            className="relative rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-4 sm:p-5 space-y-3 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain"
            style={{ background: C.surfaceCard, borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl" style={{ color: C.textPrimary }}>Tu pedido</h3>
              <button onClick={() => setShowCheckout(false)} style={{ color: C.textMuted }}>
                <Icon name="close" size={24} />
              </button>
            </div>

            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="flex justify-between text-sm gap-2">
                <div className="flex-1">
                  <span className="font-medium" style={{ color: C.textPrimary }}>{item.qty}x {item.name}</span>
                  {item.notes && <span className="block text-[10px] italic" style={{ color: C.accent }}>→ {item.notes}</span>}
                </div>
                <span className="font-bold" style={{ color: C.accent }}>{formatMoney(item.price * item.qty)}</span>
              </div>
            ))}

            <div className="flex justify-between font-black pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: C.textPrimary }}>Total</span>
              <span style={{ color: C.accent }}>{formatMoney(total)}</span>
            </div>

            {/* Order type */}
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: C.textPrimary }}>¿Cómo lo querés?</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'llevar', label: 'Para llevar', icon: 'shopping_bag' },
                  { id: 'local', label: 'Comer aquí', icon: 'restaurant' },
                  { id: 'delivery', label: 'Delivery', icon: 'delivery_dining' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setOrderType(opt.id)}
                    className="py-3 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all"
                    style={orderType === opt.id ? { background: C.accent, color: C.surfaceBase } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: C.onSurface }}
                  >
                    <Icon name={opt.icon} size={20} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {orderType !== 'local' && (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="w-full px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.textPrimary }} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className="w-full px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.textPrimary }} />
              </>
            )}

            {orderType === 'delivery' && (
              <div className="space-y-2">
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección de entrega" className="w-full px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: C.textPrimary }} />
                <button
                  onClick={() => navigator.geolocation?.getCurrentPosition((pos) => { const maps = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`; setAddress((p) => p ? `${p} | ${maps}` : maps); })}
                  className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  style={{ border: '1px solid rgba(251,191,36,0.4)', color: C.accent }}
                >
                  <Icon name="my_location" size={18} /> Usar mi ubicación
                </button>
              </div>
            )}

            {orderType === 'local' && (
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: C.textPrimary }}>¿En qué mesa estás?</p>
                <div className="grid grid-cols-5 gap-2">
                  {mesas.filter((m) => m.estado !== 'cuenta_pedida').map((m) => {
                    const ocupada = m.estado === 'ocupada' || m.estado === 'reservada';
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMesaId(m.id)}
                        className="py-2 rounded-xl text-sm font-bold relative transition-all"
                        style={mesaId === m.id ? { background: C.accent, color: C.surfaceBase } : ocupada ? { background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24' } : { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)', color: '#6ee7b7' }}
                      >
                        {m.numero}<span className="block text-[8px] font-medium opacity-80">{ocupada ? 'Ocupada' : 'Libre'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {submitError && <p className="text-sm text-red-400 mb-2">{submitError}</p>}
            <button
              onClick={handleOrder}
              disabled={isSubmitting || (orderType !== 'local' && !name.trim()) || (orderType === 'local' && !mesaId) || (orderType === 'delivery' && !address.trim())}
              className="sticky bottom-0 w-full min-h-14 py-3 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg"
              style={{ background: C.accent, color: C.surfaceBase, boxShadow: `0 -8px 20px ${C.surfaceCard}` }}
            >
              {isSubmitting ? 'Confirmando pedido…' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
