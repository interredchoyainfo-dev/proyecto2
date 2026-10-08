import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useEspaciosStore } from '../../store/useEspaciosStore';
import { Icon } from '../ui/Icon';
import type { DaySchedule } from '../../types';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function Settings() {
  const { negocioId } = useParams();
  const currentSlug = (negocioId || "giovanni").toLowerCase();
  const tenant = useSuperAdminStore((s) =>
    s.tenants.find((t) => t.slug.toLowerCase() === currentSlug || t.id.toLowerCase() === currentSlug)
  );
  const updateTenant = useSuperAdminStore((s) => s.updateTenant);

  const [nombre, setNombre] = useState(tenant?.nombre || "Complejo Deportivo");
  const [subtitulo, setSubtitulo] = useState((tenant as any)?.subtitulo || "TU LUGAR DEPORTIVO");
  const [descripcion, setDescripcion] = useState(
    tenant?.descripcion ||
      "Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha."
  );
  const [whatsapp, setWhatsapp] = useState((tenant as any)?.whatsapp || "3855374835");
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (tenant) {
      setNombre(tenant.nombre);
      setSubtitulo((tenant as any).subtitulo || "TU LUGAR DEPORTIVO");
      setDescripcion(
        tenant.descripcion ||
          "Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha."
      );
      setWhatsapp((tenant as any).whatsapp || "3855374835");
    }
  }, [tenant]);

  const handleSaveInfo = () => {
    if (!tenant) return;
    updateTenant(tenant.id, {
      nombre: nombre.trim(),
      subtitulo: subtitulo.trim(),
      descripcion: descripcion.trim(),
      whatsapp: whatsapp.trim(),
    } as any);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const config = useStore((s) => s.config);
  const updateConfig = useStore((s) => s.updateConfig);
  const currentUser = useStore((s) => s.currentUser);
  const espacios = useEspaciosStore((s) => s.espacios);

  const schedules: DaySchedule[] =
    config.schedules?.length === 7
      ? config.schedules
      : DAY_NAMES.map((_, i) => ({
          day: i,
          open: config.openTime || '08:00',
          close: config.closeTime || '00:00',
        }));

  const updateSchedule = (day: number, field: keyof DaySchedule, value: string | boolean) => {
    const next = schedules.map((s) =>
      s.day === day ? { ...s, [field]: value } : s
    );
    updateConfig({ schedules: next });
  };

  const updatePrice = (
    courtId: string,
    field: 'dayPrice' | 'nightPrice' | 'nightStartHour',
    value: number
  ) => {
    let prices = config.prices || [];
    const exists = prices.find((p) => p.courtId === courtId);
    if (!exists) {
      prices = [
        ...prices,
        { courtId, dayPrice: 12000, nightPrice: 15000, nightStartHour: config.nightStartHour || 18 },
      ];
    }
    prices = prices.map((p) => (p.courtId === courtId ? { ...p, [field]: value } : p));
    updateConfig({ prices });
  };

  const getPrice = (courtId: string) =>
    config.prices?.find((p) => p.courtId === courtId) || {
      courtId,
      dayPrice: 12000,
      nightPrice: 15000,
      nightStartHour: config.nightStartHour || 18,
    };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración del Sistema</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Horarios por día, tarifa diurna/nocturna y usuarios
        </p>
      </div>

      {/* Información del Complejo & Textos de Portada */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Icon name="store" />
            Información del Complejo & Portada de Clientes
          </h3>
          {savedBanner && (
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              ✓ Cambios guardados correctamente
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Personaliza el nombre, lema y descripción que verán tus clientes en la portada.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del Complejo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
              placeholder="Ej. Complejo Giovanni"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Slogan / Subtítulo Destacado</label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold uppercase"
              placeholder="Ej. TU LUGAR DEPORTIVO"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Descripción General (Portada)</label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm resize-none"
              placeholder="Descripción de tus instalaciones y servicios..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">WhatsApp de Reservas / Contacto</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              placeholder="Ej. 3855374835"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSaveInfo}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Icon name="save" size={18} />
              Guardar Información de Portada
            </button>
          </div>
        </div>
      </div>
      {/* Horarios por día */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Icon name="schedule" />
          Horarios por día de la semana
        </h3>
        <div className="space-y-3">
          {schedules
            .slice()
            .sort((a, b) => a.day - b.day)
            .map((s) => (
              <div
                key={s.day}
                className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"
              >
                <span className="w-24 font-medium text-sm">{DAY_NAMES[s.day]}</span>
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={!!s.closed}
                    onChange={(e) => updateSchedule(s.day, 'closed', e.target.checked)}
                  />
                  Cerrado
                </label>
                {!s.closed && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Abre</span>
                      <input
                        type="time"
                        value={s.open}
                        onChange={(e) => updateSchedule(s.day, 'open', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Cierra</span>
                      <input
                        type="time"
                        value={s.close}
                        onChange={(e) => updateSchedule(s.day, 'close', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Tarifa nocturna global */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Icon name="dark_mode" />
          Inicio de horario nocturno
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          A partir de esta hora se aplica el precio nocturno en las reservas
        </p>
        <div className="flex items-center gap-3 max-w-xs">
          <input
            type="number"
            min={0}
            max={23}
            value={config.nightStartHour ?? 18}
            onChange={(e) => updateConfig({ nightStartHour: Number(e.target.value) })}
            className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
          <span className="text-sm text-slate-500">hs (ej: 18 = 18:00)</span>
        </div>
      </div>

      {/* Precios por espacio */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Icon name="attach_money" />
          Precios por espacio (diurno / nocturno)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="pb-3 pr-4">Espacio</th>
                <th className="pb-3 pr-4">Precio diurno</th>
                <th className="pb-3 pr-4">Precio nocturno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {espacios.map((esp) => {
                const p = getPrice(esp.id);
                return (
                  <tr key={esp.id}>
                    <td className="py-3 pr-4 font-medium">{esp.name}</td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        value={p.dayPrice}
                        onChange={(e) => updatePrice(esp.id, 'dayPrice', Number(e.target.value))}
                        className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        value={p.nightPrice}
                        onChange={(e) => updatePrice(esp.id, 'nightPrice', Number(e.target.value))}
                        className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Icon name="manage_accounts" />
          Usuarios y roles
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold">
              {(currentUser.name || currentUser.nombre || 'U').charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-medium">{currentUser.name || currentUser.nombre || 'Usuario'}</p>
              <p className="text-xs text-slate-500">{currentUser.email}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 capitalize">
              {currentUser.role || currentUser.rol || 'admin'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Usuarios demo: admin, mozo, cocina, delivery, super — contraseña: <strong>admin</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
