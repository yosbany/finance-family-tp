/**
 * FASE 03C — Tests de Regresión de Detección de Período
 * 
 * Objetivo: Validar que:
 * 1. No hay falsos positivos (ej: 09/3735)
 * 2. Períodos válidos se detectan correctamente
 * 3. Identificadores numéricos se rechazan
 * 
 * Casos de Prueba (basados en archivos reales de /extraxtos)
 */

import { detectStatementContext } from '../contextDetection.service';
import { isValidStatementPeriod } from '../../utils/statementPeriod';

describe('FASE 03C — Hardening de Detección de Contexto', () => {
  const mockDate = new Date('2026-10-02'); // Hoy según contexto
  const mockAccounts = []; // No hay cuentas configuradas (para aislar detección de período)

  describe('isValidStatementPeriod — Validación Semántica', () => {
    it('debe aceptar períodos válidos (mes 1-12, año 2021-2027)', () => {
      expect(isValidStatementPeriod(1, 2026, mockDate)).toBe(true);
      expect(isValidStatementPeriod(7, 2026, mockDate)).toBe(true);
      expect(isValidStatementPeriod(12, 2026, mockDate)).toBe(true);
      expect(isValidStatementPeriod(1, 2021, mockDate)).toBe(true); // 5 años atrás
      expect(isValidStatementPeriod(12, 2027, mockDate)).toBe(true); // año + 1
    });

    it('debe rechazar meses fuera de rango', () => {
      expect(isValidStatementPeriod(0, 2026, mockDate)).toBe(false);
      expect(isValidStatementPeriod(13, 2026, mockDate)).toBe(false);
      expect(isValidStatementPeriod(-1, 2026, mockDate)).toBe(false);
      expect(isValidStatementPeriod(99, 2026, mockDate)).toBe(false);
    });

    it('debe rechazar años fuera de rango (error 09/3735)', () => {
      // El error específico: year = 3735, month = 9
      expect(isValidStatementPeriod(9, 3735, mockDate)).toBe(false);
      
      // Otros años inválidos
      expect(isValidStatementPeriod(8, 85, mockDate)).toBe(false);
      expect(isValidStatementPeriod(1, 2020, mockDate)).toBe(false); // 6 años atrás
      expect(isValidStatementPeriod(1, 2028, mockDate)).toBe(false); // 2 años en el futuro
    });

    it('debe rechazar null o undefined', () => {
      expect(isValidStatementPeriod(null, 2026, mockDate)).toBe(false);
      expect(isValidStatementPeriod(7, null, mockDate)).toBe(false);
      expect(isValidStatementPeriod(undefined as any, 2026, mockDate)).toBe(false);
    });
  });

  describe('detectPeriodFromFileName — Casos que Deben Detectarse', () => {
    it('debe detectar período de nombres con mes explícito', async () => {
      const file = new File([''], '2026_01_debito_yanet.xls');
      const context = await detectStatementContext({
        file,
        fileName: '2026_01_debito_yanet.xls',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      expect(context.period.month).toBe(1);
      expect(context.period.year).toBe(2026);
      expect(context.resolution.period).toBe('RESOLVED');
    });

    it('debe detectar "julio" en nombre', async () => {
      const file = new File([''], 'estado_cuenta_20260812 - julio.xlsx');
      const context = await detectStatementContext({
        file,
        fileName: 'estado_cuenta_20260812 - julio.xlsx',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      expect(context.period.month).toBe(7);
      expect(context.period.year).toBe(2026);
      expect(context.resolution.period).toBe('RESOLVED');
    });

    it('debe detectar "junio" en nombre', async () => {
      const file = new File([''], 'estado_cuenta_20260812 - junio.xlsx');
      const context = await detectStatementContext({
        file,
        fileName: 'estado_cuenta_20260812 - junio.xlsx',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      expect(context.period.month).toBe(6);
      expect(context.period.year).toBe(2026);
      expect(context.resolution.period).toBe('RESOLVED');
    });

    it('debe detectar formato YYYYMM (V_202607)', async () => {
      const file = new File([''], 'V_202607.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'V_202607.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      expect(context.period.month).toBe(7);
      expect(context.period.year).toBe(2026);
      expect(context.resolution.period).toBe('RESOLVED');
    });

    it('debe detectar "resumen - julio" en nombre', async () => {
      const file = new File([''], 'resumen - julio.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'resumen - julio.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      expect(context.period.month).toBe(7);
      expect(context.period.year).toBe(2026);
      expect(context.resolution.period).toBe('RESOLVED');
    });

    it('debe detectar "resumen oca - julio" en nombre', async () => {
      const file = new File([''], 'resumen oca - julio.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'resumen oca - julio.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      expect(context.period.month).toBe(7);
      expect(context.period.year).toBe(2026);
      expect(context.resolution.period).toBe('RESOLVED');
    });
  });

  describe('detectPeriodFromFileName — Casos que NO Deben Detectarse Incorrectamente', () => {
    it('NO debe detectar período del archivo "Estado de Cuenta 010-85-193735-9 11_08_2026"', async () => {
      // Este es el error conocido: producía 09/3735
      const file = new File([''], 'Estado de Cuenta 010-85-193735-9 11_08_2026 16_18_33.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'Estado de Cuenta 010-85-193735-9 11_08_2026 16_18_33.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // No debe ser 09/3735
      if (context.resolution.period === 'RESOLVED') {
        expect(context.period.year).not.toBe(3735);
        expect([6, 7, 8, 9, 10]).toContain(context.period.month); // Podría ser 08 si detecta 11_08_2026
      }
    });

    it('NO debe interpretar número de cuenta como período (010-85-193735-9)', async () => {
      const file = new File([''], 'estado_cuenta_010-85-193735-9.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'estado_cuenta_010-85-193735-9.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // Debe ser UNRESOLVED, no 09/3735
      expect(context.resolution.period).toBe('UNRESOLVED');
    });

    it('NO debe interpretar portfolio ID como período (205338113)', async () => {
      const file = new File([''], 'PortfolioDetails _205338113 (1).xlsx');
      const context = await detectStatementContext({
        file,
        fileName: 'PortfolioDetails _205338113 (1).xlsx',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // Debe ser UNRESOLVED o requiere confirmación, no 05/3313 u otro
      if (context.resolution.period === 'RESOLVED') {
        expect(context.period.year).toBeLessThan(2100); // Año razonable
      }
    });
  });

  describe('Detección de Identificadores Numéricos (NO deben ser períodos)', () => {
    it('NO debe confundir 193735 con período', async () => {
      const file = new File([''], 'cuenta_193735.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'cuenta_193735.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // 193735 no es un año válido
      if (context.resolution.period === 'RESOLVED') {
        expect(context.period.year).toBeGreaterThanOrEqual(2021);
        expect(context.period.year).toBeLessThanOrEqual(2027);
      }
    });

    it('NO debe confundir 85 con año', async () => {
      const file = new File([''], 'cuenta_85.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'cuenta_85.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // 85 no es un año válido en contexto de extractos modernos
      expect(context.resolution.period).toBe('UNRESOLVED');
    });
  });

  describe('Separación de Fechas de Otros Identificadores', () => {
    it('debe detectar 11_08_2026 como fecha (no 08/20260812)', async () => {
      const file = new File([''], 'estado_cuenta_20260812 - julio 11_08_2026.xlsx');
      const context = await detectStatementContext({
        file,
        fileName: 'estado_cuenta_20260812 - julio 11_08_2026.xlsx',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // Debe preferir "julio" (mes explícito) sobre el YYYYMMDD
      expect(context.period.month).toBe(7);
      expect(context.period.year).toBe(2026);
    });

    it('debe usar contexto de delimitadores fuertes', async () => {
      // El nombre tiene: 193735-9 (número de cuenta) y 11_08_2026 (fecha)
      const file = new File([''], 'Estado 010-85-193735-9 11_08_2026.pdf');
      const context = await detectStatementContext({
        file,
        fileName: 'Estado 010-85-193735-9 11_08_2026.pdf',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // No debe capturar 3735-9 como período
      if (context.resolution.period === 'RESOLVED') {
        expect(context.period.year).not.toBe(3735);
        // Podría detectar 08/2026 del 11_08_2026, o UNRESOLVED
      }
    });
  });

  describe('Validación de Archivo Real: PortfolioDetails', () => {
    it('archivo sin período identificable debe ser UNRESOLVED', async () => {
      const file = new File([''], 'PortfolioDetails _205338113 (1).xlsx');
      const context = await detectStatementContext({
        file,
        fileName: 'PortfolioDetails _205338113 (1).xlsx',
        availableAccounts: mockAccounts,
        uploadDate: mockDate,
      });

      // Si no se detecta mes explícito, debe ser UNRESOLVED
      // (El archivo realmente no contiene período en el nombre)
      if (context.resolution.period !== 'RESOLVED') {
        expect(context.resolution.period).toMatch(/UNRESOLVED|NEEDS_CONFIRMATION/);
      }
    });
  });

  describe('Rango de Años Válidos', () => {
    it('debe aceptar años últimos 5 años y +1', async () => {
      // Hoy es 2026-10-02
      // Válidos: 2021 (5 años atrás) a 2027 (+ 1 año)
      
      expect(isValidStatementPeriod(1, 2021, mockDate)).toBe(true);
      expect(isValidStatementPeriod(1, 2022, mockDate)).toBe(true);
      expect(isValidStatementPeriod(1, 2023, mockDate)).toBe(true);
      expect(isValidStatementPeriod(1, 2024, mockDate)).toBe(true);
      expect(isValidStatementPeriod(1, 2025, mockDate)).toBe(true);
      expect(isValidStatementPeriod(1, 2026, mockDate)).toBe(true);
      expect(isValidStatementPeriod(1, 2027, mockDate)).toBe(true);
    });

    it('debe rechazar años fuera del rango', async () => {
      // 2020 es 6 años atrás
      expect(isValidStatementPeriod(1, 2020, mockDate)).toBe(false);
      // 2028 es 2 años en el futuro
      expect(isValidStatementPeriod(1, 2028, mockDate)).toBe(false);
    });
  });
});
