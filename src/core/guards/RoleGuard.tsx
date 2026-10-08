import { Navigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import type { UserRole } from '../../types';
import type { ReactNode } from 'react';

interface Props {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export default function RoleGuard({ allowedRoles, children }: Props) {
  const { user, loading, logout } = useAuth();
  const { negocioId } = useParams();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={negocioId ? `/${negocioId}/login` : '/login'} replace />;
  }

  if (!allowedRoles.includes(user.rol) && user.rol !== 'superadmin') {
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
            <h1 className="text-xl font-bold tracking-tight text-white">Rol No Autorizado</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Tu rol <span className="text-amber-300 font-mono font-bold uppercase">[{user.rol}]</span> no tiene acceso a esta sección. Roles permitidos:{' '}
              <span className="text-slate-300 font-mono">[{allowedRoles.join(', ')}]</span>.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              to={negocioId ? `/${negocioId}` : '/giovanni'}
              className="py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors"
            >
              Ir al Inicio del Complejo
            </Link>
            <button
              onClick={() => logout()}
              className="py-2 px-4 rounded-xl text-slate-400 hover:text-red-400 text-xs font-semibold transition-colors"
            >
              Cerrar sesión / Cambiar cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
