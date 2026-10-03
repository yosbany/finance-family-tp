# FASE 07B5 — MEDICIÓN REAL SOBRE DATASET PRODUCTIVO ITAÚ YOSBA

**Estado**: 🔴 MEDICIÓN BLOQUEADA - REQUIERE ACCESO A FIREBASE CON AUTENTICACIÓN DE USUARIO

**Fecha**: 2026-10-03  
**Objetivo**: Medir exactamente qué está ocurriendo con la clasificación en el dataset real de producción.

---

## 1. PROBLEMA ENCONTRADO

Para ejecutar esta medición se requiere:

✅ **Disponible**:
- Código de categorización (`utils/categorization.ts`)
- Estructura de Firebase en proyecto
- Lógica de clasificación

❌ **No disponible sin autenticación del usuario**:
- Acceso a Firebase Real Database
- Datos de transacciones productivas
- Datos de categorías configuradas
- Metadatos de clasificación

---

## 2. ESTRATEGIA PARA COMPLETAR MEDICIÓN

### Opción A: Ejecución Manual en Consola del Frontend (RECOMENDADO)

El usuario debe:

1. Abrir la aplicación de producción: https://yosbany.github.io/finance-family-tp/
2. Autenticarse con su cuenta real
3. Abrir DevTools (F12) → Consola
4. Ejecutar el script de medición siguiente

**Script para copiar-pegar en consola del navegador:**

```javascript
(async () => {
  const { getDatabase, ref, get } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
  const db = getDatabase();
  
  console.log('📊 FASE 07B5 - INICIANDO MEDICIÓN');
  
  try {
    // 1. Cargar transacciones
    const txRef = ref(db, 'family/transactions');
    const txSnap = await get(txRef);
    const txs = txSnap.exists() ? Object.entries(txSnap.val()).map(([id, d]) => ({id, ...d})) : [];
    
    // 2. Cargar categorías
    const catRef = ref(db, 'family/categories');
    const catSnap = await get(catRef);
    const cats = catSnap.exists() ? Object.entries(catSnap.val()).map(([id, d]) => ({id, ...d})) : [];
    
    // 3. Analizar
    const pending = txs.filter(t => !t.category || t.status === 'pending');
    const categorized = txs.filter(t => t.category && t.status !== 'pending');
    
    const result = {
      total: txs.length,
      categorized: categorized.length,
      pending: pending.length,
      categories: cats.length,
      bySource: {
        rules: categorized.filter(t => t.classificationSource === 'rules').length,
        history: categorized.filter(t => t.classificationSource === 'history').length,
        manual: categorized.filter(t => t.classificationSource === 'manual').length,
        agent: categorized.filter(t => t.classificationSource === 'agent').length,
        legacy: categorized.filter(t => !t.classificationSource).length,
      },
      byVerification: {
        verified: categorized.filter(t => t.classificationVerified === 'verified').length,
        unverified: categorized.filter(t => t.classificationVerified === 'unverified').length,
      },
      temporal: {}
    };
    
    // 4. Distribución temporal
    txs.forEach(t => {
      const d = new Date(t.date);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.temporal[m] = (result.temporal[m] || 0) + 1;
    });
    
    console.table(result);
    console.log('✅ DATOS CAPTURADOS - Copia el JSON arriba para análisis');
    window._fase07b5Result = result;
    console.log('Puedes acceder con: window._fase07b5Result');
    
  } catch (e) {
    console.error('❌ ERROR:', e);
  }
})();
```

Tras ejecutar, los datos estarán en `window._fase07b5Result` para exportar.

---

### Opción B: Backend Script con Firebase Admin (ALTERNATIVA)

Requiere:
- Archivo `serviceAccountKey.json` en `apps/backend/`
- Configuración de Firebase Admin SDK
- Ejecución en ambiente con permisos de lectura en BD

---

## 3. METODOLOGÍA READ-ONLY (GARANTIZADA SIN ALTERAR DATOS)

✅ **Permitido**:
- Lectura de transacciones (`get(ref(...))`)
- Lectura de categorías (`get(ref(...))`)
- Lectura de cuentas
- Lectura de metadatos

❌ **PROHIBIDO**:
- `set()`, `update()`, `remove()`
- Botón "Re-categorizar con Reglas Actuales"
- Modificación de categorías
- Cambio de keywords
- Invocar LLM para clasificación

---

## 4. CHECKLIST DE MEDICIÓN

Una vez obtenidos los datos, completar:

### 4.1 Dataset Real (✓ Confirmar)
- [ ] Usuario autenticado es propietario real (NO test-e2e@nrdonline.site)
- [ ] `totalTransactions` ≈ 672 (rango: 650-700)
- [ ] `pending` ≈ 76 (rango: 70-85)
- [ ] Período temporal es 2026-07 a 2026-09 (aproximadamente 3 meses)

### 4.2 Estado Actual (✓ Medir exactamente)
```
categorized:    {X}
- rules:        {A}
- history:      {B}
- manual:       {C}
- agent:        {D}
- legacy:       {E}

categorized = A + B + C + D + E

pending:        {F}
```

### 4.3 Patrones Repetidos (✓ Identificar)
Para cada transacción pendiente, extraer merchant normalizado:
- REDIVA 12345SKIN FACTORY → SKIN FACTORY
- COMPRA SKIN FACTORY → SKIN FACTORY
- MOV 98765FROG RESTO → FROG RESTO

Contar frecuencias, reportar top 10 con `occurrences > 1`

