import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { Icon } from '../ui/Icon';
import type { PaymentStatus, PaymentMethod } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReservationModal({ open, onClose }: Props) {
  const allEspacios = useEspaciosStore((s) => s.espacios);
  const courts = useMemo(() => allEspacios.filter((e) => e.isActive), [allEspacios]);
  const updateEspacioStatus = useEspaciosStore((s) => s.updateStatus);
  const clients = useStore((s) => s.clients);
  const addReservation = useStore((s) => s.addReservation);
  const addClient = useStore((s) => s.addClient);

  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pendiente');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amount, setAmount] = useState(15000);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtId || !clientName || !clientPhone) return;

    let clientId = clients.find(
      (c) => c.phone === clientPhone || c.name.toLowerCase() === clientName.toLowerCase()
    )?.id;

    if (!clientId) {
      addClient({ name: clientName, phone: clientPhone, isFrequent: false, isSanctioned: false });
      clientId = `cl${Date.now()}`;
    }

    addReservation({
      courtId,
      clientId,
      clientName,
      clientPhone,
      date,
      startTime,
      endTime,
      paymentStatus,
      paymentMethod: paymentStatus !== 'pendiente' ? paymentMethod : undefined,
      amount,
      paidAmount: paymentStatus === 'pagado' ? amount : paidAmount,
      notes: notes || undefined,
    });
    updateEspacioStatus(courtId, 'reservada');

    onClose();
    // reset
    setCourtId('');
    setClientName('');
    setClientPhone('');
    setPaymentStatus('pendiente');
    setPaidAmount(0);
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Icon name="add_circle" className="text-emerald-500" />
            Nueva Reserva
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Court */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Cancha / Espacio</label>
            <select
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Seleccionar...</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Inicio</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Client */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nombre cliente</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                placeholder="Ej: Juan Pérez"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Teléfono</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                required
                placeholder="11-XXXX-XXXX"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Estado de pago</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="pendiente">Pendiente</option>
                <option value="senado">Señado</option>
                <option value="pagado">Pagado Total</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Método</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                disabled={paymentStatus === 'pendiente'}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Monto total ($)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {paymentStatus === 'senado' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Monto señado ($)</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              Crear Reserva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
