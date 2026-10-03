import { ref, get, set, update } from 'firebase/database';
import { database } from './firebase';
import { DEFAULT_FAMILY_ROOT } from './familyPaths';

export interface AuthorizedUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  autorizado: boolean;
  familyRoot: string;
  requestedAt: number;
  authorizedAt?: number;
  authorizedBy?: string;
}

const normalizeAuthorizedUser = (data: Partial<AuthorizedUser> & { uid: string }): AuthorizedUser => ({
  uid: data.uid,
  email: data.email || '',
  displayName: data.displayName || '',
  photoURL: data.photoURL || '',
  autorizado: data.autorizado === true,
  familyRoot: (data.familyRoot || '').trim() || DEFAULT_FAMILY_ROOT,
  requestedAt: data.requestedAt || Date.now(),
  authorizedAt: data.authorizedAt,
  authorizedBy: data.authorizedBy,
});

export const getAuthorizedUser = async (uid: string): Promise<AuthorizedUser | null> => {
  const snapshot = await get(ref(database, `authorizedUsers/${uid}`));
  if (!snapshot.exists()) return null;
  return normalizeAuthorizedUser({ ...(snapshot.val() as AuthorizedUser), uid });
};

export const isUserAuthorized = async (uid: string): Promise<boolean> => {
  const user = await getAuthorizedUser(uid);
  return user?.autorizado === true;
};

export const registerAccessRequest = async (firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}): Promise<AuthorizedUser> => {
  const userRef = ref(database, `authorizedUsers/${firebaseUser.uid}`);
  const snapshot = await get(userRef);

  if (snapshot.exists()) {
    const raw = snapshot.val() as AuthorizedUser;
    const existing = normalizeAuthorizedUser({ ...raw, uid: firebaseUser.uid });

    // Already approved: never rewrite authorization fields from the client
    if (existing.autorizado) {
      return existing;
    }

    const updates: Partial<AuthorizedUser> = {
      email: firebaseUser.email || existing.email,
      displayName: firebaseUser.displayName || existing.displayName,
      photoURL: firebaseUser.photoURL || existing.photoURL || '',
      autorizado: false,
      familyRoot: existing.familyRoot || DEFAULT_FAMILY_ROOT,
    };

    await update(userRef, updates);
    return normalizeAuthorizedUser({ ...existing, ...updates });
  }

  const pending: AuthorizedUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
    photoURL: firebaseUser.photoURL || '',
    autorizado: false,
    familyRoot: DEFAULT_FAMILY_ROOT,
    requestedAt: Date.now(),
  };

  await set(userRef, pending);
  return pending;
};

export const getAllAuthorizedUsers = async (): Promise<AuthorizedUser[]> => {
  const snapshot = await get(ref(database, 'authorizedUsers'));
  if (!snapshot.exists()) return [];

  const data = snapshot.val() as Record<string, AuthorizedUser>;
  return Object.entries(data)
    .map(([uid, user]) => normalizeAuthorizedUser({ ...user, uid }))
    .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
};

export const getPendingUsers = async (): Promise<AuthorizedUser[]> => {
  const users = await getAllAuthorizedUsers();
  return users.filter(u => !u.autorizado);
};

export const approveUser = async (
  targetUid: string,
  approver: { uid: string; familyRoot: string }
): Promise<void> => {
  const targetRef = ref(database, `authorizedUsers/${targetUid}`);
  const snapshot = await get(targetRef);

  if (!snapshot.exists()) {
    throw new Error('Usuario no encontrado');
  }

  const familyRoot = (approver.familyRoot || '').trim() || DEFAULT_FAMILY_ROOT;

  await update(targetRef, {
    autorizado: true,
    familyRoot,
    authorizedAt: Date.now(),
    authorizedBy: approver.uid,
  });
};

export const updateMemberFamily = async (
  targetUid: string,
  familyRoot: string,
  updaterUid: string
): Promise<void> => {
  const targetRef = ref(database, `authorizedUsers/${targetUid}`);
  const snapshot = await get(targetRef);

  if (!snapshot.exists()) {
    throw new Error('Usuario no encontrado');
  }

  const root = familyRoot.trim() || DEFAULT_FAMILY_ROOT;

  await update(targetRef, {
    familyRoot: root,
    authorizedBy: updaterUid,
    authorizedAt: Date.now(),
    autorizado: true,
  });
};

export const revokeUserAccess = async (targetUid: string): Promise<void> => {
  const targetRef = ref(database, `authorizedUsers/${targetUid}`);
  const snapshot = await get(targetRef);

  if (!snapshot.exists()) {
    throw new Error('Usuario no encontrado');
  }

  await update(targetRef, {
    autorizado: false,
    familyRoot: DEFAULT_FAMILY_ROOT,
    authorizedAt: null,
    authorizedBy: null,
  });
};

export const getKnownFamilyRoots = (members: AuthorizedUser[], currentFamilyRoot: string): string[] => {
  const roots = new Set<string>([DEFAULT_FAMILY_ROOT, currentFamilyRoot]);
  members.forEach(member => {
    if (member.familyRoot) roots.add(member.familyRoot);
  });
  return Array.from(roots).sort();
};
