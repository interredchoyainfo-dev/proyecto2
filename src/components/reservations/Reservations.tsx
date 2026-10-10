import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Icon } from '../ui/Icon';
import { ReservationModal } from './ReservationModal';
import { FixedTurnos } from './FixedTurnos';
import { format, parseISO, isSameDay, startOfWeek, addDays, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';

type CalendarMode = 'day' | 'week' | 'month';

const paymentBadge: Record<string, string> = {
  pendiente: 'bg-red-500/10 text-red-600 dark:text-red-400',
  senado: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  pagado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export function Reservations() {
  const allReservations = useStore((s) => s.reservations);
  const reservationPersistenceError = useStore((s) => s.reservationPersistenceError);
  const clients = useStore((s) => s.clients);
  const { negocioId } = useParams<{ negocioId: string }>();
  const tenantId = (negocioId || 'giovanni').toLowerCase();
  const reservations = useMemo(
    () => allReservations.filter((r) => (r.negocioId || 'giovanni').toLowerCase() === tenantId),
    [allReservations, tenantId]
  );
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [reservationsLoadError, setReservationsLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setReservationsLoading(true);
    setReservationsLoadError('');
    api.getReservas(tenantId)
      .then((rows) => {
        if (!active) return;
        const normalized = Array.isArray(rows) ? rows.map((r) => ({
          ...r,
          espacioId: r.espacioId || (r as any).courtId || '',
          negocioId: tenantId,
        })) : [];
        useStore.setState((state) => ({
          reservationPersistenceError: null,
          reservations: [
            ...state.reservations.filter((r) => (r.negocioId || 'giovanni').toLowerCase() !== tenantId),
            ...normalized,
          ],
        }));
      })
      .catch((error) => {
        if (!active) return;
        console.error('No se pudieron cargar las reservas desde SQLite:', error);
        setReservationsLoadError('No se pudieron cargar las reservas del servidor. Revisá la conexión antes de crear o modificar reservas.');
      })
      .finally(() => {
        if (active) setReservationsLoading(false);
      });
    return () => { active = false; };
  }, [tenantId]);
  const tenants = useSuperAdminStore((s) => s.tenants);
  const business = tenants.find((t) => t.slug.toLowerCase() === (negocioId || 'giovanni').toLowerCase() || t.id.toLowerCase() === (negocioId || 'giovanni').toLowerCase());
  const [completionNotice, setCompletionNotice] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [completionWhatsAppUrl, setCompletionWhatsAppUrl] = useState('');
  const allEspacios = useEspaciosStore((s) => s.espacios);
  const [modalOpen, setModalOpen] = useState(false);
  const [showFixedTurnos, setShowFixedTurnos] = useState(false);
  const [selectedRes, setSelectedRes] = useState<typeof reservations[0] | null>(null);
  const [mode, setMode] = useState<CalendarMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tab, setTab] = useState<'activas' | 'historial'>('activas');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const isPast = (r: (typeof reservations)[0]) => {
    if (r.date < todayStr) return true;
    if (r.date > todayStr) return false;
    return r.endTime <= nowHHMM;
  };

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const d = parseISO(r.date);
      if (mode === 'day') return isSameDay(d, selectedDate);
      if (mode === 'week') {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = addDays(start, 6);
        return d >= start && d <= end;
      }
      return isSameMonth(d, selectedDate);
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [reservations, selectedDate, mode]);

  const activas = filtered.filter((r) => !isPast(r));
  const historial = filtered.filter((r) => isPast(r));

  const courtName = (id: string) => allEspacios.find((c) => c.id === id)?.name ?? id;

  const finalizeReservation = async () => {
    if (!selectedRes || selectedRes.estado === 'completada' || selectedRes.estado === 'cancelada') return;
    setCompletionNotice('');
    setCompletionError('');
    setCompletionWhatsAppUrl('');

    const rawPhone = String((business as any)?.whatsapp || '').replace(/\D/g, '');
    const localPhone = rawPhone.replace(/^0/, '');
    const whatsappNumber = localPhone.startsWith('54')
      ? localPhone
      : localPhone.length === 10
        ? `549${localPhone}`
        : localPhone;
    const whatsappWindow = whatsappNumber ? window.open('about:blank', '_blank') : null;

    try {
      const updated = await api.updateReserva(negocioId || selectedRes.negocioId || 'giovanni', selectedRes.id, { estado: 'completada' });
      useStore.setState((state) => ({
        reservations: state.reservations.map((r) => r.id === selectedRes.id ? { ...r, ...updated } : r),
      }));
      setSelectedRes((current) => current ? { ...current, ...updated } : current);

      if (!whatsappNumber) {
        if (whatsappWindow) whatsappWindow.close();
        setCompletionNotice('Reserva finalizada.');
        setCompletionError('No hay un WhatsApp configurado para este negocio. Cargalo en Configuración para poder abrir el mensaje.');
        return;
      }

      const client = clients.find((c) => c.id === selectedRes.clientId && (c.negocioId || 'giovanni').toLowerCase() === (negocioId || 'giovanni').toLowerCase());
      const total = Number(selectedRes.amount || 0);
      const pagado = Number(selectedRes.paidAmount || 0);
      const saldo = Math.max(0, total - pagado);
      const space = courtName(selectedRes.espacioId || (selectedRes as any).courtId);
      const message = [
        `Hola, te compartimos el detalle de la reserva finalizada de ${business?.nombre || 'nuestro complejo'}.`,
        '',
        'DATOS DEL NEGOCIO',
        `Negocio: ${business?.nombre || negocioId || 'Complejo'}`,
        '',
        'DATOS DE LA RESERVA',
        `Código: ${selectedRes.id}`,
        'Estado: Finalizada',
        `Espacio: ${space}`,
        `Fecha: ${selectedRes.date}`,
        `Horario: ${selectedRes.startTime} a ${selectedRes.endTime}`,
        `Personas: ${(selectedRes as any).personas ?? 'No informado'}`,
        `Importe total: $${total.toLocaleString('es-AR')}`,
        `Seña / pagado: $${pagado.toLocaleString('es-AR')}`,
        `Saldo pendiente: $${saldo.toLocaleString('es-AR')}`,
        `Estado de pago: ${selectedRes.paymentStatus || 'No informado'}`,
        `Medio de pago: ${(selectedRes as any).paymentMethod || 'No informado'}`,
        '',
        'DATOS DEL CLIENTE',
        `Nombre: ${selectedRes.clientName || client?.name || 'No informado'}`,
        `Teléfono: ${selectedRes.clientPhone || client?.phone || 'No informado'}`,
        `Email: ${client?.email || (selectedRes as any).clientEmail || 'No informado'}`,
        `Observaciones: ${selectedRes.notes || 'Sin observaciones'}`,
      ].join('\n');
      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      setCompletionWhatsAppUrl(url);
      if (whatsappWindow) {
        whatsappWindow.location.href = url;
      } else {
        setCompletionError('La reserva se finalizó, pero el navegador bloqueó la ventana de WhatsApp. Usá el enlace que aparece abajo.');
      }
      setCompletionNotice('Reserva finalizada. WhatsApp se abre con el mensaje preparado; revisalo y tocá Enviar.');
    } catch (error) {
      if (whatsappWindow) whatsappWindow.close();
      setCompletionError(error instanceof Error ? error.message : 'No se pudo finalizar la reserva.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reservas y Turnos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Calendario interactivo de reservas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowFixedTurnos((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 font-medium transition-colors"
          >
            <Icon name="event_repeat" />
            {showFixedTurnos ? 'Ocultar turnos fijos' : 'Turnos fijos'}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            <Icon name="add" />
            Nueva Reserva
          </button>
        </div>
      </div>

      {(reservationsLoadError || reservationPersistenceError) && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {reservationsLoadError || reservationPersistenceError}
        </div>
      )}
      {reservationsLoading && (
        <p className="text-sm text-slate-500">Cargando reservas guardadas…</p>
      )}
      {showFixedTurnos && <FixedTurnos />}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {(['day', 'week', 'month'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                mode === m
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {m === 'day' ? 'Día' : m === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate((d) => addDays(d, mode === 'month' ? -30 : mode === 'week' ? -7 : -1))}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Icon name="chevron_left" />
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {format(selectedDate, mode === 'month' ? 'MMMM yyyy' : 'dd MMM yyyy', { locale: es })}
          </span>
          <button
            onClick={() => setSelectedDate((d) => addDays(d, mode === 'month' ? 30 : mode === 'week' ? 7 : 1))}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Icon name="chevron_right" />
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('activas')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === 'activas'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Desde ahora ({activas.length})
            </button>
            <button
              onClick={() => setTab('historial')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === 'historial'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Historial ({historial.length})
            </button>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            {tab === 'activas' ? 'Turnos activos' : 'Turnos anteriores'}
          </span>
        </div>

        {(tab === 'activas' ? activas : historial).length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Icon name="event_busy" size={48} className="mx-auto mb-3 opacity-50" />
            <p>No hay reservas para este período</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(tab === 'activas' ? activas : historial).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRes(r)}
                className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {r.startTime}
                    </span>
                    <span className="text-[10px] text-slate-500">{r.endTime}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{r.clientName}</p>
                    <p className="text-sm text-slate-500">
                      {courtName(r.espacioId || (r as any).courtId)} · {r.clientPhone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:ml-auto">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${paymentBadge[r.paymentStatus]}`}>
                    {r.paymentStatus === 'pendiente' ? 'Pendiente' : r.paymentStatus === 'senado' ? 'Señado' : 'Pagado'}
                  </span>
                  <span className="text-sm font-semibold">
                    ${r.amount.toLocaleString('es-AR')}
                  </span>
                  <Icon name="chevron_right" className="text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ReservationModal open={modalOpen} onClose={() => setModalOpen(false)} />
      {/* Detalle de reserva */}
      {selectedRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedRes(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Detalle de reserva</h3>
                <p className="text-sm text-slate-500">{selectedRes.date}</p>
              </div>
              <button onClick={() => setSelectedRes(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <Icon name="close" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente</span>
                <span className="font-medium">{selectedRes.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Teléfono</span>
                <span className="font-medium">{selectedRes.clientPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Espacio</span>
                <span className="font-medium">{courtName(selectedRes.espacioId || (selectedRes as any).courtId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Horario</span>
                <span className="font-medium">{selectedRes.startTime} – {selectedRes.endTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pago</span>
                <span className={`font-medium capitalize ${paymentBadge[selectedRes.paymentStatus]} px-2 py-0.5 rounded-full text-xs`}>
                  {selectedRes.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto</span>
                <span className="font-bold">${selectedRes.amount.toLocaleString('es-AR')}</span>
              </div>
              {selectedRes.paidAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Pagado / Seña</span>
                  <span className="font-medium">${selectedRes.paidAmount.toLocaleString('es-AR')}</span>
                </div>
              )}
              {selectedRes.notes && (
                <div>
                  <span className="text-slate-500">Notas</span>
                  <p className="mt-1">{selectedRes.notes}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              {selectedRes.estado !== 'completada' && selectedRes.estado !== 'cancelada' && (
                <button
                  type="button"
                  onClick={finalizeReservation}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-center"
                >
                  Finalizar reserva y abrir WhatsApp
                </button>
              )}
              {completionNotice && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{completionNotice}</p>}
              {completionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{completionError}</p>}
              {completionWhatsAppUrl && <a href={completionWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 font-semibold text-center">Abrir WhatsApp con el detalle</a>}
<a
                href={`https://wa.me/${selectedRes.clientPhone.replace(/\D/g, '').replace(/^0/, '54')}?text=${encodeURIComponent(
                  `Hola ${selectedRes.clientName}! Te escribimos de Complejo Giovanni por tu reserva del ${selectedRes.date} de ${selectedRes.startTime} a ${selectedRes.endTime} en ${courtName(selectedRes.espacioId || (selectedRes as any).courtId)}. ¿Confirmás asistencia?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center flex items-center justify-center gap-2"
              >
                <Icon name="chat" />
                Enviar WhatsApp
              </a>
              <a
                href={`tel:${selectedRes.clientPhone}`}
                className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-center flex items-center justify-center gap-2"
              >
                <Icon name="call" />
                Llamar
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
