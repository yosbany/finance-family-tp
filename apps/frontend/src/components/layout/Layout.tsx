import { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  wide?: boolean;
}

export const Layout = ({ children, wide = false }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-900 dark:bg-black">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 min-w-0 ${wide ? 'p-4 md:p-6' : 'p-8'}`}>
          <div className={wide ? 'h-[calc(100vh-8rem)]' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Made with Bob
