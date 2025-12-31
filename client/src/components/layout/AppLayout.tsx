import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { TopBar } from './TopBar';
import { PoweredByFooter } from '@/components/ui/PoweredByFooter';
import { AIAssistant } from '@/components/ai/AIAssistant';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <>
      <div className="flex min-h-screen bg-background">
        {/* La barra lateral siempre está presente pero oculta en móviles */}
        <div className="hidden lg:block lg:w-64 flex-shrink-0">
          <Sidebar />
        </div>
        {/* Sidebar para móvil que se muestra sobre el contenido */}
        <div className="lg:hidden">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto w-full flex flex-col bg-background">
          <TopBar title={title} />
          {/* Contenedor central con ancho máximo para evitar layouts "amontonados" en pantallas con escalado */}
          <div className="flex-1 px-3 sm:px-4 md:px-8 pb-6">
            <div className="mx-auto w-full" style={{ maxWidth: '1440px' }}>
              <div className="space-y-3 sm:space-y-4">
                {children}
              </div>
            </div>
          </div>
          <PoweredByFooter />
        </main>
      </div>

      {/* AI Assistant Floating Button */}
      <AIAssistant />
    </>
  );
}
