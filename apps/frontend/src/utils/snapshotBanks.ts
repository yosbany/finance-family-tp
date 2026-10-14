/** Bancos cuyo extracto es un snapshot completo, no un mes cerrado. */
export const SNAPSHOT_BANKS = ['BHU', 'IBM'] as const;

export type SnapshotBank = (typeof SNAPSHOT_BANKS)[number];

export const isSnapshotBank = (bank: string): boolean =>
  SNAPSHOT_BANKS.includes(bank as SnapshotBank);

/** Mes 0 en historial = carga tipo snapshot (sin período mensual). */
export const SNAPSHOT_STATEMENT_MONTH = 0;
