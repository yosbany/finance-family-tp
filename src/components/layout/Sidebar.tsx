import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/accounts', label: 'Cuentas', icon: '💳' },
  { path: '/transactions', label: 'Transacciones', icon: '💸' },
  { path: '/transactions/upload', label: 'Cargar Extractos', icon: '📤' },
  { path: '/categories', label: 'Categorías', icon: '🏷️' },
  { path: '/assets', label: 'Patrimonio', icon: '💎' },
  { path: '/goals', label: 'Objetivos', icon: '🎯' },
  { path: '/reports', label: 'Reportes', icon: '📈' },
];

export const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-gray-800 dark:bg-gray-900 border-r border-gray-700 dark:border-gray-800 min-h-[calc(100vh-5rem)] hidden md:block transition-all duration-300 relative`}
    >
      {/* Toggle Button - Top left corner */}
      <div className="p-3 pb-0">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 dark:bg-gray-800/50 dark:hover:bg-gray-700/50 transition-colors"
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <svg
            className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {!isCollapsed && (
            <span className="text-sm text-gray-400">Menú</span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/30'
                      : 'text-gray-300 hover:bg-gray-700/50 dark:hover:bg-gray-800/50 hover:text-white'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <span className={`text-xl ${isCollapsed ? 'mx-auto' : ''}`}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                  {!isCollapsed && isActive && (
                    <svg
                      className="w-4 h-4 ml-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer Info (solo cuando está expandido) */}
      {!isCollapsed && (
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="bg-gray-700/30 dark:bg-gray-800/30 rounded-lg p-3 border border-gray-600/30 dark:border-gray-700/30">
            <p className="text-xs text-gray-400 text-center">
              💰 Finanzas Familiares
            </p>
            <p className="text-xs text-gray-500 text-center mt-1">
              v1.0.0
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

// Made with Bob
