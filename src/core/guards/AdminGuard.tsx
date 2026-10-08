import { Navigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import type { ReactNode } from 'react';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { negocioId } = useParams();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#0A0A0F]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={negocioId ? `/${negocioId}/login` : '/login'} replace />;
  }

  // Cross-tenant protection: An admin from one tenant cannot enter another tenant's dashboard
  if (user.rol !== 'superadmin' && user.negocioId && negocioId) {
    const userTenant = user.negocioId.toLowerCase();
    const routeTenant = negocioId.toLowerCase();
    if (userTenant !== routeTenant) {
      return (
        <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#121722] rounded-2xl border border-red-500/30 p-8 shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <Icon name="lock" size={32} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-red-500/20">
                Acceso No Permitido
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">Negocio Distinto</h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Estás identificado como administrador de <strong className="text-violet-300 font-mono">{user.negocioId}</strong>.
                No podés administrar <strong className="text-white font-mono">{negocioId}</strong>.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to={`/${negocioId}/login`}
                onClick={() => logout()}
                className="py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="login" size={16} />
                <span>Ingresar con la clave de {negocioId}</span>
              </Link>
              <Link
                to={`/${user.negocioId}/dashboard`}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="arrow_back" size={16} />
                <span>Volver a {user.negocioId}</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  const adminRoles = ['superadmin', 'admin', 'encargado'];
  if (!adminRoles.includes(user.rol)) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#121722] rounded-2xl border border-red-500/30 p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <Icon name="block" size={32} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-red-500/20">
              Acceso Restringido
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Permisos Insuficientes</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              El usuario <strong className="text-white">{user.nombre}</strong> (rol{' '}
              <span className="text-amber-300 font-mono font-bold uppercase">{user.rol}</span>) no tiene permisos de administración para este complejo.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {user.rol === 'mozo' && (
              <Link
                to={negocioId ? `/${negocioId}/app/mozos` : '/giovanni/app/mozos'}
                className="py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="restaurant" size={16} />
                <span>Ir a la App de Mozos</span>
              </Link>
            )}
            {user.rol === 'cocina' && (
              <Link
                to={negocioId ? `/${negocioId}/cocina` : '/giovanni/cocina'}
                className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="skillet" size={16} />
                <span>Ir a KDS Cocina</span>
              </Link>
            )}
            {user.rol === 'delivery' && (
              <Link
                to={negocioId ? `/${negocioId}/app/delivery` : '/giovanni/app/delivery'}
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="two_wheeler" size={16} />
                <span>Ir a la App de Delivery</span>
              </Link>
            )}
            <Link
              to={negocioId ? `/${negocioId}` : '/giovanni'}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
            >
              Ir al Portal del Complejo
            </Link>
            <button
              onClick={() => logout()}
              className="py-2 px-4 rounded-xl text-slate-400 hover:text-red-400 text-xs font-semibold transition-colors"
            >
              Cerrar sesión / Cambiar de cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
