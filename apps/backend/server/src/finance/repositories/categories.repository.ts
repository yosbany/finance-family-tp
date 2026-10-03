/**
 * Categories Repository
 * 
 * Data access layer for categories with UID isolation.
 */

import { getDatabase } from '../../firebase/admin.js';
import { AuthenticatedContext } from '../../auth/authenticatedContext.js';

const DEFAULT_FAMILY_ROOT = 'family';

/**
 * Get the family root path for an authorized user
 */
async function getFamilyRootForUser(uid: string): Promise<string> {
  const db = getDatabase();
  const userAuthRef = db.ref(`authorizedUsers/${uid}`);
  const snapshot = await userAuthRef.once('value');

  if (!snapshot.exists()) {
    throw new Error('USER_NOT_AUTHORIZED');
  }

  const userData = snapshot.val();
  if (!userData.autorizado) {
    throw new Error('USER_NOT_AUTHORIZED');
  }

  return userData.familyRoot || DEFAULT_FAMILY_ROOT;
}

/**
 * Get all categories for a user
 * 
 * SECURITY: Always filtered by context.uid
 */
export async function getUserCategories(
  context: AuthenticatedContext
): Promise<any[]> {
  const familyRoot = await getFamilyRootForUser(context.uid);
  const db = getDatabase();
  const categoriesRef = db.ref(`${familyRoot}/categories`);
  const snapshot = await categoriesRef.once('value');

  if (!snapshot.exists()) {
    return [];
  }

  const categoriesData = snapshot.val();
  const categories = Object.entries(categoriesData).map(([catId, data]) => ({
    id: catId,
    ...(data as any),
  }));

  return categories;
}

export default {
  getUserCategories,
};
