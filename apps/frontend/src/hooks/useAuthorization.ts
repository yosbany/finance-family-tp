import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { useAuth } from './useAuth';
import { database } from '../services/firebase';
import { AuthorizedUser, registerAccessRequest } from '../services/authorization.service';
import { DEFAULT_FAMILY_ROOT, resetFamilyRoot, setFamilyRoot } from '../services/familyPaths';

export const useAuthorization = () => {
  const { user, loading: authLoading } = useAuth();
  const [authorizedUser, setAuthorizedUser] = useState<AuthorizedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAuthorizedUser(null);
      resetFamilyRoot();
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const userRef = ref(database, `authorizedUsers/${user.uid}`);

    const unsubscribe = onValue(
      userRef,
      async (snapshot) => {
        if (cancelled) return;

        if (!snapshot.exists()) {
          try {
            await registerAccessRequest({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            });
            // onValue will fire again when the node is created
            return;
          } catch (error) {
            console.error('Error al registrar solicitud de acceso:', error);
            if (!cancelled) {
              setAuthorizedUser(null);
              resetFamilyRoot();
              setLoading(false);
            }
            return;
          }
        }

        const data = snapshot.val() as AuthorizedUser;
        const normalized: AuthorizedUser = {
          uid: data.uid || user.uid,
          email: data.email || user.email || '',
          displayName: data.displayName || user.displayName || '',
          photoURL: data.photoURL || user.photoURL || '',
          autorizado: data.autorizado === true,
          familyRoot: (data.familyRoot || '').trim() || DEFAULT_FAMILY_ROOT,
          requestedAt: data.requestedAt || Date.now(),
          authorizedAt: data.authorizedAt,
          authorizedBy: data.authorizedBy,
        };

        if (cancelled) return;

        setAuthorizedUser(normalized);

        if (normalized.autorizado === true) {
          setFamilyRoot(normalized.familyRoot);
        } else {
          resetFamilyRoot();
        }

        setLoading(false);
      },
      (error) => {
        console.error('Error al escuchar autorización:', error);
        if (!cancelled) {
          setAuthorizedUser(null);
          resetFamilyRoot();
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, authLoading]);

  const isAuthorized = authorizedUser?.autorizado === true;

  return {
    user,
    authorizedUser,
    isAuthorized,
    familyRoot: isAuthorized
      ? authorizedUser?.familyRoot || DEFAULT_FAMILY_ROOT
      : DEFAULT_FAMILY_ROOT,
    loading: authLoading || loading,
  };
};
