/**
 * Servicio de Detección de Contexto para Importación Automática
 * 
 * Responsabilidades:
 * - Detectar banco desde contenido del archivo
 * - Detectar período desde nombre y contenido
 * - Detectar moneda desde configuración de cuenta
 * - Identificar cuenta específica mediante metadata disponible
 * - Clasificar cada detección con nivel de confianza
 * 
 * Estrategia:
 * - NO inventar valores sin evidencia
 * - Usar información existente (cuentas configuradas)
 * - Distinguir entre RESOLVED, NEEDS_CONFIRMATION, UNRESOLVED
 */

import { Account, Currency } from '../types';
import { detectBank } from '../parsers/banks';
import { isValidStatementPeriod } from '../utils/statementPeriod';

/**
 * Estados posibles de resolución
 */
export type ResolutionStatus = 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';

/**
 * Contexto detectado del extracto
 */
export interface DetectedStatementContext {
  // Datos detectados
  bank: string | null;
  accountNumber: string | null;
  accountType: 'debit' | 'credit' | 'investment' | null;
  currency: Currency | null;
  
  // Período
  period: {
    month: number | null;
    year: number | null;
  };
  
  // Resolución de cada campo
  resolution: {
    bank: ResolutionStatus;
    account: ResolutionStatus;
    currency: ResolutionStatus;
    period: ResolutionStatus;
  };
  
  // Evidencia y confianza
  confidence: number; // 0-1
  unresolvedFields: string[];
  warnings: string[];
  evidence: {
    bank?: string;
    period?: string;
    account?: string;
    currency?: string;
  };
}

/**
 * Detecta período desde el nombre del archivo
 * 
 * Estrategia de prioridad:
 * 1. Nombres de mes explícitos (julio, junio, etc.) — PRIORIDAD 1
 * 2. Patrones numéricos bien delimitados (YYYY-MM, YYYYMMDD, etc.) — PRIORIDAD 2-4
 * 3. Validación semántica: rechazar años inválidos — APLICAR A TODOS
 * 
 * NO aceptar candidatos que no pasen validación semántica.
 * Ante duda → UNRESOLVED.
 */