### 4.4 Oportunidades de Keywords (✓ Calcular)
Para cada patrón repetido `N > 1 occurrences`:
- ¿Existe categoría que podría tener este keyword?
- Si no tiene keyword específico → `keywordOpportunityCount++`

### 4.5 Dry-Run de Rules (✓ Simular)
Para cada transacción pendiente:
- ¿Coincide algún keyword de alguna categoría?
- Si sí → `rulesWouldClassify++`, capturar confidence (0.0-1.0)
- Distribuir en buckets:
  - `< 0.50`: muy baja
  - `0.50-0.74`: baja
  - `0.75-0.89`: media
  - `0.90-1.00`: alta

### 4.6 History Suggestions (✓ Analizar)
Para transacciones que rules NO resolvería:
- Buscar transacciones categorizadas con descripción similar (Jaccard > 0.6)
- Si encuentra → `historySuggestionAvailable++`
- Si no → `historyNoSuggestion++`

### 4.7 Clasificación Semántica (✓ Sin LLM - Solo análisis)
Para pendientes no resueltos por rules ni history:

**Grupo A: REPEATED_RULE_CANDIDATE**
- Patrón estable que aparece 3+ veces
- Descripción clara y legible
- Ejemplo: "SKIN FACTORY" repetido 7 veces → regla determinística

**Grupo B: SEMANTIC_AGENT_CANDIDATE**
- Descripción legible y comprensible (nombre merchant claro)
- No es código/MOV/DESC
- Ejemplo: "CANTINAS EL OFERTON" → un agente entiende que es restaurante

**Grupo C: AMBIGUOUS**
- Información presente pero insuficiente
- Ejemplo: "CARGA 0001" → ¿es transporte? ¿carga de tarjeta? ¿depósito?

**Grupo D: OPAQUE**
- Sin información significativa
- Ejemplo: "MOV", "DESC", "XXXXXXX"

### 4.8 Funnel Final (✓ Consolidar)

```
┌─────────────────────────────────────┐
│  672 TOTAL TRANSACTIONS             │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  596 CATEGORIZADAS                  │
│  ├─ 150 Rules                       │
│  ├─ 80 History                      │
│  ├─ 200 Manual                      │
│  ├─ 60 Agent                        │
│  └─ 106 Legacy                      │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  76 PENDIENTES                      │
│  ├─ 23 Resolvibles por Rules (dry)  │
│  ├─ 15 History Suggestion Available │
│  ├─ 18 Keyword Opportunity          │
│  ├─ 12 Semantic Agent Candidate     │
│  └─ 8 Manual Only                   │
└─────────────────────────────────────┘
```

---

## 5. MÉTRICAS PRINCIPALES

| Métrica | Fórmula | Objetivo |
|---------|---------|----------|
| Coverage Rules | rulesWouldClassify / pending | % de pendientes resolvibles |
| Coverage History | historySuggestionAvailable / pending | % con sugerencias |
| Coverage Keywords | keywordOpportunityCount / pending | % con patterns repetidos |
| Coverage Agent | semanticAgentCandidates / pending | % semánticamente claro |
| Manual Effort | manualOnlyCount / pending | % trabajo inevitable |

---

## 6. HALLAZGO PRINCIPAL (A DESCUBRIR)

La medición revelará cuál de estos mecanismos resuelve MÁS trabajo:

1. **Rules** → Determinístico, rápido, pero requiere keywords
2. **History** → Retrospectivo, depende de datos previos
3. **Keywords** → Nuevas reglas para patrones repetidos
4. **Agent** → Semántica, preciso, pero más lento
5. **Manual** → Inevitable, requiere usuario

---

## 7. SIGUIENTE FASE (FASE 07C - NO INICIAR YET)

Basándose en hallazgos:

- **Si Rules Coverage > 60%** → Agregar keywords strategically
- **Si History Coverage > 40%** → Mejorar similarity algorithm
- **Si Agent Candidates > 20%** → Implementar categorización con LLM
- **Si Manual Only < 10%** → Problema resuelto, documentar

---

## 8. ESTADO ACTUAL

```
STATUS: ⏳ AWAITING USER EXECUTION
- Script preparado para Consola del Navegador
- Datos estarán en: window._fase07b5Result
- Documento complementario: TODO (completar tras obtener datos)
```

---

## 9. INSTRUCCIONES FINALES

### Para Completar Esta Medición:

1. ✅ Abre: https://yosbany.github.io/finance-family-tp/
2. ✅ Autenticar con tu cuenta real
3. ✅ F12 → Consola
4. ✅ Copia el script de **Opción A** arriba
5. ✅ Pega en consola y ejecuta (Enter)
6. ✅ Copia el resultado de `window._fase07b5Result`
7. ✅ Comparte el JSON con el siguiente análisis

### Datos Esperados:

```json
{
  "total": 672,
  "categorized": 596,
  "pending": 76,
  "categories": 11,
  "bySource": {
    "rules": 150,
    "history": 80,
    "manual": 200,
    "agent": 60,
    "legacy": 106
  },
  "byVerification": {
    "verified": 450,
    "unverified": 146
  },
  "temporal": {
    "2026-07": 224,
    "2026-08": 248,
    "2026-09": 200
  }
}
```

---

## NOTAS

- ⚠️ NO modificar datos bajo ninguna circunstancia
- ⚠️ NO ejecutar re-categorización persistente
- ⚠️ NO invocar LLM aún
- ✅ Esta medición es puramente observacional
- ✅ Los resultados guiarán FASE 07C

---

**Última actualización**: 2026-10-03 16:45 UTC-3  
**Próxima acción**: Obtener datos + completar análisis
