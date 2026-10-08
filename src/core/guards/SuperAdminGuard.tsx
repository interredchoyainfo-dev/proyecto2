import { type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import SuperAdminLoginPage from '../../modules/superadmin/SuperAdminLoginPage';

interface Props {
  children: ReactNode;
}

export default function SuperAdminGuard({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0A0F]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-400 font-medium">Cargando consola SuperAdmin...</p>
        </div>
      </div>
    );
  }

  // If user has superadmin role, let them pass
  if (user && user.rol === 'superadmin') {
    return <>{children}</>;
  }

  // If not superadmin (or not logged in), render SuperAdminLoginPage in place
  return <SuperAdminLoginPage />;
}
