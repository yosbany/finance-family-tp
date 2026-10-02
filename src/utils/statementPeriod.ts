/**
 * Rango válido de años para extractos financieros.
 * 
 * - Mínimo: 5 años atrás (es poco común tener extractos antiguos)
 * - Máximo: año actual + 1 (para adelantos de años nuevos)
 */
export const getValidStatementYearRange = (now: Date = new Date()): { min: number; max: number } => {
  const currentYear = now.getFullYear();
  return {
    min: currentYear - 5,
    max: currentYear + 1,
  };
};

/**
 * Valida si un mes y año son válidos para un extracto.
 * 
 * Criterios:
 * - month ∈ [1, 12]
 * - year ∈ [currentYear - 5, currentYear + 1]
 * 
 * Rechaza claramente:
 * - month = 0, 13, etc.
 * - year = 3735, 85, etc.
 */
export const isValidStatementPeriod = (
  month: number | null,
  year: number | null,
  now: Date = new Date()
): boolean => {
  if (!month || !year) return false;
  
  // Validar mes
  if (month < 1 || month > 12) return false;
  
  // Validar año
  const { min, max } = getValidStatementYearRange(now);
  if (year < min || year > max) return false;
  
  return true;
};

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
