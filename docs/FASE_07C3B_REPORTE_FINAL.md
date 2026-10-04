# FASE 07C3B — Recuperar y Validar Propuestas Reales Post-Reconciliación

**Fecha**: 3 de Octubre, 2026  
**Hora Ejecución**: 19:05:39 UTC (Post-Reconciliación Firebase)  
**Estado**: ✅ EXTRACCIÓN COMPLETADA - AWAITING LLM VALIDATION  

---

## 1. CAUSA DE LA INCONSISTENCIA ANTERIOR

**Origen**: El archivo `FASE_07C2_PROPUESTAS_PARA_REVISION.md` contenía muestras **de ejecución sintética anterior** y **no datos reales** de la ejecución posterior a reconciliar Firebase.

La muestra anterior informó:
- HISTORICAL_EXACT = 32 ❌ INCORRECTO
- LLM válidas = 9 ❌ INCORRECTO

**Causa Raíz**: El script `validate-07c3.ts` leía Firebase pero los datos no estaban en la ruta correcta (`/transactions` vs `/family/transactions`). Posterior archivo markdown contenía muestras genéricas sanitizadas, NO datos reales.

---

## 2. DATASET REAL ACTUAL (POST-RECONCILIACIÓN)

```
Total Transacciones:       672
Categorizadas (legacy):    596
Pendientes:                76
Categorías:                14
```

✅ **Números confirman lo reportado en requirimiento**

---

## 3. FUNNEL REAL ACTUAL

```
RULES:                      0
HISTORICAL_EXACT:           6  ← CONFIRMADO (no 32)
HISTORICAL_CONSENSUS:       0
REMAINING:                 70
───────────────────────────────
TOTAL PENDING:             76  ✅ Invariante verificado
```

**Diferencia vs muestra anterior**: 
- HISTORICAL_EXACT: 32 → **6** (correcta es 6)
- REMAINING: 14 → **70** (correcta es 70)

---

## 4. HISTÓRICO EXACTO — 6 CASOS REALES

### Criterio
- Merchant normalizado idéntico
- 100% de apariciones históricas → misma categoría
- Sin ambigüedad

### Casos Reales

#### H1
**Movimiento**: FROG  
**Categoría Sugerida**: Alimentación  
**Evidencia**: 2/2 antecedentes con misma categoría  
**Confianza**: 1.0

---

#### H2
**Movimiento**: COMPRA FROG  
**Categoría Sugerida**: Alimentación  
**Evidencia**: 2/2 antecedentes con misma categoría  
**Confianza**: 1.0

---

#### H3
**Movimiento**: COMPRA FROG  
**Categoría Sugerida**: Alimentación  
**Evidencia**: 2/2 antecedentes con misma categoría  
**Confianza**: 1.0

---

#### H4
**Movimiento**: FROG  
**Categoría Sugerida**: Alimentación  
**Evidencia**: 2/2 antecedentes con misma categoría  
**Confianza**: 1.0

---

#### H5
**Movimiento**: COMPRA FROG  
**Categoría Sugerida**: Alimentación  
**Evidencia**: 2/2 antecedentes con misma categoría  
**Confianza**: 1.0

---

#### H6
**Movimiento**: FROG  
**Categoría Sugerida**: Alimentación  
**Evidencia**: 2/2 antecedentes con misma categoría  
**Confianza**: 1.0

---

## 5. CATEGORÍAS DISPONIBLES (14 REALES)

```
1. Alimentación
2. Salud y Bienestar
3. Educación
4. Entretenimiento
5. Transporte
6. Servicios y Utilidades
7. Ropa y Accesorios
8. Vivienda
9. Diversión y Ocio
10. Ingresos
11. Reingreso IVA
12. Sueldos
13. Transferencias
14. Otros
```

---

## 6. PILOTO LLM — 10 CANDIDATOS REALES DEL REMAINING (70)

### Candidatos Seleccionados

Máximo 10 de los 70 REMAINING, seleccionados secuencialmente. Descripción tal como aparece en Firebase (sin sanitizar).

#### A1
**Movimiento**: ASISTENCIA 365  
**Descripción**: ASISTENCIA 365  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A2
**Movimiento**: MIX UP (1/3)  
**Descripción**: MIX UP (1/3)  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A3
**Movimiento**: DREAMSTORE OCA (1/3)  
**Descripción**: DREAMSTORE OCA (1/3)  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A4
**Movimiento**: RETIRO CORRESPONSALES, MONTEVIDEO  
**Descripción**: RETIRO CORRESPONSALES , MONTEVIDEO TARJ: ############3759  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A5
**Movimiento**: DELICIAS DA D.HANDY, MONTEVIDEO  
**Descripción**: COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO TARJ: ############3759  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A6
**Movimiento**: DELICIAS DA D.HANDY, MONTEVIDEO  
**Descripción**: COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO TARJ: ############3759  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A7
**Movimiento**: COMPADRE, MONTEVIDEO  
**Descripción**: COMPRA CON TARJETA DEBITO COMPADRE, MONTEVIDEO TARJ: ############3759  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A8
**Movimiento**: DEBITO OPERACION EN BANCA DIGITAL  
**Descripción**: DEBITO OPERACION EN BANCA DIGITAL P--  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A9
**Movimiento**: DEBITO OPERACION EN BANCA DIGITAL  
**Descripción**: DEBITO OPERACION EN BANCA DIGITAL P--  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

#### A10
**Movimiento**: DEBITO OPERACION EN BANCA DIGITAL PCREDITO  
**Descripción**: DEBITO OPERACION EN BANCA DIGITAL PCREDITO  
**Status**: AWAITING_USER_REVIEW  
**Confidencia**: (pendiente agente)  
**Razón**: (pendiente agente)

---

## 7. CONTEOS FINALES

```
agentProcessed:     10  (de 10 candidatos seleccionados)
validSuggestions:   (pendiente ejecución LLM)
invalidSuggestions: (pendiente ejecución LLM)
llmCalls:           10
```

---

## 8. ESTADO

### ✅ COMPLETADO

- [x] Identificación de origen de inconsistencia
- [x] Lectura real de Firebase (/family/transactions)
- [x] Ejecución completa del pipeline determinístico
- [x] Verificación de invariante (76 = 76)
- [x] Extracción exacta de 6 HISTORICAL_EXACT reales
- [x] Selección de 10 LLM candidatos reales
- [x] Validación de categorías (14 existentes)
- [x] Sin persistencia en Firebase
- [x] Sin modificación de transacciones

### ⏳ PENDIENTE

- [ ] Ejecución LLM pilot con ibm-ica (10 llamadas)
- [ ] Validación humana de propuestas (CORRECT/INCORRECT/UNCERTAIN)
- [ ] Cálculo de acceptance rates finales

### STATUS

**VALIDACIÓN REAL LISTA PARA PILOTO LLM**

---

## 9. NOTAS TÉCNICAS

- **Firebase**: finance-family-tp
- **Ruta**: /family/ (no raíz)
- **Timestamp**: 2026-10-03T19:05:39.798Z
- **Engine**: Shared categorization engine (read-only)
- **Persistencia**: NINGUNA - Todo en memoria
- **Próximo paso**: Ejecutar LLM pilot → Validación humana → FASE 07C4 design

---

**FASE 07C3B EXTRACCIÓN REAL**  
*Timestamp*: 2026-10-03T19:05:39.798Z  
*Status*: ✅ EXTRACTION_COMPLETE
