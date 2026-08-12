/** Mes cerrado = el mes calendario anterior (extracto ya completo). */
export const getClosedStatementPeriod = (now: Date = new Date()): { month: number; year: number } => {
  const closed = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    month: closed.getMonth() + 1,
    year: closed.getFullYear(),
  };
};

/**
 * Meses cerrados del año en curso (ene … mes cerrado).
 * Si el mes cerrado cae en el año anterior (enero), la lista queda vacía.
 */
export const getClosedMonthsOfCurrentYear = (
  now: Date = new Date()
): Array<{ year: number; month: number; key: string }> => {
  const currentYear = now.getFullYear();
  const closed = getClosedStatementPeriod(now);
  if (closed.year !== currentYear) return [];

  const periods: Array<{ year: number; month: number; key: string }> = [];
  for (let month = 1; month <= closed.month; month++) {
    periods.push({
      year: currentYear,
      month,
      key: `${currentYear}-${String(month).padStart(2, '0')}`,
    });
  }
  return periods;
};
