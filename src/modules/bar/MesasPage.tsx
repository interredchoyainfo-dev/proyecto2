import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMesasStore } from '../../store/useMesasStore';
import { useStore } from '../../store/useStore';
import { Icon } from '../../components/ui/Icon';
import type { Mesa } from '../../types';

const estadoConfig: Record<string, { label: string; bg: string; border: string; text: string; icon: string }> = {
  libre: { label: 'Libre', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-600 dark:text-emerald-400', icon: 'check_circle' },
  ocupada: { label: 'Ocupada', bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-600 dark:text-amber-400', icon: 'restaurant' },
  reservada: { label: 'Reservada', bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-600 dark:text-blue-400', icon: 'event' },
  cuenta_pedida: { label: 'Cuenta pedida', bg: 'bg-violet-500/10', border: 'border-violet-500/40', text: 'text-violet-600 dark:text-violet-400', icon: 'receipt_long' },
};

const DEFAULT_ESTADO = estadoConfig.libre;

const sectores = ['todos', 'salon', 'patio', 'terraza', 'canchas'] as const;

function elapsedSince(iso?: string) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const ms = Math.max(0, Date.now() - t);
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins < 1) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatMoney(n: number) {
  const safe = typeof n === 'number' && !isNaN(n) ? n : 0;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(safe);
}

export default function MesasPage() {
  const { negocioId } = useParams();
  const currentNegocio = (negocioId || 'giovanni').toLowerCase();

  const getMesasByTenant = useMesasStore((s) => s.getMesasByTenant);
  const rawAllMesas = useMesasStore((s) => s.mesas);
  const mesas = useMemo(() => getMesasByTenant(currentNegocio), [rawAllMesas, currentNegocio, getMesasByTenant]);

  const createPedido = useMesasStore((s) => s.createPedido);
  const getPedidoByMesa = useMesasStore((s) => s.getPedidoByMesa);
  const cerrarMesa = useMesasStore((s) => s.cerrarMesa);
  const addItemToPedido = useMesasStore((s) => s.addItemToPedido);
  const removeItemFromPedido = useMesasStore((s) => s.removeItemFromPedido);
  const addMesa = useMesasStore((s) => s.addMesa);
  const updateMesa = useMesasStore((s) => s.updateMesa);
  const deleteMesa = useMesasStore((s) => s.deleteMesa);
  const enviarItemsACocina = useMesasStore((s) => s.enviarItemsACocina);
  const getProductsByTenant = useStore((s) => s.getProductsByTenant);
  const allProducts = useStore((s) => s.products);
  const products = useMemo(() => getProductsByTenant(currentNegocio), [allProducts, currentNegocio, getProductsByTenant]);
  const addCashMovement = useStore((s) => s.addCashMovement);
  const cashSession = useStore((s) => s.cashSession);

  const [sectorFilter, setSectorFilter] = useState('todos');
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'detalle' | 'agregar'>('detalle');
  const [category, setCategory] = useState('all');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [payMethod, setPayMethod] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');
  const [showForm, setShowForm] = useState(false);
  const [editMesa, setEditMesa] = useState<Mesa | null>(null);
  const [formNumero, setFormNumero] = useState(1);
  const [formSector, setFormSector] = useState<Mesa['sector']>('salon');
  const [formCapacidad, setFormCapacidad] = useState(4);

  const selectedMesa = useMemo(
    () => (selectedMesaId ? mesas.find((m) => m.id === selectedMesaId) || null : null),
    [selectedMesaId, mesas]
  );

  const filtered = useMemo(() => {
    const list = sectorFilter === 'todos' ? mesas : mesas.filter((m) => m.sector === sectorFilter);
    return list.slice().sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
  }, [mesas, sectorFilter]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filteredProducts = useMemo(
    () => (category === 'all' ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  const handleOpenMesa = (mesa: Mesa) => {
    let pedido = getPedidoByMesa(mesa.id, currentNegocio);
    if (!pedido) {
      createPedido({ tipoPedido: 'salon', mesaId: mesa.id });
    }
    setSelectedMesaId(mesa.id);
    setPanel('detalle');
  };

  const pedidoActivo = selectedMesa ? getPedidoByMesa(selectedMesa.id, currentNegocio) : null;

  const addProduct = (productId: string, notes?: string) => {
    if (!pedidoActivo) return;
    const product = products.find((p) => p.id === productId);
    if (product) {
      addItemToPedido(pedidoActivo.id, product, 1, notes);
      setNoteFor(null);
      setNoteText('');
      setPanel('detalle');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mesas / Salón</h1>
          <p className="text-slate-500 text-sm">Tocá una mesa para ver pedido, agregar productos y cobrar</p>
        </div>
        <button
          onClick={() => {
            setEditMesa(null);
            setFormNumero(mesas.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          <Icon name="add" size={18} /> Nueva mesa
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-5 space-y-3">
          <h3 className="font-semibold">{editMesa ? 'Editar mesa' : 'Nueva mesa'}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Número</label>
              <input
                type="number"
                value={formNumero}
                onChange={(e) => setFormNumero(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                placeholder="Nº"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sector</label>
              <select
                value={formSector}
                onChange={(e) => setFormSector(e.target.value as Mesa['sector'])}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
              >
                <option value="salon">Salón</option>
                <option value="patio">Patio</option>
                <option value="terraza">Terraza</option>
                <option value="canchas">Canchas</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Capacidad</label>
              <input
                type="number"
                value={formCapacidad}
                onChange={(e) => setFormCapacidad(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                placeholder="Cap."
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                if (editMesa) {
                  updateMesa(editMesa.id, {
                    numero: formNumero,
                    sector: formSector,
                    capacidad: formCapacidad,
                  });
                } else {
                  addMesa({
                    numero: formNumero,
                    sector: formSector,
                    capacidad: formCapacidad,
                  });
                }
                setShowForm(false);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
            >
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 text-sm hover:underline">
              Cancelar
            </button>
            {editMesa && (
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar mesa ${editMesa.numero}?`)) {
                    deleteMesa(editMesa.id);
                    setShowForm(false);
                  }
                }}
                className="px-4 py-2 text-rose-500 text-sm hover:underline ml-auto"
              >
                Eliminar mesa
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {sectores.map((s) => (
          <button
            key={s}
            onClick={() => setSectorFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
              sectorFilter === s
                ? 'bg-emerald-600 text-white font-medium'
                : 'bg-white dark:bg-slate-900 border hover:border-emerald-500/50'
            }`}
          >
            {s === 'todos' ? 'Todos' : s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border">
              No hay mesas cargadas en este sector. Tocá "+ Nueva mesa" para agregar una.
            </div>
          ) : (
            filtered.map((mesa) => {
              const cfg = estadoConfig[mesa.estado] || DEFAULT_ESTADO;
              const pedido = getPedidoByMesa(mesa.id, currentNegocio);
              const items = Array.isArray(pedido?.items) ? pedido.items : [];
              const hasItems = items.length > 0;
              const hasListo = items.some((i) => i.estadoItem === 'listo');
              const isSelected = selectedMesa?.id === mesa.id;

              return (
                <button
                  key={mesa.id}
                  onClick={() => handleOpenMesa(mesa)}
                  className={`relative p-4 rounded-2xl border-2 text-left transition-all ${cfg.bg} ${cfg.border} ${
                    isSelected ? 'ring-2 ring-emerald-500 scale-[1.02]' : 'hover:scale-[1.01]'
                  }`}
                >
                  {hasListo && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  <span className="text-2xl font-bold">{mesa.numero}</span>
                  <p className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{mesa.sector || 'salón'}</p>
                  {hasItems && (
                    <p className="text-xs font-bold mt-1 text-slate-800 dark:text-slate-100">
                      {formatMoney(pedido?.total || 0)}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 h-fit sticky top-20 max-h-[80vh] overflow-y-auto">
          {!selectedMesa ? (
            <div className="text-center py-12 text-slate-500">
              <Icon name="table_restaurant" size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Seleccioná una mesa para ver su estado</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Mesa {selectedMesa.numero}</h3>
                  <p className="text-xs text-slate-500 capitalize">
                    {selectedMesa.sector} · {selectedMesa.capacidad || 4} pers.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMesaId(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                <button
                  onClick={() => setPanel('detalle')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    panel === 'detalle' ? 'bg-white dark:bg-slate-900 shadow' : 'text-slate-500'
                  }`}
                >
                  Pedido
                </button>
                <button
                  onClick={() => setPanel('agregar')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    panel === 'agregar' ? 'bg-white dark:bg-slate-900 shadow' : 'text-slate-500'
                  }`}
                >
                  + Agregar
                </button>
              </div>

              {panel === 'detalle' && (
                <>
                  {!pedidoActivo || (pedidoActivo.items || []).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500 mb-2">Sin productos cargados</p>
                      <button
                        onClick={() => setPanel('agregar')}
                        className="text-xs text-emerald-600 font-bold hover:underline"
                      >
                        Tocá acá para agregar productos
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(pedidoActivo.items || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.cantidad}x {item.nombre}
                            </p>
                            {item.notas && <p className="text-[11px] text-amber-600 italic">→ {item.notas}</p>}
                            <p
                              className={`text-[10px] ${
                                item.estadoItem === 'listo'
                                  ? 'text-emerald-600'
                                  : item.estadoItem === 'en_marcha'
                                  ? 'text-amber-600'
                                  : item.estadoItem === 'pendiente'
                                  ? 'text-slate-500'
                                  : 'text-slate-400'
                              }`}
                            >
                              {item.estadoItem === 'pendiente'
                                ? 'Pendiente enviar'
                                : item.estadoItem === 'en_marcha'
                                ? 'En cocina'
                                : item.estadoItem === 'listo'
                                ? '✓ Listo'
                                : 'Retirado'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatMoney(item.subtotal)}</p>
                            {item.estadoItem === 'pendiente' && (
                              <button
                                onClick={() => removeItemFromPedido(pedidoActivo.id, item.id)}
                                className="text-red-500 text-[10px] hover:underline"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pedidoActivo && (
                    <>
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Total</span>
                        <span className="text-emerald-600">{formatMoney(pedidoActivo.total || 0)}</span>
                      </div>
                      {(pedidoActivo.items || []).some((i) => i.estadoItem !== 'pendiente') && (
                        <div className="text-xs text-slate-500 flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                          <Icon name="schedule" size={16} />
                          Pedido hace {elapsedSince(pedidoActivo.createdAt)} · act. {elapsedSince(pedidoActivo.updatedAt)}
                        </div>
                      )}
                      <div className="space-y-2">
                        {(pedidoActivo.items || []).some((i) => i.estadoItem === 'pendiente') && (
                          <button
                            onClick={() => enviarItemsACocina(pedidoActivo.id)}
                            className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-400 transition-colors"
                          >
                            Enviar a Cocina
                          </button>
                        )}
                        <div className="flex gap-1">
                          {(['efectivo', 'transferencia', 'mercadopago'] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => setPayMethod(m)}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] capitalize transition-colors ${
                                payMethod === m
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              }`}
                            >
                              {m === 'mercadopago' ? 'Otro' : m}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            if ((pedidoActivo.total || 0) > 0 && cashSession?.status === 'abierta') {
                              addCashMovement({
                                type: 'ingreso',
                                amount: pedidoActivo.total,
                                method: payMethod,
                                description: `Mesa ${selectedMesa.numero}`,
                                relatedPedidoId: pedidoActivo.id,
                              });
                            }
                            cerrarMesa(selectedMesa.id);
                            setSelectedMesaId(null);
                          }}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors"
                        >
                          Cobrar y cerrar
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {panel === 'agregar' && (
                <div className="space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap capitalize transition-colors ${
                          category === c
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c === 'all' ? 'Todos' : c}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {filteredProducts
                      .filter((p) => p.disponible !== false)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-left border border-transparent hover:border-emerald-500/30 transition-all"
                        >
                          <button onClick={() => addProduct(p.id)} className="w-full text-left">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">{formatMoney(p.price)}</p>
                          </button>
                          <button
                            onClick={() => {
                              setNoteFor(p.id);
                              setNoteText('');
                            }}
                            className="text-[10px] text-slate-500 mt-1 flex items-center gap-0.5 hover:text-amber-500"
                          >
                            <Icon name="edit_note" size={12} /> Obs.
                          </button>
                        </div>
                      ))}
                  </div>
                  {noteFor && (
                    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                      <p className="text-xs font-medium">Observación para cocina</p>
                      <input
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Ej: sin sal, punto medio..."
                        className="w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-slate-900"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => addProduct(noteFor, noteText.trim() || undefined)}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                        >
                          Agregar
                        </button>
                        <button
                          onClick={() => setNoteFor(null)}
                          className="px-3 py-2 text-xs text-slate-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
