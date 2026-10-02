"use strict";
/**
 * searchTransactions
 *
 * Herramienta principal de búsqueda de transacciones.
 *
 * SEGURIDAD:
 * - Recibe AuthenticatedContext (uid del token verificado)
 * - NO acepta uid, userId, familyId, o firebasePath
 * - Valida todos los argumentos server-side
 * - Retorna SOLO información necesaria (no objetos completos)
 * - Aplica límites máximos
 *
 * CONTRATO:
 * - Entrada: AuthenticatedContext + filtros
 * - Salida: Transacciones paginadas, conteos, info de truncado
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SEARCH_LIMIT = exports.DEFAULT_SEARCH_LIMIT = void 0;
exports.validateSearchInput = validateSearchInput;
exports.searchTransactions = searchTransactions;
const repository_1 = require("../../data/repository");
exports.DEFAULT_SEARCH_LIMIT = 50;
exports.MAX_SEARCH_LIMIT = 500;
/**
 * Valida entrada de searchTransactions.
 *
 * Rechaza:
 * - uid, userId, familyId (parámetros prohibidos)
 * - firebasePath, paths (parámetros prohibidos)
 * - argumentos desconocidos
 * - valores fuera de rango
 */
function validateSearchInput(input) {
    if (typeof input !== 'object' || input === null) {
        throw new Error('INVALID_ARGUMENT: Input must be an object');
    }
    const obj = input;
    // Rechazar parámetros prohibidos
    const prohibitedParams = ['uid', 'userId', 'familyId', 'firebasePath', 'path'];
    for (const param of prohibitedParams) {
        if (param in obj) {
            throw new Error(`SECURITY_VIOLATION: Parameter '${param}' is not allowed`);
        }
    }
    // Validar parámetros conocidos
    const allowed = new Set([
        'from', 'to', 'accountId', 'categoryId', 'type',
        'currency', 'description', 'minAmount', 'maxAmount',
        'status', 'limit', 'offset'
    ]);
    for (const key in obj) {
        if (!allowed.has(key)) {
            throw new Error(`INVALID_ARGUMENT: Unknown parameter '${key}'`);
        }
    }
    const result = {};
    // Validar from
    if ('from' in obj) {
        const from = obj.from;
        if (typeof from !== 'number' || !Number.isFinite(from) || from < 0) {
            throw new Error('INVALID_ARGUMENT: from must be a valid positive number (timestamp)');
        }
        result.from = from;
    }
    // Validar to
    if ('to' in obj) {
        const to = obj.to;
        if (typeof to !== 'number' || !Number.isFinite(to) || to < 0) {
            throw new Error('INVALID_ARGUMENT: to must be a valid positive number (timestamp)');
        }
        result.to = to;
    }
    // Validar que from <= to
    if (result.from !== undefined && result.to !== undefined && result.from > result.to) {
        throw new Error('INVALID_ARGUMENT: from must be <= to');
    }
    // Validar accountId
    if ('accountId' in obj) {
        const accountId = obj.accountId;
        if (typeof accountId !== 'string' || accountId.length === 0 || accountId.length > 128) {
            throw new Error('INVALID_ARGUMENT: accountId must be a non-empty string (max 128 chars)');
        }
        result.accountId = accountId;
    }
    // Validar categoryId
    if ('categoryId' in obj) {
        const categoryId = obj.categoryId;
        if (typeof categoryId !== 'string' || categoryId.length === 0 || categoryId.length > 128) {
            throw new Error('INVALID_ARGUMENT: categoryId must be a non-empty string (max 128 chars)');
        }
        result.categoryId = categoryId;
    }
    // Validar type
    if ('type' in obj) {
        const type = obj.type;
        if (!['income', 'expense', 'transfer'].includes(type)) {
            throw new Error("INVALID_ARGUMENT: type must be 'income', 'expense', or 'transfer'");
        }
        result.type = type;
    }
    // Validar currency
    if ('currency' in obj) {
        const currency = obj.currency;
        if (!['UYU', 'USD'].includes(currency)) {
            throw new Error("INVALID_ARGUMENT: currency must be 'UYU' or 'USD'");
        }
        result.currency = currency;
    }
    // Validar description
    if ('description' in obj) {
        const description = obj.description;
        if (typeof description !== 'string' || description.length === 0 || description.length > 256) {
            throw new Error('INVALID_ARGUMENT: description must be a non-empty string (max 256 chars)');
        }
        result.description = description;
    }
    // Validar minAmount
    if ('minAmount' in obj) {
        const minAmount = obj.minAmount;
        if (typeof minAmount !== 'number' || !Number.isFinite(minAmount) || minAmount < 0) {
            throw new Error('INVALID_ARGUMENT: minAmount must be a valid non-negative number');
        }
        result.minAmount = minAmount;
    }
    // Validar maxAmount
    if ('maxAmount' in obj) {
        const maxAmount = obj.maxAmount;
        if (typeof maxAmount !== 'number' || !Number.isFinite(maxAmount) || maxAmount < 0) {
            throw new Error('INVALID_ARGUMENT: maxAmount must be a valid non-negative number');
        }
        result.maxAmount = maxAmount;
    }
    // Validar que minAmount <= maxAmount
    if (result.minAmount !== undefined &&
        result.maxAmount !== undefined &&
        result.minAmount > result.maxAmount) {
        throw new Error('INVALID_ARGUMENT: minAmount must be <= maxAmount');
    }
    // Validar status
    if ('status' in obj) {
        const status = obj.status;
        if (!['pending', 'classified', 'verified'].includes(status)) {
            throw new Error("INVALID_ARGUMENT: status must be 'pending', 'classified', or 'verified'");
        }
        result.status = status;
    }
    // Validar limit
    if ('limit' in obj) {
        const limit = obj.limit;
        if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1 || limit > exports.MAX_SEARCH_LIMIT) {
            throw new Error(`INVALID_ARGUMENT: limit must be between 1 and ${exports.MAX_SEARCH_LIMIT}`);
        }
        result.limit = limit;
    }
    // Validar offset
    if ('offset' in obj) {
        const offset = obj.offset;
        if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) {
            throw new Error('INVALID_ARGUMENT: offset must be a valid non-negative number');
        }
        result.offset = offset;
    }
    return result;
}
/**
 * Ejecuta la búsqueda de transacciones.
 *
 * SEGURO: El uid viene del contexto autenticado, no de argumentos.
 */
