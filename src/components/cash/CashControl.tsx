import { useEffect, useMemo, useState } from 'react';
import { api, getApiTenant } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { Icon } from '../ui/Icon';
import type { CashMovementType, PaymentMethod } from '../../types';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export function CashControl() {
  const tenantId = getApiTenant();
  const globalCashSession = useStore((s) => s.cashSession);
  const allCashMovements = useStore((s) => s.cashMovements);
  const cashPersistenceError = useStore((s) => s.cashPersistenceError);
  const cashSession = globalCashSession && (globalCashSession.negocioId || 'giovanni').toLowerCase() === tenantId
    ? globalCashSession
    : null;
  const cashMovements = useMemo(
    () => allCashMovements.filter((m) =>
      (m.negocioId || 'giovanni').toLowerCase() === tenantId &&
      (!cashSession || m.sessionId === cashSession.id)
    ),
    [allCashMovements, tenantId, cashSession?.id]
  );
  const openCash = useStore((s) => s.openCash);
  const closeCash = useStore((s) => s.closeCash);
  const addCashMovement = useStore((s) => s.addCashMovement);

  const [openAmount, setOpenAmount] = useState(10000);
  const [closeAmount, setCloseAmount] = useState(0);
  const [movType, setMovType] = useState<CashMovementType>('ingreso');
  const [movAmount, setMovAmount] = useState(0);
  const [movMethod, setMovMethod] = useState<PaymentMethod>('efectivo');
  const [movDesc, setMovDesc] = useState('');
  const [loadingCash, setLoadingCash] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingCash(true);
    setLoadError('');
    (async () => {
      try {
        const [session, movements] = await Promise.all([
          api.getCajaSesion(tenantId),
          api.getCajaMovimientos(tenantId),
        ]);
        if (!active) return;
        const openSession = session?.status === 'abierta'
          ? { ...session, negocioId: tenantId }
          : null;
        useStore.setState({
          cashSession: openSession,
          cashMovements: Array.isArray(movements)
            ? movements.map((m: any) => ({ ...m, negocioId: tenantId }))
            : [],
          cashPersistenceError: null,
        });
      } catch (error) {
        if (!active) return;
        console.error('Error recuperando caja desde SQLite:', error);
        setLoadError('No se pudo cargar la caja desde el servidor. No registres pagos hasta recuperar la conexión.');
      } finally {
        if (active) setLoadingCash(false);
      }
    })();
    return () => { active = false; };
  }, [tenantId]);

  const ingresos = cashMovements.filter((m) => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0);
  const egresos = cashMovements.filter((m) => m.type === 'egreso').reduce((s, m) => s + m.amount, 0);
  const expected = cashSession ? cashSession.openingAmount + ingresos - egresos : 0;

  const byMethod = (method: PaymentMethod) =>
    cashMovements.filter((m) => m.method === method && m.type === 'ingreso').reduce((s, m) => s + m.amount, 0);

  const handleOpen = async () => {
    if (openAmount < 0 || savingAction || loadingCash || loadError) return;
    setSavingAction(true);
    try {
      await openCash(openAmount, tenantId);
    } finally {
      setSavingAction(false);
    }
  };

  const handleClose = async () => {
    if (savingAction) return;
    setSavingAction(true);
    try {
      await closeCash(closeAmount);
    } finally {
      setSavingAction(false);
    }
  };

  const handleAddMov = async () => {
    if (movAmount <= 0 || !movDesc.trim() || savingAction) return;
    setSavingAction(true);
    try {
      await addCashMovement({ type: movType, amount: movAmount, method: movMethod, description: movDesc });
      if (!useStore.getState().cashPersistenceError) {
        setMovAmount(0);
        setMovDesc('');
      }
    } finally {
      setSavingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {(loadError || cashPersistenceError) && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError || cashPersistenceError}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">Control de Caja</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Apertura, cierre y movimientos diarios</p>
      </div>

      {!cashSession || cashSession.status === 'cerrada' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 max-w-md mx-auto text-center">
          <Icon name="lock" size={48} className="mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-bold mb-2">Caja Cerrada</h3>
          <p className="text-sm text-slate-500 mb-6">Ingrese el monto de apertura para comenzar el turno</p>
          <div className="flex gap-3">
            <input
              type="number"
              value={openAmount}
              onChange={(e) => setOpenAmount(Number(e.target.value))}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Monto inicial"
            />
            <button
              onClick={handleOpen}
              disabled={savingAction || loadingCash || Boolean(loadError)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
            >
              {loadingCash ? 'Verificando…' : savingAction ? 'Guardando…' : 'Abrir Caja'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Apertura', value: formatMoney(cashSession.openingAmount), icon: 'login' },
              { label: 'Ingresos', value: formatMoney(ingresos), icon: 'trending_up', color: 'text-emerald-500' },
              { label: 'Egresos', value: formatMoney(egresos), icon: 'trending_down', color: 'text-red-500' },
              { label: 'Esperado', value: formatMoney(expected), icon: 'account_balance_wallet' },
            ].map((c) => (
              <div key={c.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase mb-1">
                  <Icon name={c.icon} size={16} className={c.color} />
                  {c.label}
                </div>
                <p className={`text-xl font-bold ${c.color ?? ''}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* By method */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-semibold mb-3">Desglose por método de pago (ingresos)</h3>
            <div className="grid grid-cols-3 gap-4">
              {(['efectivo', 'transferencia', 'mercadopago'] as PaymentMethod[]).map((m) => (
                <div key={m} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 capitalize mb-1">{m}</p>
                  <p className="font-bold">{formatMoney(byMethod(m))}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Add movement */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-semibold mb-4">Registrar movimiento manual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={movType}
                onChange={(e) => setMovType(e.target.value as CashMovementType)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
              <input
                type="number"
                value={movAmount || ''}
                onChange={(e) => setMovAmount(Number(e.target.value))}
                placeholder="Monto"
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <select
                value={movMethod}
                onChange={(e) => setMovMethod(e.target.value as PaymentMethod)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
              <input
                type="text"
                value={movDesc}
                onChange={(e) => setMovDesc(e.target.value)}
                placeholder="Descripción"
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                onClick={handleAddMov}
                disabled={savingAction}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
              >
                {savingAction ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>

          {/* Movements list */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-semibold">
              Movimientos del día
            </div>
            {cashMovements.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">Sin movimientos aún</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {cashMovements.map((m) => (
                  <div key={m.id} className="p-4 flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        m.type === 'ingreso' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      <Icon name={m.type === 'ingreso' ? 'arrow_downward' : 'arrow_upward'} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.description}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {m.method} · {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`font-bold ${m.type === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.type === 'ingreso' ? '+' : '-'}{formatMoney(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Close cash */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-semibold mb-3">Cerrar caja / Arqueo</h3>
            <p className="text-sm text-slate-500 mb-4">
              Monto esperado en caja: <strong>{formatMoney(expected)}</strong>
            </p>
            <div className="flex gap-3 max-w-md">
              <input
                type="number"
                value={closeAmount || ''}
                onChange={(e) => setCloseAmount(Number(e.target.value))}
                placeholder="Monto contado"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                onClick={handleClose}
                disabled={savingAction}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium"
              >
                {savingAction ? 'Guardando…' : 'Cerrar Caja'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
