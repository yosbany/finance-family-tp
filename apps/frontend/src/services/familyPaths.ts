export const DEFAULT_FAMILY_ROOT = 'family';

let activeFamilyRoot = DEFAULT_FAMILY_ROOT;

export const getFamilyRoot = (): string => activeFamilyRoot;

export const setFamilyRoot = (root: string): void => {
  activeFamilyRoot = root.trim() || DEFAULT_FAMILY_ROOT;
};

export const resetFamilyRoot = (): void => {
  activeFamilyRoot = DEFAULT_FAMILY_ROOT;
};

export const familyPath = (collection: string, id?: string): string => {
  const root = getFamilyRoot();
  return id ? `${root}/${collection}/${id}` : `${root}/${collection}`;
};

/** @deprecated Use getFamilyRoot() */
export const FAMILY_DATA_ROOT = DEFAULT_FAMILY_ROOT;
