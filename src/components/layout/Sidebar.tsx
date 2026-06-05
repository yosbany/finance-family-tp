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

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-md min-h-[calc(100vh-4rem)] hidden md:block">
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

// Made with Bob
