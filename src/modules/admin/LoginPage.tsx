import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Icon } from '../../components/ui/Icon';

export default function LoginPage() {
  const { negocioId } = useParams();
  const tenants = useSuperAdminStore((s) => s.tenants);
  const currentTenant = negocioId
    ? tenants.find(
        (t) =>
          t.slug.toLowerCase() === negocioId.toLowerCase() ||
          t.id.toLowerCase() === negocioId.toLowerCase()
      )
    : null;
  const tenantName = currentTenant?.nombre || (negocioId ? negocioId.toUpperCase() : 'Panel de Administración');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'email' | 'pin'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithPin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let ok = false;
    if (mode === 'email') {
      ok = await login(email, password, negocioId);
    } else {
      ok = await loginWithPin(pin, negocioId);
    }

    setLoading(false);
    if (ok) {
      // Redirect based on role
      const stored = localStorage.getItem('giovanni-auth');
      let role = '';
      try { role = stored ? JSON.parse(stored).rol : ''; } catch {}
      if (role === 'superadmin') {
        navigate('/superadmin');
      } else if (role === 'mozo') {
        navigate(negocioId ? `/${negocioId}/app/mozos` : '/giovanni/app/mozos');
      } else if (role === 'delivery') {
        navigate(negocioId ? `/${negocioId}/app/delivery` : '/giovanni/app/delivery');
      } else if (role === 'cocina') {
        navigate(negocioId ? `/${negocioId}/cocina` : '/giovanni/cocina');
      } else {
        navigate(negocioId ? `/${negocioId}/dashboard` : '/giovanni/dashboard');
      }
    } else {
      setError(
        mode === 'email'
          ? `Usuario o contraseña incorrectos para ${tenantName}`
          : 'PIN incorrecto para este complejo'
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
            <Icon name="sports_soccer" className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold">{tenantName}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Ingresá a tu panel de administración
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('email')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'email' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setMode('pin')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'pin' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'
              }`}
            >
              PIN rápido
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'email' ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Usuario o Email</label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin o super"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5">PIN de acceso (4 dígitos)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center text-2xl tracking-[0.5em]"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {/* Quick Demo Login Buttons */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Acceso rápido de prueba:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={async () => {
                  await login('admin', 'admin');
                  navigate(negocioId ? `/${negocioId}/dashboard` : '/giovanni/dashboard');
                }}
                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/20 text-left transition-colors flex items-center gap-1.5"
              >
                <span>⚽</span> Panel Admin
              </button>
              <button
                type="button"
                onClick={async () => {
                  await login('mozo', 'admin');
                  navigate(negocioId ? `/${negocioId}/app/mozos` : '/giovanni/app/mozos');
                }}
                className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/20 text-left transition-colors flex items-center gap-1.5"
              >
                <span>🍽️</span> App Mozos
              </button>
              <button
                type="button"
                onClick={async () => {
                  await login('cocina', 'admin');
                  navigate(negocioId ? `/${negocioId}/cocina` : '/giovanni/cocina');
                }}
                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/20 text-left transition-colors flex items-center gap-1.5"
              >
                <span>🍳</span> KDS Cocina
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