async function searchTransactions(context, input) {
    try {
        // Validar entrada
        const validatedInput = validateSearchInput(input);
        // Ejecutar búsqueda (el uid viene del contexto, nunca de argumentos)
        const result = await (0, repository_1.searchUserTransactions)(context, {
            from: validatedInput.from,
            to: validatedInput.to,
            accountId: validatedInput.accountId,
            categoryId: validatedInput.categoryId,
            type: validatedInput.type,
            currency: validatedInput.currency,
            description: validatedInput.description,
            minAmount: validatedInput.minAmount,
            maxAmount: validatedInput.maxAmount,
            status: validatedInput.status,
            limit: validatedInput.limit,
            offset: validatedInput.offset
        });
        // Sanitizar resultado: retornar SOLO información necesaria
        const sanitized = {
            transactions: result.transactions.map(tx => ({
                id: tx.id,
                accountId: tx.accountId,
                date: tx.date,
                description: tx.description,
                amount: tx.amount,
                currency: tx.currency,
                type: tx.type,
                category: tx.category,
                status: tx.status
            })),
            pagination: {
                total: result.total,
                matched: result.matched,
                offset: result.offset,
                limit: result.limit,
                truncated: result.truncated
            }
        };
        return sanitized;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // No exponer mensajes internos sensibles
        if (message.includes('USER_NOT_AUTHORIZED')) {
            throw new Error('UNAUTHENTICATED: User not authorized for this operation');
        }
        throw error;
    }
}
//# sourceMappingURL=searchTransactions.js.map