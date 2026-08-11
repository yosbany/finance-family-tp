/**
 * Parsea montos en formatos comunes de extractos uruguayos.
 * Acepta número, "1234.56", "1.234,56", "$ 1.234,56", etc.
 * Devuelve null si no es un número válido.
 */
export const parseStatementAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  let cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/U\$S|USD|UYU|\$U/gi, '')
    .trim();

  if (!cleaned || cleaned === '-' || cleaned === '—') return null;

  // Formato latino: 1.234,56  o  1.234,56-
  const hasCommaDecimal = /,\d{1,2}$/.test(cleaned) || /,\d{1,2}-?$/.test(cleaned);
  if (hasCommaDecimal) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Quitar separadores de miles con coma: 1,234.56
    cleaned = cleaned.replace(/,/g, '');
  }

  cleaned = cleaned.replace(/(?!^)-/g, ''); // keep leading minus only
  const amount = parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : null;
};
