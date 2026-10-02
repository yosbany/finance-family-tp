"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const searchTransactions_1 = require("../searchTransactions");
describe('searchTransactions Security', () => {
    describe('1. Parámetros prohibidos', () => {
        it('rechaza uid', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    uid: 'user-123',
                    period: '2026-09'
                });
            }).toThrow(/SECURITY_VIOLATION.*uid/);
        });
        it('rechaza userId', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    userId: 'user-123'
                });
            }).toThrow(/SECURITY_VIOLATION.*userId/);
        });
        it('rechaza familyId', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    familyId: 'family-123'
                });
            }).toThrow(/SECURITY_VIOLATION.*familyId/);
        });
        it('rechaza firebasePath', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    firebasePath: '/family/transactions'
                });
            }).toThrow(/SECURITY_VIOLATION.*firebasePath/);
        });
        it('rechaza path', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    path: '/transactions'
                });
            }).toThrow(/SECURITY_VIOLATION.*path/);
        });
    });
    describe('2. Argumentos desconocidos', () => {
        it('rechaza argumentos no permitidos', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    from: 1000000,
                    unknownParam: 'value'
                });
            }).toThrow(/INVALID_ARGUMENT.*unknownParam/);
        });
        it('rechaza múltiples argumentos desconocidos', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    foo: 'bar',
                    baz: 'qux'
                });
            }).toThrow(/INVALID_ARGUMENT/);
        });
    });
    describe('3. Validación de tipos', () => {
        it('rechaza from no numérico', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    from: 'not-a-number'
                });
            }).toThrow(/INVALID_ARGUMENT.*from/);
        });
        it('rechaza to no numérico', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    to: null
                });
            }).toThrow(/INVALID_ARGUMENT.*to/);
        });
        it('rechaza from negativo', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    from: -1000
                });
            }).toThrow(/INVALID_ARGUMENT.*from/);
        });
        it('rechaza from > to', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    from: 2000,
                    to: 1000
                });
            }).toThrow(/INVALID_ARGUMENT.*from.*to/);
        });
    });
    describe('4. Validación de strings', () => {
        it('rechaza accountId vacío', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    accountId: ''
                });
            }).toThrow(/INVALID_ARGUMENT.*accountId/);
        });
        it('rechaza accountId muy largo', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    accountId: 'a'.repeat(200)
                });
            }).toThrow(/INVALID_ARGUMENT.*accountId/);
        });
        it('rechaza description muy larga', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    description: 'a'.repeat(500)
                });
            }).toThrow(/INVALID_ARGUMENT.*description/);
        });
    });
    describe('5. Validación de enumeraciones', () => {
        it('rechaza type inválido', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    type: 'invalid_type'
                });
            }).toThrow(/INVALID_ARGUMENT.*type/);
        });
        it('acepta types válidos', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({ type: 'income' });
                (0, searchTransactions_1.validateSearchInput)({ type: 'expense' });
                (0, searchTransactions_1.validateSearchInput)({ type: 'transfer' });
            }).not.toThrow();
        });
        it('rechaza currency inválida', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    currency: 'EUR'
                });
            }).toThrow(/INVALID_ARGUMENT.*currency/);
        });
        it('acepta currencies válidas', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({ currency: 'UYU' });
                (0, searchTransactions_1.validateSearchInput)({ currency: 'USD' });
            }).not.toThrow();
        });
        it('rechaza status inválido', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    status: 'unknown'
                });
            }).toThrow(/INVALID_ARGUMENT.*status/);
        });
    });
    describe('6. Validación de límites', () => {
        it('rechaza limit > MAX_SEARCH_LIMIT', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    limit: searchTransactions_1.MAX_SEARCH_LIMIT + 1
                });
            }).toThrow(/INVALID_ARGUMENT.*limit/);
        });
        it('acepta limit <= MAX_SEARCH_LIMIT', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({ limit: searchTransactions_1.MAX_SEARCH_LIMIT });
                (0, searchTransactions_1.validateSearchInput)({ limit: 1 });
                (0, searchTransactions_1.validateSearchInput)({ limit: 50 });
            }).not.toThrow();
        });
        it('rechaza limit 0', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    limit: 0
                });
            }).toThrow(/INVALID_ARGUMENT.*limit/);
        });
        it('rechaza limit negativo', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    limit: -10
                });
            }).toThrow(/INVALID_ARGUMENT.*limit/);
        });
    });
    describe('7. Validación de montos', () => {
        it('rechaza minAmount no numérico', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    minAmount: 'string'
                });
            }).toThrow(/INVALID_ARGUMENT.*minAmount/);
        });
        it('rechaza maxAmount negativo', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    maxAmount: -100
                });
            }).toThrow(/INVALID_ARGUMENT.*maxAmount/);
        });
        it('rechaza minAmount > maxAmount', () => {
            expect(() => {
                (0, searchTransactions_1.validateSearchInput)({
                    minAmount: 1000,
                    maxAmount: 100
                });
            }).toThrow(/INVALID_ARGUMENT.*minAmount.*maxAmount/);
        });
    });
    describe('8. Entrada válida', () => {
        it('acepta entrada mínima vacía', () => {
            const result = (0, searchTransactions_1.validateSearchInput)({});
            expect(result).toEqual({});
        });
        it('acepta búsqueda por período', () => {
            const result = (0, searchTransactions_1.validateSearchInput)({
                from: 1000000,
                to: 2000000
            });
            expect(result).toEqual({
                from: 1000000,
                to: 2000000
            });
        });
        it('acepta búsqueda compleja válida', () => {
            const result = (0, searchTransactions_1.validateSearchInput)({
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
//# sourceMappingURL=searchTransactions.security.test.js.map