const detectPeriodFromFileName = (
  fileName: string,
  uploadDate: Date = new Date()
): { month: number | null; year: number | null; evidence: string } => {
  const lowerName = fileName.toLowerCase();
  
  // PRIORIDAD 1: Buscar meses explícitos (julio, junio, etc.)
  const monthNames: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  
  for (const [monthName, monthNum] of Object.entries(monthNames)) {
    if (lowerName.includes(monthName)) {
      // Buscar año cercano
      const yearMatch = lowerName.match(/20\d{2}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : uploadDate.getFullYear();
      
      // Validar semánticamente
      if (isValidStatementPeriod(monthNum, year, uploadDate)) {
        return { month: monthNum, year, evidence: `Month name "${monthName}" + year ${year}` };
      }
    }
  }
  
  // PRIORIDAD 2-4: Patrones numéricos
  // Patrones: 2026_01, 202601, V_202607, 07_2026, estado_cuenta_20260812
  // 
  // IMPORTANTE: Usar delimitadores más fuertes para evitar capturar
  // números de cuenta como "010-85-193735-9"
  
  const patterns = [
    {
      // YYYY-MM format: 2026_01, 2026-01
      // Requiere: separador antes del primer dígito (inicio o carácter no numérico)
      regex: /(?:^|[^0-9])(\d{4})[-_](\d{1,2})(?:[^0-9]|$)/,
      parser: (m: RegExpMatchArray) => ({ month: parseInt(m[2]), year: parseInt(m[1]) }),
      desc: 'YYYY-MM format',
    },
    {
      // MM-YYYY format: 07_2026, 07-2026
      // Requiere: separador, exactamente 4 dígitos para año
      regex: /(?:^|[^0-9])(\d{1,2})[-_](\d{4})(?:[^0-9]|$)/,
      parser: (m: RegExpMatchArray) => ({ month: parseInt(m[1]), year: parseInt(m[2]) }),
      desc: 'MM-YYYY format',
    },
    {
      // YYYYMM format: 202607, V_202607
      // Requiere: carácter no numérico antes (letra o guion) + exactamente 6 dígitos
      regex: /[a-zA-Z_](\d{6})(?:[^0-9]|$)/,
      parser: (m: RegExpMatchArray) => {
        const d = m[1];
        return { month: parseInt(d.substring(4, 6)), year: parseInt(d.substring(0, 4)) };
      },
      desc: 'YYYYMM format (e.g., V_202607)',
    },
    {
      // YYYYMMDD format: 20260812 (solo si está entre espacios o inicio/fin)
      // Requiere: límite de palabra real (no dentro de número de cuenta)
      regex: /(?:^|\s)(\d{8})(?:\s|$)/,
      parser: (m: RegExpMatchArray) => {
        const d = m[1];
        return { month: parseInt(d.substring(4, 6)), year: parseInt(d.substring(0, 4)) };
      },
      desc: 'YYYYMMDD format',
    },
  ];
  
  for (const { regex, parser, desc } of patterns) {
    const match = lowerName.match(regex);
    if (match) {
      const result = parser(match);
      
      // VALIDACIÓN SEMÁNTICA: rechazar si no es válido
      if (isValidStatementPeriod(result.month, result.year, uploadDate)) {
        return { ...result, evidence: desc };
      }
    }
  }
  
  return { month: null, year: null, evidence: '' };
};

/**
 * Detecta período desde metadatos del archivo y fecha actual
 */
const detectPeriodFromMetadata = (fileName: string, uploadDate: Date = new Date()): { month: number | null; year: number | null; evidence: string } => {
  // Si el archivo contiene año actual, asumir mes anterior cerrado
  const currentYear = uploadDate.getFullYear();
  const currentMonth = uploadDate.getMonth() + 1;
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  if (fileName.includes(String(currentYear))) {
    return { month: previousMonth, year: previousMonthYear, evidence: 'Current year in filename + closed month heuristic' };
  }
  
  return { month: null, year: null, evidence: '' };
};

/**
 * Detecta número de cuenta desde el contenido del archivo
 */
const detectAccountNumber = (content: string): { number: string | null; evidence: string } => {
  // Patrones para números de cuenta (normalmente 5-20 dígitos o formatos específicos)
  // Ejemplos: "010-85-193735-9", "1234567890", etc.
  
  const patterns = [
    /Cuenta[:\s]+(\d{3}-\d{2}-\d{6}-\d)/i, // BROU format
    /Número de cuenta[:\s]+([0-9-]+)/i,
    /Account[:\s]+([0-9-]+)/i,
    /\b\d{3}-\d{2}-\d{6}-\d\b/, // BROU specifico
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return { number: match[1].trim(), evidence: 'Account number pattern match' };
    }
  }
  
  return { number: null, evidence: '' };
};

/**
 * Detecta banco desde contenido
 */
const detectBankFromContent = (content: string): { bank: string | null; evidence: string } => {
  const detected = detectBank(content);
  if (detected) {
    return { bank: detected, evidence: 'Content analysis' };
  }
  return { bank: null, evidence: '' };
};

/**
 * Resuelve cuenta específica desde banco + tipo + moneda + metadata disponible
 */
const resolveAccount = (
  options: {
    bank: string | null;
    accountType: 'debit' | 'credit' | 'investment' | null;
    currency: Currency | null;
    accountNumber: string | null;
    availableAccounts: Account[];
  }
): { account: Account | null; resolution: ResolutionStatus; evidence: string } => {
  const { bank, accountType, currency, accountNumber, availableAccounts } = options;
  
  if (!bank) {
    return { account: null, resolution: 'UNRESOLVED', evidence: 'Bank not detected' };
  }
  
  // Filtrar por banco
  let candidates = availableAccounts.filter(a => a.bank === bank);
  
  if (candidates.length === 0) {
    return { account: null, resolution: 'UNRESOLVED', evidence: `No accounts for bank ${bank}` };
  }
  
  // Filtrar por moneda si se detectó
  if (currency) {
    const byCurrency = candidates.filter(a => a.currency === currency);
    if (byCurrency.length > 0) {
      candidates = byCurrency;
    }
  }
  
  // Filtrar por tipo si se detectó
  if (accountType) {
    const byType = candidates.filter(a => a.type === accountType);
    if (byType.length > 0) {
      candidates = byType;
    }
  }
  
  // Si hay número de cuenta, intentar matchear
  if (accountNumber && accountNumber.trim()) {
    const byNumber = candidates.filter(a => 
      a.name.includes(accountNumber) || accountNumber.includes(a.name)
    );
    if (byNumber.length > 0) {
      candidates = byNumber;
    }
  }
  
  // Resolver según cantidad de candidatos
  if (candidates.length === 1) {
    return {
      account: candidates[0],
      resolution: 'RESOLVED',
      evidence: `Unique match: ${bank} / ${accountType || 'any'} / ${currency || 'any'}`
    };
  }
  
  if (candidates.length > 1) {
    return {
      account: null,
      resolution: 'NEEDS_CONFIRMATION',
      evidence: `${candidates.length} possible accounts match the criteria`
    };
  }
  
  return {
    account: null,
    resolution: 'UNRESOLVED',
    evidence: 'No matching accounts'
  };
};

