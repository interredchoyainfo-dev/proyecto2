import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useStore } from '../../store/useStore';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      <Sidebar />
      <Header />
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'pl-[72px]' : 'pl-64'
        }`}
      >
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
