import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { TopBar } from './TopBar';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <>
      <div className="flex h-screen overflow-hidden bg-secondary-50 dark:bg-primary-950">
        {/* La barra lateral siempre está presente pero oculta en móviles */}
        <div className="hidden lg:block lg:w-64 flex-shrink-0">
          <Sidebar />
        </div>
        {/* Sidebar para móvil que se muestra sobre el contenido */}
        <div className="lg:hidden">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto w-full">
          <TopBar title={title} />
          <div className="px-3 sm:px-4 md:px-6 pb-6 space-y-3 sm:space-y-4">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