/**
 * Lee contenido de archivo según su tipo
 * 
 * Soporta:
 * - CSV: texto directo
 * - Excel (.xlsx/.xls): lee primeras filas como texto
 * - PDF: extrae texto usando PDF.js
 */
const readFileContentByType = async (file: File): Promise<string> => {
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileName.endsWith('.csv')) {
      return await file.text();
    }
    
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Leer Excel y extraer texto de las primeras filas
      const { default: XLSX } = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      
      if (!firstSheetName) {
        return '';
      }
      
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      // Convertir primeras 50 filas a texto
      const text = jsonData
        .slice(0, 50)
        .map((row: any) => (Array.isArray(row) ? row.join(' ') : String(row)))
        .join('\n');
      
      return text;
    }
    
    if (fileName.endsWith('.pdf')) {
      // Extraer texto del PDF usando pdfjs-dist
      const { default: pdfjsLib } = await import('pdfjs-dist');
      
      // Configurar worker si es necesario (en navegador ya está disponible)
      if (typeof window === 'undefined') {
        // En Node.js/servidor, configurar worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const numPages = Math.min(pdf.numPages, 10); // Limitar a primeras 10 páginas
      
      for (let i = 1; i <= numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        } catch (pageError) {
          // Continuar con siguiente página si hay error
          console.warn(`Error extrayendo página ${i} del PDF:`, pageError);
        }
      }
      
      return fullText;
    }
  } catch (error: any) {
    console.warn(`Error reading file content: ${error?.message}`);
    return '';
  }
  
  return '';
};

/**
 * Principal: Detectar todo el contexto del extracto
 * 
 * Parámetros:
 * - file: El archivo a analizar
 * - fileName: Nombre del archivo (para detectar período, banco, etc.)
 * - fileContent: Contenido del archivo (si ya está leído)
 * - availableAccounts: Lista de cuentas configuradas (para resolver cuenta específica)
 * - uploadDate: Fecha de carga (para inferencias de período)
 * - currentAccountId: (Opcional) ID de la cuenta actualmente seleccionada en UI
 */
