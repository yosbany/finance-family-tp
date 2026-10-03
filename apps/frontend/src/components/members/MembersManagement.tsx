import { useEffect, useMemo, useState } from 'react';
import {
  AuthorizedUser,
  approveUser,
  getAllAuthorizedUsers,
  getKnownFamilyRoots,
  revokeUserAccess,
  updateMemberFamily,
} from '../../services/authorization.service';
import { DEFAULT_FAMILY_ROOT } from '../../services/familyPaths';
import { useAuthorization } from '../../hooks/useAuthorization';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useModal } from '../../hooks/useModal';

const isValidFamilyRoot = (value: string) => /^[a-zA-Z0-9_-]+$/.test(value.trim());

export const MembersManagement = () => {
  const { user, authorizedUser, isAuthorized, familyRoot } = useAuthorization();
  const { showConfirm, showSuccess, showError, ModalComponent } = useModal();
  const [members, setMembers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionUid, setActionUid] = useState<string | null>(null);
  const [selectedFamilyByUid, setSelectedFamilyByUid] = useState<Record<string, string>>({});
  const [customFamilyByUid, setCustomFamilyByUid] = useState<Record<string, string>>({});

  const currentFamily = authorizedUser?.familyRoot || familyRoot || DEFAULT_FAMILY_ROOT;

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

  const knownFamilies = useMemo(
    () => getKnownFamilyRoots(members, currentFamily),
    [members, currentFamily]
  );

  const pending = members.filter(m => !m.autorizado);
  const approved = members.filter(m => m.autorizado);
  const sameFamily = approved.filter(m => m.familyRoot === currentFamily);
  const otherFamilies = approved.filter(m => m.familyRoot !== currentFamily);

  const resolveFamilyFor = (uid: string, fallback = currentFamily) => {
    const selected = selectedFamilyByUid[uid];
    if (selected === '__custom__') {
      return (customFamilyByUid[uid] || '').trim();
    }
    return (selected || fallback).trim();
  };

  const handleApprove = (member: AuthorizedUser) => {
    if (!user || !authorizedUser) return;

    const targetFamily = resolveFamilyFor(member.uid, currentFamily);
    if (!isValidFamilyRoot(targetFamily)) {
      showError('La familia debe usar solo letras, números, _ o - (ej: family)');
      return;
    }

    showConfirm({
      title: 'Aprobar y agrupar en familia',
      message: `¿Aprobar a ${member.displayName || member.email} y asignarlo a la familia "${targetFamily}"? Verá las mismas cuentas y transacciones de ese grupo.`,
      confirmText: 'Aprobar',
      onConfirm: async () => {
        try {
          setActionUid(member.uid);
          await approveUser(member.uid, {
            uid: user.uid,
            familyRoot: targetFamily,
          });
          await loadMembers();
          showSuccess(`Aprobado en la familia "${targetFamily}"`);
        } catch (error) {
          console.error(error);
          showError(error instanceof Error ? error.message : 'No se pudo aprobar');
        } finally {
          setActionUid(null);
        }
      },
    });
  };

  const handleChangeFamily = (member: AuthorizedUser) => {
    if (!user) return;

    const targetFamily = resolveFamilyFor(member.uid, member.familyRoot);
    if (!isValidFamilyRoot(targetFamily)) {
      showError('La familia debe usar solo letras, números, _ o - (ej: family)');
      return;
    }

    if (targetFamily === member.familyRoot) {
      showError('Ya pertenece a esa familia');
      return;
    }

    showConfirm({
      title: 'Cambiar familia',
      message: `¿Mover a ${member.displayName || member.email} de "${member.familyRoot}" a "${targetFamily}"?`,
      confirmText: 'Cambiar',
      onConfirm: async () => {
        try {
          setActionUid(member.uid);
          await updateMemberFamily(member.uid, targetFamily, user.uid);
          await loadMembers();
          showSuccess(`Ahora pertenece a "${targetFamily}"`);
        } catch (error) {
          console.error(error);
          showError(error instanceof Error ? error.message : 'No se pudo cambiar la familia');
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

  const renderFamilyPicker = (uid: string, defaultFamily: string) => {
    const selected = selectedFamilyByUid[uid] ?? defaultFamily;
    const isCustom = selected === '__custom__';

    return (
      <div className="flex flex-col gap-2 min-w-[180px]">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Familia
        </label>
        <select
          value={isCustom ? '__custom__' : selected}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedFamilyByUid(prev => ({ ...prev, [uid]: value }));
          }}
          className="input-field text-sm py-2"
        >
          {knownFamilies.map(root => (
            <option key={root} value={root}>
              {root}{root === currentFamily ? ' (tu familia)' : ''}
            </option>
          ))}
          <option value="__custom__">Otra familia...</option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={customFamilyByUid[uid] || ''}
            onChange={(e) =>
              setCustomFamilyByUid(prev => ({ ...prev, [uid]: e.target.value.trim() }))
            }
            placeholder="ej: familia-tejas"
            className="input-field text-sm py-2"
          />
        )}
      </div>
    );
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
          Aprueba usuarios y asígnalos a una familia para que vean los mismos datos
        </p>
      </div>

      <div className="card border border-primary/30">
        <p className="text-sm text-gray-500 dark:text-gray-400">Tu familia actual</p>
        <p className="text-2xl font-bold text-primary mt-1">{currentFamily}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Los datos compartidos viven en el nodo <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{currentFamily}/</code> de Firebase.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
          <p className="text-3xl font-bold text-orange-500">{pending.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">En tu familia</p>
          <p className="text-3xl font-bold text-green-500">{sameFamily.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Otras familias</p>
          <p className="text-3xl font-bold text-blue-500">{otherFamilies.length}</p>
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
                className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 p-4 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10"
              >
                <div className="min-w-0 flex-1">
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
                {renderFamilyPicker(member.uid, currentFamily)}
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
          Miembros de tu familia ({currentFamily})
        </h2>
        {sameFamily.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nadie más en esta familia</p>
        ) : (
          <div className="space-y-3">
            {sameFamily.map(member => (
              <div
                key={member.uid}
                className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {member.displayName || 'Sin nombre'}
                    </p>
                    {member.uid === user?.uid && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        Tú
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      {member.familyRoot}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {member.email}
                  </p>
                </div>
                {member.uid !== user?.uid && (
                  <>
                    {renderFamilyPicker(member.uid, member.familyRoot)}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeFamily(member)}
                        disabled={actionUid === member.uid}
                        className="px-4 py-2 text-sm rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
                      >
                        Cambiar familia
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(member)}
                        disabled={actionUid === member.uid}
                        className="px-4 py-2 text-sm rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 disabled:opacity-50"
                      >
                        Quitar acceso
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {otherFamilies.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Miembros en otras familias
          </h2>
          <div className="space-y-3">
            {otherFamilies.map(member => (
              <div
                key={member.uid}
                className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {member.displayName || 'Sin nombre'}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {member.familyRoot}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {member.email}
                  </p>
                </div>
                {renderFamilyPicker(member.uid, member.familyRoot)}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangeFamily(member)}
                    disabled={actionUid === member.uid}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
                  >
                    Cambiar familia
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(member)}
                    disabled={actionUid === member.uid}
                    className="px-4 py-2 text-sm rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 disabled:opacity-50"
                  >
                    Quitar acceso
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ModalComponent />
    </div>
  );
};
