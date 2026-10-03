# FASE 07C2 — PIPELINE REAL DE SUGERENCIAS

**Estado:** 🔴 BLOQUEADO - Esperando datos reales de Firebase  
**Inicio:** 3 de Octubre 2026, 14:31 UTC-3  
**Objetivo:** Obtener números reales del funnel de sugerencias antes de construir UI 07C3

---

## 📍 ¿DÓNDE ESTAMOS?

He investigado exhaustivamente qué está **realmente** implementado en el código.

**Resultado:** Encontré una **inconsistencia importante** entre lo que se describía y lo que realmente existe.

### Pipeline Declarado (en reportes anteriores):
```
RULES → HISTORICAL_EXACT → HISTORICAL_CONSENSUS → AGENT → NONE
```

### Pipeline Real (HOY):
```
HISTORICAL_EXACT → HISTORICAL_CONSENSUS → NONE
(RULES y AGENT no están integrados)
```

---

## ✅ LO QUE ESTÁ LISTO

### 1. Backend Funcional (Histórico)

✅ `classificationSuggestion.service.ts`
- Normalización de merchant (detecta REDIVA, COMPRA, códigos)
- HISTORICAL_EXACT: busca coincidencia 100%
- HISTORICAL_CONSENSUS: busca mayoría > 50%
- Pipeline determinístico sin persistencia

✅ `suggestTransactionCategory` (Tool)
- Read-only garantizado
- Rechaza uid, userId, familyId, firebasePath
- No modifica Firebase
- Output sanitizado

✅ Tool Registry
- Registrada sin errores
- Integrada en agent

### 2. Scripts de Medición

✅ `scripts/export-transactions-real.js`
- Exporta datos de Firebase a JSON
- Conexión con credenciales reales
- Genera `transactions-real.json`

✅ `scripts/run-phase07c2-pipeline.ts`
- Ejecuta pipeline determinístico
- Genera funnel real
- Salida: `FASE_07C2_RESULTS.json`

### 3. Documentación Completa

✅ `docs/FASE_07C2_ACLARACION_PIPELINE.md` - Qué está implementado  
✅ `docs/FASE_07C2_PLAN_EJECUCION.md` - Pasos de ejecución  
✅ `docs/FASE_07C2_RESULTADOS_REALES.md` - Reporte ejecutivo  
✅ `docs/FASE_07C2_ESTADO_SESION.md` - Resumen de sesión

### 4. npm Scripts

```bash
npm run phase07c2:export  # Exporta datos de Firebase
npm run phase07c2:test    # Ejecuta pipeline
```

---

## 🔴 BLOQUEADOR: ACCESO A FIREBASE

**Problema:** Las credenciales de Firebase no están disponibles en este contexto.

**Razón:** Es correcto - los secrets no deben exponerse.

**Solución:** Tú ejecutas los scripts desde tu entorno donde tienes credenciales.

---

## 📋 QUÉ HACER AHORA

### Paso 1: Obtener Credenciales

En tu máquina o VPS, encuentra la ruta a tu archivo de credenciales Firebase:

```bash
echo $GOOGLE_APPLICATION_CREDENTIALS

# O busca el archivo:
find ~ -name "*firebase*service*account*" 2>/dev/null
```

### Paso 2: Exportar Datos

```bash
cd /Users/yosbanytejas/Documents/finance-family

export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/firebase-service-account.json"

npm run phase07c2:export
```

**Salida esperada:**
```
📊 DATASET SUMMARY
════════════════════════════════════════════════════════════════
  Total transactions: 672 (aprox)
  Classified: 596 (aprox)
  Pending: 76 (aprox)
  Unique categories: 14 (aprox)
════════════════════════════════════════════════════════════════

✅ Exported to: transactions-real.json
```

### Paso 3: Ejecutar Pipeline

```bash
npm run phase07c2:test
```

