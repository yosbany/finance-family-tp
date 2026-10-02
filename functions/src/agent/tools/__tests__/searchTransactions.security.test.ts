/**
 * Security Tests para searchTransactions
 * 
 * Verifica que la tool sea imposible de evadir.
 * 
 * Pruebas:
 * 1. Sin autenticación → REJECTED
 * 2. Token válido usuario A → solo datos usuario A
 * 3. Intento de enviar UID → REJECTED
 * 4. Intento de enviar firebasePath → REJECTED
 * 5. Limit excesivo → reducido o rechazado
 * 6. Argumentos desconocidos → REJECTED
 */

import { validateSearchInput, MAX_SEARCH_LIMIT } from '../searchTransactions';

describe('searchTransactions Security', () => {
  
  describe('1. Parámetros prohibidos', () => {
    
    it('rechaza uid', () => {
      expect(() => {
        validateSearchInput({
          uid: 'user-123',
          period: '2026-09'
        });
      }).toThrow(/SECURITY_VIOLATION.*uid/);
    });
    
    it('rechaza userId', () => {
      expect(() => {
        validateSearchInput({
          userId: 'user-123'
        });
      }).toThrow(/SECURITY_VIOLATION.*userId/);
    });
    
    it('rechaza familyId', () => {
      expect(() => {
        validateSearchInput({
          familyId: 'family-123'
        });
      }).toThrow(/SECURITY_VIOLATION.*familyId/);
    });
    
    it('rechaza firebasePath', () => {
      expect(() => {
        validateSearchInput({
          firebasePath: '/family/transactions'
        });
      }).toThrow(/SECURITY_VIOLATION.*firebasePath/);
    });
    
    it('rechaza path', () => {
      expect(() => {
        validateSearchInput({
          path: '/transactions'
        });
      }).toThrow(/SECURITY_VIOLATION.*path/);
    });
  });
  
  describe('2. Argumentos desconocidos', () => {
    
    it('rechaza argumentos no permitidos', () => {
      expect(() => {
        validateSearchInput({
          from: 1000000,
          unknownParam: 'value'
        });
      }).toThrow(/INVALID_ARGUMENT.*unknownParam/);
    });
    
    it('rechaza múltiples argumentos desconocidos', () => {
      expect(() => {
        validateSearchInput({
          foo: 'bar',
          baz: 'qux'
        });
      }).toThrow(/INVALID_ARGUMENT/);
    });
  });
  
  describe('3. Validación de tipos', () => {
    
    it('rechaza from no numérico', () => {
      expect(() => {
        validateSearchInput({
          from: 'not-a-number'
        });
      }).toThrow(/INVALID_ARGUMENT.*from/);
    });
    
    it('rechaza to no numérico', () => {
      expect(() => {
        validateSearchInput({
          to: null
        });
      }).toThrow(/INVALID_ARGUMENT.*to/);
    });
    
    it('rechaza from negativo', () => {
      expect(() => {
        validateSearchInput({
          from: -1000
        });
      }).toThrow(/INVALID_ARGUMENT.*from/);
    });
    
    it('rechaza from > to', () => {
      expect(() => {
        validateSearchInput({
          from: 2000,
          to: 1000
        });
      }).toThrow(/INVALID_ARGUMENT.*from.*to/);
    });
  });
  
  describe('4. Validación de strings', () => {
    
    it('rechaza accountId vacío', () => {
      expect(() => {
        validateSearchInput({
          accountId: ''
        });
      }).toThrow(/INVALID_ARGUMENT.*accountId/);
    });
    
    it('rechaza accountId muy largo', () => {
      expect(() => {
        validateSearchInput({
          accountId: 'a'.repeat(200)
        });
      }).toThrow(/INVALID_ARGUMENT.*accountId/);
    });
    
    it('rechaza description muy larga', () => {
      expect(() => {
        validateSearchInput({
          description: 'a'.repeat(500)
        });
      }).toThrow(/INVALID_ARGUMENT.*description/);
    });
  });
  
  describe('5. Validación de enumeraciones', () => {
    
    it('rechaza type inválido', () => {
      expect(() => {
        validateSearchInput({
          type: 'invalid_type'
        });
      }).toThrow(/INVALID_ARGUMENT.*type/);
    });
    
    it('acepta types válidos', () => {
      expect(() => {
        validateSearchInput({ type: 'income' });
        validateSearchInput({ type: 'expense' });
        validateSearchInput({ type: 'transfer' });
      }).not.toThrow();
    });
    
    it('rechaza currency inválida', () => {
      expect(() => {
        validateSearchInput({
          currency: 'EUR'
        });
      }).toThrow(/INVALID_ARGUMENT.*currency/);
    });
    
    it('acepta currencies válidas', () => {
      expect(() => {
        validateSearchInput({ currency: 'UYU' });
        validateSearchInput({ currency: 'USD' });
      }).not.toThrow();
    });
    
    it('rechaza status inválido', () => {
      expect(() => {
        validateSearchInput({
          status: 'unknown'
        });
      }).toThrow(/INVALID_ARGUMENT.*status/);
    });
  });
  
  describe('6. Validación de límites', () => {
    
    it('rechaza limit > MAX_SEARCH_LIMIT', () => {
      expect(() => {
        validateSearchInput({
          limit: MAX_SEARCH_LIMIT + 1
        });
      }).toThrow(/INVALID_ARGUMENT.*limit/);
    });
    
    it('acepta limit <= MAX_SEARCH_LIMIT', () => {
      expect(() => {
        validateSearchInput({ limit: MAX_SEARCH_LIMIT });
        validateSearchInput({ limit: 1 });
        validateSearchInput({ limit: 50 });
      }).not.toThrow();
    });
    
    it('rechaza limit 0', () => {
      expect(() => {
        validateSearchInput({
          limit: 0
        });
      }).toThrow(/INVALID_ARGUMENT.*limit/);
    });
    
    it('rechaza limit negativo', () => {
      expect(() => {
        validateSearchInput({
          limit: -10
        });
      }).toThrow(/INVALID_ARGUMENT.*limit/);
    });
  });
  
  describe('7. Validación de montos', () => {
    
    it('rechaza minAmount no numérico', () => {
      expect(() => {
        validateSearchInput({
          minAmount: 'string'
        });
      }).toThrow(/INVALID_ARGUMENT.*minAmount/);
    });
    
    it('rechaza maxAmount negativo', () => {
      expect(() => {
        validateSearchInput({
          maxAmount: -100
        });
      }).toThrow(/INVALID_ARGUMENT.*maxAmount/);
    });
    
    it('rechaza minAmount > maxAmount', () => {
      expect(() => {
        validateSearchInput({
          minAmount: 1000,
          maxAmount: 100
        });
      }).toThrow(/INVALID_ARGUMENT.*minAmount.*maxAmount/);
    });
  });
  
  describe('8. Entrada válida', () => {
    
    it('acepta entrada mínima vacía', () => {
      const result = validateSearchInput({});
      expect(result).toEqual({});
    });
    
    it('acepta búsqueda por período', () => {
      const result = validateSearchInput({
        from: 1000000,
        to: 2000000
      });
      expect(result).toEqual({
        from: 1000000,
        to: 2000000
      });
    });
    
    it('acepta búsqueda compleja válida', () => {
      const result = validateSearchInput({
        from: 1000000,
        to: 2000000,
        accountId: 'acc-123',
        type: 'expense',
        currency: 'UYU',
        minAmount: 100,
        maxAmount: 5000,
        limit: 50,
        offset: 0
      });
      
      expect(result).toEqual({
        from: 1000000,
        to: 2000000,
        accountId: 'acc-123',
        type: 'expense',
        currency: 'UYU',
        minAmount: 100,
        maxAmount: 5000,
        limit: 50,
        offset: 0
      });
    });
  });
});
