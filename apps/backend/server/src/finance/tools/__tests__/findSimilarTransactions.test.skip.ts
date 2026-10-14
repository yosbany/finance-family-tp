/**
 * findSimilarTransactions Tool Tests
 * 
 * FASE 07C3D - READ-ONLY classification-aware transaction search
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateFindSimilarInput,
  FindSimilarTransactionsInput,
} from '../findSimilarTransactions.js';

describe('findSimilarTransactions - Input Validation', () => {
  describe('validateFindSimilarInput', () => {
    it('should reject non-object input', () => {
      expect(() => {
        validateFindSimilarInput('not an object');
      }).toThrow('INVALID_ARGUMENT: Input must be an object');

      expect(() => {
        validateFindSimilarInput(123);
      }).toThrow('INVALID_ARGUMENT: Input must be an object');

      expect(() => {
        validateFindSimilarInput(null);
      }).toThrow('INVALID_ARGUMENT: Input must be an object');
    });

    describe('Security: Prohibited Parameters', () => {
      it('should reject uid parameter', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', uid: 'user123' });
        }).toThrow('SECURITY_VIOLATION: Parameter \'uid\' is not allowed');
      });

      it('should reject userId parameter', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', userId: 'user123' });
        }).toThrow('SECURITY_VIOLATION: Parameter \'userId\' is not allowed');
      });

      it('should reject familyId parameter', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', familyId: 'family123' });
        }).toThrow('SECURITY_VIOLATION: Parameter \'familyId\' is not allowed');
      });

      it('should reject familyRoot parameter', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', familyRoot: 'family' });
        }).toThrow('SECURITY_VIOLATION: Parameter \'familyRoot\' is not allowed');
      });

      it('should reject firebasePath parameter', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', firebasePath: '/some/path' });
        }).toThrow('SECURITY_VIOLATION: Parameter \'firebasePath\' is not allowed');
      });

      it('should reject path parameter', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', path: '/some/path' });
        }).toThrow('SECURITY_VIOLATION: Parameter \'path\' is not allowed');
      });
    });

    describe('Unknown Parameters', () => {
      it('should reject unknown parameters', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', unknownParam: 'value' });
        }).toThrow('INVALID_ARGUMENT: Unknown parameter \'unknownParam\'');
      });
    });

    describe('Query Validation', () => {
      it('should accept valid query string', () => {
        const input = validateFindSimilarInput({ query: 'MIX UP' });
        expect(input.query).toBe('MIX UP');
      });

      it('should trim query string', () => {
        const input = validateFindSimilarInput({ query: '  MIX UP  ' });
        expect(input.query).toBe('MIX UP');
      });

      it('should reject empty query', () => {
        expect(() => {
          validateFindSimilarInput({ query: '' });
        }).toThrow('INVALID_ARGUMENT: query must be a non-empty string');
      });

      it('should reject query longer than 256 chars', () => {
        const longQuery = 'a'.repeat(257);
        expect(() => {
          validateFindSimilarInput({ query: longQuery });
        }).toThrow('INVALID_ARGUMENT: query must be a non-empty string (max 256 chars)');
      });

      it('should reject non-string query', () => {
        expect(() => {
          validateFindSimilarInput({ query: 123 });
        }).toThrow('INVALID_ARGUMENT: query must be a non-empty string');
      });
    });

    describe('TransactionId Validation', () => {
      it('should accept valid transactionId', () => {
        const input = validateFindSimilarInput({ transactionId: 'tx123' });
        expect(input.transactionId).toBe('tx123');
      });

      it('should reject empty transactionId', () => {
        expect(() => {
          validateFindSimilarInput({ transactionId: '' });
        }).toThrow('INVALID_ARGUMENT: transactionId must be a non-empty string');
      });

      it('should reject transactionId longer than 128 chars', () => {
        const longId = 'a'.repeat(129);
        expect(() => {
          validateFindSimilarInput({ transactionId: longId });
        }).toThrow('INVALID_ARGUMENT: transactionId must be a non-empty string (max 128 chars)');
      });

      it('should reject non-string transactionId', () => {
        expect(() => {
          validateFindSimilarInput({ transactionId: 123 });
        }).toThrow('INVALID_ARGUMENT: transactionId must be a non-empty string');
      });
    });

    describe('Limit Validation', () => {
      it('should accept valid limit (1-20)', () => {
        const input1 = validateFindSimilarInput({ query: 'test', limit: 1 });
        expect(input1.limit).toBe(1);

        const input2 = validateFindSimilarInput({ query: 'test', limit: 20 });
        expect(input2.limit).toBe(20);

        const input3 = validateFindSimilarInput({ query: 'test', limit: 10 });
        expect(input3.limit).toBe(10);
      });

      it('should default limit to 10', () => {
        const input = validateFindSimilarInput({ query: 'test' });
        expect(input.limit).toBe(10);
      });

      it('should reject limit < 1', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', limit: 0 });
        }).toThrow('INVALID_ARGUMENT: limit must be a number between 1 and 20');
      });

      it('should reject limit > 20', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', limit: 21 });
        }).toThrow('INVALID_ARGUMENT: limit must be a number between 1 and 20');
      });

      it('should reject non-finite limit', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', limit: Infinity });
        }).toThrow('INVALID_ARGUMENT: limit must be a number between 1 and 20');
      });

      it('should reject non-number limit', () => {
        expect(() => {
          validateFindSimilarInput({ query: 'test', limit: 'ten' });
        }).toThrow('INVALID_ARGUMENT: limit must be a number between 1 and 20');
      });
    });

    describe('Required Parameters', () => {
      it('should require at least query or transactionId', () => {
        expect(() => {
          validateFindSimilarInput({});
        }).toThrow(
          'INVALID_ARGUMENT: Must provide at least one of: query or transactionId'
        );
      });

      it('should accept query alone', () => {
        const input = validateFindSimilarInput({ query: 'MIX UP' });
        expect(input.query).toBe('MIX UP');
        expect(input.transactionId).toBeUndefined();
      });

      it('should accept transactionId alone', () => {
        const input = validateFindSimilarInput({ transactionId: 'tx123' });
        expect(input.transactionId).toBe('tx123');
        expect(input.query).toBeUndefined();
      });

      it('should accept both query and transactionId', () => {
        const input = validateFindSimilarInput({
          query: 'MIX UP',
          transactionId: 'tx123',
        });
        expect(input.query).toBe('MIX UP');
        expect(input.transactionId).toBe('tx123');
      });
    });

    describe('Complex Valid Scenarios', () => {
      it('should handle query with special characters', () => {
        const input = validateFindSimilarInput({
          query: 'DELICIAS DA D.HANDY, MONTEVIDEO',
        });
        expect(input.query).toBe('DELICIAS DA D.HANDY, MONTEVIDEO');
      });

      it('should handle full valid input', () => {
        const input = validateFindSimilarInput({
          query: 'MIX UP',
          limit: 15,
        });
        expect(input.query).toBe('MIX UP');
        expect(input.limit).toBe(15);
        expect(input.transactionId).toBeUndefined();
      });
    });
  });
});
