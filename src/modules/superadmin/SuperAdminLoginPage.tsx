import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';

export default function SuperAdminLoginPage() {
  const [username, setUsername] = useState('super');
  const [password, setPassword] = useState('admin');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'creds' | 'pin'>('creds');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithPin, user } = useAuth();
  const navigate = useNavigate();

  const handleQuickSuperAdmin = async () => {
    setLoading(true);
    setError('');
    const ok = await login('super', 'admin');
    setLoading(false);
    if (ok) {
      navigate('/superadmin');
    } else {
      setError('Error al iniciar sesión como SuperAdmin');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let ok = false;
    if (mode === 'creds') {
      ok = await login(username, password);
    } else {
      ok = await loginWithPin(pin);
    }

    setLoading(false);
    if (ok) {
      navigate('/superadmin');
    } else {
      setError(mode === 'creds' ? 'Credenciales incorrectas (usá super / admin)' : 'PIN incorrecto (usá 0000)');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25 ring-1 ring-white/20">
            <Icon name="admin_panel_settings" className="text-white" size={34} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            SaaS Multi-Tenant Console
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Acceso SuperAdmin</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestión global de complejos, planes y módulos del sistema
          </p>
        </div>

        {/* Current user notice if logged in as non-superadmin */}
        {user && user.rol !== 'superadmin' && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
            <Icon name="info" className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="font-semibold text-amber-300">Sesión actual: {user.nombre} ({user.rol})</p>
              <p className="mt-0.5 text-amber-200/80">
                Esta consola requiere credenciales de SuperAdmin. Podés acceder con un click o cambiar de cuenta.
              </p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-[#121722]/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Quick Demo Button */}
          <button
            type="button"
            onClick={handleQuickSuperAdmin}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
          >
            <Icon name="bolt" size={20} className="text-amber-300" />
            <span>Ingresar como SuperAdmin (1-Click Demo)</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">o con credenciales</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl bg-white/5 p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setMode('creds')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'creds' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Usuario / Email
            </button>
            <button
              type="button"
              onClick={() => setMode('pin')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'pin' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              PIN Rápido
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'creds' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Usuario o Email
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="super"
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="admin"
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 text-center">
                  PIN de Acceso SuperAdmin
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center text-2xl tracking-[0.5em]"
                />
                <p className="text-[11px] text-slate-500 text-center mt-1">PIN por defecto: <strong>0000</strong></p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <Icon name="error" size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all border border-white/10 disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Acceder al SuperAdmin'}
            </button>
          </form>

          {/* Quick links footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <Link to="/login" className="hover:text-white transition-colors flex items-center gap-1">
              <Icon name="login" size={14} />
              Login normal
            </Link>
            <Link to="/giovanni" className="hover:text-white transition-colors flex items-center gap-1">
              <Icon name="sports_soccer" size={14} />
              Complejo Giovanni
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
