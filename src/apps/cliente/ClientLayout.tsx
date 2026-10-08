import { Outlet, NavLink, useParams } from 'react-router-dom';
import { useConfig } from '../../core/services/ConfigContext';
import { Icon } from '../../components/ui/Icon';

export default function ClientLayout() {
  const { negocioId } = useParams();
  const { config } = useConfig();
  const tenantName = config?.negocio.nombre || 'Complejo Deportivo';
  const accentColor = config?.theme?.accentColor || config?.theme?.primaryColor || '#FBBF24';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#131318', color: '#e4e1e9' }}>
      {/* Fixed Header */}
      <header
        className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.4)]"
        style={{ background: 'rgba(19,19,24,0.85)' }}
      >
        <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}25` }}
            >
              <Icon name="bolt" size={22} style={{ color: accentColor }} />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span
                className="uppercase leading-tight tracking-tight font-black text-[16px] truncate"
                style={{ color: '#fff' }}
                title={tenantName}
              >
                {tenantName}
              </span>
              <span
                className="uppercase tracking-widest leading-none font-extrabold"
                style={{ color: accentColor, fontSize: '10px', letterSpacing: '0.08em' }}
              >
                CENTRO DEPORTIVO
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              aria-label="Notificaciones"
              className="w-11 h-11 flex items-center justify-center rounded-full relative transition-colors hover:opacity-80"
              style={{ color: '#e4e1e9' }}
            >
              <Icon name="notifications" size={22} />
              <span
                className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full"
                style={{ background: '#ec6a06' }}
              />
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#ffc174' }}
            >
              <Icon name="person" size={18} style={{ color: '#472a00' }} />
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pt-16 pb-24 max-w-lg mx-auto w-full">
        <Outlet />
      </main>

      {/* Fixed Bottom Nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
        style={{ background: 'rgba(19,19,24,0.92)' }}
      >
        <div className="flex justify-around items-center h-20 px-1 max-w-lg mx-auto">
          <NavLink
            to={`/${negocioId}`}
            end
            className="flex flex-col items-center justify-center gap-1 w-16 h-14 transition-colors font-extrabold"
            style={({ isActive }) => ({
              color: isActive ? '#FBBF24' : '#64748B',
            })}
          >
            <Icon name="home" size={24} />
            <span style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 800, textTransform: 'uppercase' }}>
              Inicio
            </span>
          </NavLink>

          <NavLink
            to={`/${negocioId}/reservar`}
            className="flex flex-col items-center justify-center gap-1 w-16 h-14 transition-colors font-extrabold"
            style={({ isActive }) => ({
              color: isActive ? '#FBBF24' : '#64748B',
            })}
          >
            <Icon name="sports_tennis" size={24} />
            <span style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 800, textTransform: 'uppercase' }}>
              Reservar
            </span>
          </NavLink>

          <NavLink
            to={`/${negocioId}/menu`}
            className="flex flex-col items-center justify-center gap-1 w-16 h-14 transition-colors font-extrabold"
            style={({ isActive }) => ({
              color: isActive ? '#FBBF24' : '#64748B',
            })}
          >
            <Icon name="restaurant" size={24} />
            <span style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 800, textTransform: 'uppercase' }}>
              Bar
            </span>
          </NavLink>

          <NavLink
            to={`/${negocioId}/mis-reservas`}
            className="flex flex-col items-center justify-center gap-1 w-16 h-14 transition-colors font-extrabold"
            style={({ isActive }) => ({
              color: isActive ? '#FBBF24' : '#64748B',
            })}
          >
            <Icon name="person" size={24} />
            <span style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 800, textTransform: 'uppercase' }}>
              Perfil
            </span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
