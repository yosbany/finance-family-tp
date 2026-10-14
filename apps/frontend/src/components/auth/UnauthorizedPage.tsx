import { Navigate } from 'react-router-dom';
import { signOut } from '../../services/auth.service';
import { useAuthorization } from '../../hooks/useAuthorization';

export const UnauthorizedPage = () => {
  const { user, isAuthorized, loading } = useAuthorization();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-300">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthorized) {
    return <Navigate to="/" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 px-4">
      <div className="card max-w-md w-full text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Esperando autorización
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tu cuenta quedó registrada, pero todavía no puedes ver los datos de la familia.
          Un miembro autorizado debe aprobarte desde la app.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Cuando te aprueben, esta pantalla se actualizará sola y entrarás automáticamente.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          className="btn-secondary w-full"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
