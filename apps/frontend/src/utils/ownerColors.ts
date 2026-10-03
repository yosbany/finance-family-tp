import { Owner } from '../services/owners.service';

export type OwnerColorKey = 'blue' | 'pink' | 'purple' | 'green' | 'yellow' | 'red' | 'gray';

const BADGE_CLASSES: Record<OwnerColorKey, string> = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const CARD_CLASSES: Record<OwnerColorKey, string> = {
  blue: 'border-blue-300 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-900/15 hover:border-blue-400 dark:hover:border-blue-500',
  pink: 'border-pink-300 dark:border-pink-700 bg-pink-50/70 dark:bg-pink-900/15 hover:border-pink-400 dark:hover:border-pink-500',
  purple: 'border-purple-300 dark:border-purple-700 bg-purple-50/70 dark:bg-purple-900/15 hover:border-purple-400 dark:hover:border-purple-500',
  green: 'border-green-300 dark:border-green-700 bg-green-50/70 dark:bg-green-900/15 hover:border-green-400 dark:hover:border-green-500',
  yellow: 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/70 dark:bg-yellow-900/15 hover:border-yellow-400 dark:hover:border-yellow-500',
  red: 'border-red-300 dark:border-red-700 bg-red-50/70 dark:bg-red-900/15 hover:border-red-400 dark:hover:border-red-500',
  gray: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600',
};

const isColorKey = (value: string): value is OwnerColorKey =>
  value in BADGE_CLASSES;

export const resolveOwnerColorKey = (ownerName: string, owners?: Owner[]): OwnerColorKey => {
  if (owners?.length) {
    const owner = owners.find(o => o.name === ownerName);
    if (owner?.color && isColorKey(owner.color)) {
      return owner.color;
    }
  }

  const lower = ownerName.toLowerCase();
  if (lower.includes('yosba') || lower.includes('yosb')) return 'blue';
  if (lower.includes('yane')) return 'pink';
  if (lower.includes('nucleo') || lower.includes('núcleo') || lower.includes('ambos') || lower.includes('familia')) {
    return 'purple';
  }
  return 'gray';
};

export const getOwnerBadgeClasses = (ownerName: string, owners?: Owner[]): string =>
  BADGE_CLASSES[resolveOwnerColorKey(ownerName, owners)];

export const getOwnerCardClasses = (ownerName: string, owners?: Owner[]): string =>
  CARD_CLASSES[resolveOwnerColorKey(ownerName, owners)];
