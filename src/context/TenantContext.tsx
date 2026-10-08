import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

interface TenantContextValue {
  negocioId: string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  negocioId: explicitNegocioId,
  children,
}: {
  negocioId?: string;
  children: ReactNode;
}) {
  const { negocioId: paramNegocioId } = useParams();
  const rawId = explicitNegocioId || paramNegocioId || 'giovanni';
  const negocioId = useMemo(() => rawId.toLowerCase().trim(), [rawId]);

  return (
    <TenantContext.Provider value={{ negocioId }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    return { negocioId: 'giovanni' };
  }
  return ctx;
}