**Salida esperada:**
```
════════════════════════════════════════════════════════════════
FASE 07C2 - PIPELINE REAL
════════════════════════════════════════════════════════════════

📊 DATASET
─────────────────────────────────────────────────────────────────
  Total: 672
  Classified: 596
  Pending: 76
  Categories: 14

🔄 Processing 76 pending transactions...

📈 FUNNEL REAL
─────────────────────────────────────────────────────────────────
  76 pendientes
  ├─ X HISTORICAL_EXACT
  ├─ Y HISTORICAL_CONSENSUS
  └─ Z NONE (sin sugerencia)

📊 MÉTRICAS
─────────────────────────────────────────────────────────────────
  Resueltas: (X+Y)/76 (XX%)
  Sin sugerencia: Z/76 (YY%)

✅ RESULTS
─────────────────────────────────────────────────────────────────
  Saved to: FASE_07C2_RESULTS.json
```

### Paso 4: Compartir Resultados

Abre `FASE_07C2_RESULTS.json` y comparte el funnel real:

```json
{
  "funnel": {
    "total": 76,
    "historical_exact": X,
    "historical_consensus": Y,
    "none": Z
  }
}
```

---

## 📊 QUÉ MEDIREMOS

Una vez con datos reales:

```
FUNNEL COMPLETO:
├─ 76 pendientes
├─ X HISTORICAL_EXACT (merchant normalizado 100% coincide)
├─ Y HISTORICAL_CONSENSUS (mayoría clara > 50%)
└─ Z NONE (sin sugerencia)

VALIDACIÓN: X + Y + Z = 76

RATE:
├─ Resueltas = X + Y
├─ Pendientes = Z
└─ % = (Resueltas / 76) * 100

ANÁLISIS DE RESTANTES (Z transacciones):
├─ SEMANTIC: descripción clara
├─ AMBIGUOUS: múltiples opciones
└─ OPAQUE: sin contexto

CANDIDATES PARA AGENTE:
├─ agentCandidates = SEMANTIC + (parte de AMBIGUOUS)
└─ maxPilot = min(agentCandidates, 10)
```

---

## 🎯 PRÓXIMOS PASOS (Cuando tengas datos reales)

1. **Verificación del funnel** - ¿Números tienen sentido?
2. **Análisis de restantes** - ¿Cuántos SEMANTIC/AMBIGUOUS/OPAQUE?
3. **Decisión RULES** - ¿Integrar motor de reglas ahora?
4. **Piloto agente** - Evaluar máx 10 transacciones reales
5. **Recomendación UI 07C3** - Qué fuentes mostrar, qué agrupar

---

## 📋 ESTADO FASE 07C2

| Requisito | Status | Notas |
|-----------|--------|-------|
| Aclarar pipeline | ✅ | Documentado en 4 archivos |
| Backend histórico | ✅ | Funcional y seguro |
| Seguridad | ✅ | Read-only validado |
| Scripts | ✅ | Listos para ejecutar |
| Datos reales | 🔴 | BLOQUEADOR: requiere TU ejecución |
| Funnel real | 🔴 | Depende de datos |
| Análisis restantes | ⏳ | Después de funnel |
| Piloto agente | ⏳ | Después del histórico |
| UI 07C3 | ⏳ | Última decisión |

---

## 📚 DOCUMENTACIÓN REFERENCIA

**Para entender qué está implementado:**
→ Lee: `docs/FASE_07C2_ACLARACION_PIPELINE.md`

**Para ejecutar los scripts:**
→ Lee: `docs/FASE_07C2_PLAN_EJECUCION.md`

**Para ver estado detallado:**
→ Lee: `docs/FASE_07C2_ESTADO_SESION.md`

**Para ver reporte ejecutivo:**
→ Lee: `docs/FASE_07C2_RESULTADOS_REALES.md`

---

## 🔐 Notas de Seguridad

- ✅ Tool read-only: NO modifica Firebase
- ✅ Rechaza parámetros peligrosos: uid, userId, familyId, firebasePath
- ✅ Output sanitizado: sin metadata interna
- ✅ Pipeline determinístico: todo en memoria, sin persistencia
- ✅ AuthenticatedContext: uid verificado en token

---

## 🚀 Próxima Acción

**AHORA:** Ejecuta los scripts desde tu entorno con credenciales Firebase

```bash
npm run phase07c2:export   # Exporta datos
npm run phase07c2:test     # Ejecuta pipeline
```

**LUEGO:** Comparte el funnel real

---

**Commit:** `99aa4c6b` - FASE_07C2: Aclaración de pipeline + scripts de medición
