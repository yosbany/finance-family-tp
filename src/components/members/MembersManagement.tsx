import { useEffect, useState } from 'react';
import {
  AuthorizedUser,
  approveUser,
  getAllAuthorizedUsers,
  revokeUserAccess,
} from '../../services/authorization.service';
import { useAuthorization } from '../../hooks/useAuthorization';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useModal } from '../../hooks/useModal';

export const MembersManagement = () => {
  const { user, authorizedUser, isAuthorized, familyRoot } = useAuthorization();
  const { showConfirm, showSuccess, showError, ModalComponent } = useModal();
  const [members, setMembers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionUid, setActionUid] = useState<string | null>(null);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await getAllAuthorizedUsers();
      setMembers(data);
    } catch (error) {
      console.error('Error al cargar miembros:', error);
      showError('No se pudieron cargar los miembros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadMembers();
    }
  }, [isAuthorized]);

  const pending = members.filter(m => !m.autorizado);
  const approved = members.filter(m => m.autorizado);

  const handleApprove = (member: AuthorizedUser) => {
    if (!user || !authorizedUser) return;

    showConfirm({
      title: 'Aprobar acceso',
      message: `¿Aprobar a ${member.displayName || member.email} para ver los datos de la familia?`,
      confirmText: 'Aprobar',
      onConfirm: async () => {
        try {
          setActionUid(member.uid);
          await approveUser(member.uid, {
            uid: user.uid,
            familyRoot: authorizedUser.familyRoot || familyRoot,
          });
          await loadMembers();
          showSuccess('Usuario aprobado');
        } catch (error) {
          console.error(error);
          showError(error instanceof Error ? error.message : 'No se pudo aprobar');
        } finally {
          setActionUid(null);
        }
      },
    });
  };

  const handleRevoke = (member: AuthorizedUser) => {
    if (!user || member.uid === user.uid) return;

    showConfirm({
      title: 'Quitar acceso',
      message: `¿Quitar el acceso de ${member.displayName || member.email}? Volverá a la pantalla de espera.`,
      confirmText: 'Quitar acceso',
      onConfirm: async () => {
        try {
          setActionUid(member.uid);
          await revokeUserAccess(member.uid);
          await loadMembers();
          showSuccess('Acceso revocado');
        } catch (error) {
          console.error(error);
          showError(error instanceof Error ? error.message : 'No se pudo revocar');
        } finally {
          setActionUid(null);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title-lg">Miembros</h1>
        <p className="page-subtitle">
          Aprueba a quienes se registraron con Google antes de que vean los datos familiares
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
          <p className="text-3xl font-bold text-orange-500">{pending.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Aprobados</p>
          <p className="text-3xl font-bold text-green-500">{approved.length}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Esperando aprobación
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No hay solicitudes pendientes
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map(member => (
              <div
                key={member.uid}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {member.displayName || 'Sin nombre'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {member.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Solicitó: {new Date(member.requestedAt).toLocaleString('es-UY')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApprove(member)}
                  disabled={actionUid === member.uid}
                  className="btn-primary whitespace-nowrap disabled:opacity-50"
                >
                  {actionUid === member.uid ? 'Aprobando...' : 'Aprobar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Miembros con acceso
        </h2>
        <div className="space-y-3">
          {approved.map(member => (
            <div
              key={member.uid}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {member.displayName || 'Sin nombre'}
                  </p>
                  {member.uid === user?.uid && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      Tú
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {member.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Nodo: {member.familyRoot}
                  {member.authorizedAt
                    ? ` · Aprobado: ${new Date(member.authorizedAt).toLocaleString('es-UY')}`
                    : ''}
                </p>
              </div>
              {member.uid !== user?.uid && (
                <button
                  type="button"
                  onClick={() => handleRevoke(member)}
                  disabled={actionUid === member.uid}
                  className="px-4 py-2 text-sm rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                >
                  {actionUid === member.uid ? 'Quitando...' : 'Quitar acceso'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ModalComponent />
    </div>
  );
};
