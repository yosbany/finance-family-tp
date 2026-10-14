# FASE 07C3D — PLAN DE PRUEBAS

## Objetivo

Validar que `findSimilarTransactions` mejora la clasificación de los 7 casos UNCERTAIN.

## Casos a Probar

```
A2  MIX UP (1/3)
A3  DREAMSTORE OCA (1/3)
A4  RETIRO CORRESPONSALES, MONTEVIDEO
A7  COMPADRE, MONTEVIDEO
A8  DEBITO OPERACION EN BANCA DIGITAL P--
A9  DEBITO OPERACION EN BANCA DIGITAL P--
A10 DEBITO OPERACION EN BANCA DIGITAL PCREDITO
```

## Estrategia de Pruebas

### Fase 1: Exploración Histórica (manual)

Para cada caso, documentar:

1. **Query**: Descripción de la transacción
2. **Búsqueda**: Transacciones similares en historial categorizado
3. **Evidencia**: Distribución de categorías históricas
4. **Implicación**: Qué sugiere el historial

### Fase 2: Re-clasificación con LLM

1. Proporcionar al LLM:
   - Transacción actual
   - Resultados de `findSimilarTransactions`
   - 14 categorías disponibles

2. Solicitar:
   - Categoría sugerida
   - Confianza mejorada
   - Reasoning actualizado

### Fase 3: Comparación ANTES/DESPUÉS

Para cada caso:

```
ANTES:
  Status: UNCERTAIN
  LLM Category: X
  LLM Confidence: Y%

CONSULTAS AL HISTÓRICO:
  Query: [description]
  Matches: N
  Distribution: [...categories...]

DESPUÉS:
  Status: SUGGESTED o UNCERTAIN
  LLM Category: X'
  LLM Confidence: Y'%
  cambio?: ¿mejoró?
```

## Evidencia Esperada

### A2: MIX UP (1/3)

**Búsqueda**: "MIX UP"

Buscamos:
- Transacciones con "MIX UP"
- Variantes normalizadas

**Hipótesis**: Si encontramos múltiples "MIX UP" con la misma categoría histórica, el agente debería mejorar su confianza.

### A3: DREAMSTORE OCA (1/3)

**Búsqueda**: "DREAMSTORE"

Buscamos:
- Transacciones con "DREAMSTORE"
- NOTA: "OCA" es solo método de pago, no rubro

**Hipótesis**: El historial de DREAMSTORE debería clarificar la categoría real (no OCA).

### A4: RETIRO CORRESPONSALES, MONTEVIDEO

**Búsqueda**: "RETIRO CORRESPONSALES"

Buscamos:
- Retiros anteriores
- Retiros en corresponsales
- Cómo el usuario los categoriza

**Hipótesis**: Determinar si son Transferencias, Otros, o diferentes categorías.

### A7: COMPADRE, MONTEVIDEO

**Búsqueda**: "COMPADRE"

Buscamos:
- Transacciones con "COMPADRE"
- Variantes cercanas

**Hipótesis**: Si existe historial, esclarecerá si es restaurante, bar, tienda, etc.

### A8/A9: DEBITO OPERACION EN BANCA DIGITAL P--

**Búsqueda**: "DEBITO OPERACION EN BANCA DIGITAL"

Buscamos:
- Operaciones de banca digital anteriores
- Cómo se categorizan

**Hipótesis**: El patrón de categorización histórica de operaciones digitales.

### A10: DEBITO OPERACION EN BANCA DIGITAL PCREDITO

**Búsqueda**: "DEBITO OPERACION BANCA DIGITAL PCREDITO"

Buscamos:
- PCREDITO específicamente
- Operaciones de crédito

**Hipótesis**: Si existe evidencia de que PCREDITO es "Pago de Crédito", debería ser Transferencias o diferente categoría.

## Métricas de Éxito

### Nivel 1: Mejora de Confianza

Mínimo: 3 de 7 casos pasan de UNCERTAIN a SUGGESTED (confianza >= 75%)

### Nivel 2: Cambio de Categoría

Al menos 1 caso cambia de categoría basado en evidencia histórica

### Nivel 3: Mayor Consistencia

El historial permite identificar patrones que el LLM solo no ve

## Restricciones

✅ READ-ONLY (sin escritura en Firebase)
✅ Sin persistencia
✅ Sin cambios en pipeline determinístico
✅ Máximo 3 búsquedas por transacción
✅ Máximo 20 resultados por búsqueda
✅ Máximo 50 filas históricas únicas por transacción

## Próximos Pasos

1. Ejecutar exploración histórica
2. Validar disponibilidad de contexto
3. Re-ejecutar LLM con contexto
4. Documentar ANTES/DESPUÉS
5. Determinar impacto en clasificación