export const detectStatementContext = async (options: {
  file: File;
  fileName: string;
  fileContent?: string;
  availableAccounts: Account[];
  uploadDate?: Date;
  currentAccountId?: string;
}): Promise<DetectedStatementContext> => {
  const { file, fileName, fileContent, availableAccounts, uploadDate = new Date(), currentAccountId } = options;
  
  const context: DetectedStatementContext = {
    bank: null,
    accountNumber: null,
    accountType: null,
    currency: null,
    period: { month: null, year: null },
    resolution: {
      bank: 'UNRESOLVED',
      account: 'UNRESOLVED',
      currency: 'UNRESOLVED',
      period: 'UNRESOLVED',
    },
    confidence: 0,
    unresolvedFields: [],
    warnings: [],
    evidence: {},
  };
  
  try {
    // 1. Detectar período desde nombre de archivo (con validación semántica)
    const periodFromName = detectPeriodFromFileName(fileName, uploadDate);
    if (periodFromName.month && periodFromName.year) {
      context.period = { month: periodFromName.month, year: periodFromName.year };
      context.resolution.period = 'RESOLVED';
      context.evidence.period = periodFromName.evidence;
    } else {
      // 2. Fallback: detectar desde metadatos si el año aparece
      const periodFromMeta = detectPeriodFromMetadata(fileName, uploadDate);
      if (periodFromMeta.month && periodFromMeta.year) {
        context.period = { month: periodFromMeta.month, year: periodFromMeta.year };
        context.resolution.period = 'NEEDS_CONFIRMATION'; // Menos confiable
        context.evidence.period = periodFromMeta.evidence;
        context.warnings.push('Period inferred from current year + closed month heuristic. Verify manually.');
      }
    }
    
    // 3. Detectar banco desde contenido — AHORA LEE ARCHIVOS BINARIOS
    let contentToAnalyze = fileContent || '';
    
    if (!contentToAnalyze) {
      // Si no se proporciona contenido, intentar leerlo según tipo de archivo
      contentToAnalyze = await readFileContentByType(file);
    }
    
    if (contentToAnalyze) {
      const bankDetection = detectBankFromContent(contentToAnalyze);
      if (bankDetection.bank) {
        context.bank = bankDetection.bank;
        context.resolution.bank = 'RESOLVED';
        context.evidence.bank = bankDetection.evidence;
      }
      
      // 4. Detectar número de cuenta
      const accountNum = detectAccountNumber(contentToAnalyze);
      if (accountNum.number) {
        context.accountNumber = accountNum.number;
        context.evidence.account = accountNum.evidence;
      }
    } else {
      context.warnings.push('No content could be extracted from file for bank detection.');
    }
    
    // 5. Intentar resolver cuenta específica
    if (context.bank || availableAccounts.length > 0) {
      // Filtrar cuentas compatibles
      let filterCandidates = availableAccounts;
      
      // Si se proporciona cuenta actual, usar eso como referencia primaria
      if (currentAccountId) {
        const currentAccount = availableAccounts.find(a => a.id === currentAccountId);
        if (currentAccount) {
          filterCandidates = [currentAccount];
        }
      }
      
      const accountResolution = resolveAccount({
        bank: context.bank,
        accountType: context.accountType,
        currency: context.currency,
        accountNumber: context.accountNumber,
        availableAccounts: filterCandidates,
      });
      
      // Copiar información de la cuenta resuelta
      if (accountResolution.account) {
        context.accountType = accountResolution.account.type;
        context.currency = accountResolution.account.currency;
        context.resolution.account = accountResolution.resolution;
        context.resolution.currency = 'RESOLVED';
        context.evidence.account = accountResolution.evidence;
        context.evidence.currency = `From account: ${accountResolution.account.currency}`;
      } else {
        context.resolution.account = accountResolution.resolution;
        if (accountResolution.resolution === 'UNRESOLVED') {
          context.evidence.account = accountResolution.evidence;
        }
      }
    }
    
    // 6. Calcular confianza general
    const resolvedCount = Object.values(context.resolution).filter(s => s === 'RESOLVED').length;
    const totalFields = Object.keys(context.resolution).length;
    context.confidence = resolvedCount / totalFields;
    
    // 7. Identificar campos no resueltos
    context.unresolvedFields = Object.entries(context.resolution)
      .filter(([_, status]) => status !== 'RESOLVED')
      .map(([field, status]) => `${field}: ${status}`);
    
  } catch (error: any) {
    context.warnings.push(`Error during context detection: ${error?.message || 'Unknown error'}`);
  }
  
  return context;
};

/**
 * Genera un reporte legible del contexto detectado
 */
export const formatContextReport = (context: DetectedStatementContext): string => {
  const lines: string[] = [];
  
  lines.push('=== CONTEXT DETECTION REPORT ===\n');
  
  // Bank
  lines.push(`Bank:       ${context.bank || '?'} (${context.resolution.bank})`);
  if (context.evidence.bank) lines.push(`  Evidence: ${context.evidence.bank}`);
  
  // Account
  if (context.accountNumber) {
    lines.push(`Account #:  ${context.accountNumber}`);
  }
  lines.push(`Type/Curr:  ${context.accountType || '?'} / ${context.currency || '?'} (${context.resolution.account}, ${context.resolution.currency})`);
  if (context.evidence.account) lines.push(`  Evidence: ${context.evidence.account}`);
  
  // Period
  const periodStr = context.period.month && context.period.year
    ? `${String(context.period.month).padStart(2, '0')}/${context.period.year}`
    : '?/?';
  lines.push(`Period:     ${periodStr} (${context.resolution.period})`);
  if (context.evidence.period) lines.push(`  Evidence: ${context.evidence.period}`);
  
  // Confidence
  lines.push(`\nConfidence: ${(context.confidence * 100).toFixed(0)}%`);
  
  // Warnings
  if (context.warnings.length > 0) {
    lines.push('\nWarnings:');
    context.warnings.forEach(w => lines.push(`  ⚠️  ${w}`));
  }
  
  // Unresolved fields
  if (context.unresolvedFields.length > 0) {
    lines.push('\nUnresolved:');
    context.unresolvedFields.forEach(f => lines.push(`  ⚠️  ${f}`));
  }
  
  return lines.join('\n');
};
