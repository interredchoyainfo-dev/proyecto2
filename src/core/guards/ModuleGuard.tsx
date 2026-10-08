import { useParams, Link } from 'react-router-dom';
import { useConfig } from '../services/ConfigContext';
import { Icon } from '../../components/ui/Icon';
import type { ModuleId } from '../../types';
import type { ReactNode } from 'react';

interface Props {
  moduleId: ModuleId;
  children: ReactNode;
}

const moduleNames: Record<ModuleId, string> = {
  bar: 'Bar / Mesas & Salón',
  reservas: 'Reservas & Canchas',
  cocina: 'Cocina KDS',
  caja: 'Control de Caja',
  inventario: 'Inventario de Stock',
  mozos: 'App Móvil Mozos',
  delivery: 'Módulo Delivery',
  torneos: 'Gestión de Torneos',
  escuela: 'Escuela de Deportes',
  access_control: 'Control de Accesos QR',
  smart_center: 'Smart Center IoT',
  finanzas: 'Finanzas & Reportes',
  empleados: 'Gestión de RRHH',
  analytics_ai: 'Analytics & Predicciones IA',
  iot: 'Dispositivos IoT',
};

export default function ModuleGuard({ moduleId, children }: Props) {
  const { config, loading, isModuleActive } = useConfig();
  const { negocioId } = useParams();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // If module is not active for this tenant
  if (!config || !isModuleActive(moduleId)) {
    const modLabel = moduleNames[moduleId] || moduleId;
    const tenantName = config?.negocio.nombre || negocioId || 'este complejo';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/${negocioId}/app/${moduleId}`;
    const wspMessage = `Hola, me comunico desde el complejo "${tenantName}". Necesitamos habilitar el módulo "${modLabel}" (Ruta solicitada: ${currentPath}).`;
    const wspUrl = `https://wa.me/549353003273?text=${encodeURIComponent(wspMessage)}`;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
          <Icon name="lock" size={32} className="text-amber-400" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-amber-500/20">
          Acceso Restringido
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          Módulo no habilitado, hablar con administración
        </h2>
        <p className="text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
          El módulo <strong className="text-amber-300">{modLabel}</strong> no se encuentra activo para el complejo{' '}
          <strong className="text-white">{tenantName}</strong>. Para contratarlo o activarlo, comunicate con el administrador general.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
          {/* WhatsApp Admin button */}
          <a
            href={wspUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-black font-bold text-xs tracking-wide transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <Icon name="chat" size={18} />
            <span>Consultar por WhatsApp (353003273)</span>
          </a>

          <Link
            to={negocioId ? `/${negocioId}/dashboard` : '/giovanni/dashboard'}
            className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="arrow_back" size={16} />
            <span>Volver al Dashboard</span>
          </Link>
        </div>

        </div>
    );
  }

  return <>{children}</>;
}
