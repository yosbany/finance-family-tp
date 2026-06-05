import { signOut } from '../../services/auth.service';
import { useAuth } from '../../hooks/useAuth';

export const Header = () => {
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <header className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 dark:from-gray-900 dark:via-black dark:to-gray-900 border-b border-gray-700 dark:border-gray-800">
      <div className="px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo y Título */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-400 to-green-600 p-2.5 rounded-xl shadow-lg">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Finanzas Familiares
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">Gestiona tus finanzas de manera inteligente</p>
            </div>
          </div>
          
          {/* Usuario y Acciones */}
          <div className="flex items-stretch gap-3">
            {user && (
              <>
                <div className="flex items-center gap-3 bg-gray-700/50 dark:bg-gray-800/50 px-4 py-2 rounded-xl border border-gray-600 dark:border-gray-700">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuario'}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-green-500/50"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center font-semibold text-sm ring-2 ring-green-500/50"
                    style={{ display: user.photoURL ? 'none' : 'flex' }}
                  >
                    {user.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-200 dark:text-gray-100 hidden sm:block">
                    {user.displayName}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-6 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-600/50 dark:bg-gray-800/50 dark:hover:bg-gray-700/50 rounded-xl border border-gray-600 dark:border-gray-700 transition-all duration-200"
                >
                  Cerrar Sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// Made with Bob
