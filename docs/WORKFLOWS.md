# 🔄 Workflows - Finance Family

Documentación de los flujos de trabajo principales en Finance Family.

---

## 📋 Tabla de Contenidos

1. [Categorización de Transacciones](#categorización-de-transacciones)
2. [Pipeline de Sugerencias](#pipeline-de-sugerencias)
3. [Validación Humana](#validación-humana)
4. [Sincronización de Datos](#sincronización-de-datos)

---

## 🏷️ Categorización de Transacciones

### Descripción General

El sistema de categorización automática utiliza múltiples estrategias para sugerir categorías a las transacciones. Cada estrategia tiene un nivel de confianza diferente.

**Estrategias (por confiabilidad):**

1. **RULES** - Patrones configurados manualmente
2. **HISTORICAL_EXACT** - Histórico: 100% coincidencia
3. **HISTORICAL_CONSENSUS** - Histórico: >50% consenso
4. **AGENT** - Sugerencias del LLM

---

### Flujo Principal: Categorización de Transacción Pendiente

```
┌─────────────────────────────────┐
│  Transacción Pendiente          │
│  (sin categorizar)              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  RULES                          │
│  (Patrones configurados)        │
│  - confidence >= 0.5            │
└────────────┬────────────────────┘
             │
             ├─ ✅ MATCH → Proponer + Salir
             │
             ├─ ❌ NO MATCH → Continuar
             │
             ▼
┌─────────────────────────────────┐
│  HISTORICAL_EXACT               │
│  (Búsqueda en histórico)        │
│  - 100% coincidencia            │
└────────────┬────────────────────┘
             │
             ├─ ✅ MATCH → Proponer + Salir
             │
             ├─ ❌ NO MATCH → Continuar
             │
             ▼
┌─────────────────────────────────┐
│  HISTORICAL_CONSENSUS           │
│  (Búsqueda con tolerancia)      │
│  - > 50% consenso               │
└────────────┬────────────────────┘
             │
             ├─ ✅ MATCH → Proponer + Salir
             │
             ├─ ❌ NO MATCH → Continuar
             │
             ▼
┌─────────────────────────────────┐
│  AGENT (LLM)                    │
│  (Sugerencia inteligente)       │
│  - Consulta contexto            │
└────────────┬────────────────────┘
             │
             ├─ ✅ Propuesta válida → Sugerir
             │
             ├─ ❓ Incertidumbre → Abstenerse
             │
             ▼
┌─────────────────────────────────┐
│  Resultado                      │
│  - Categoría + Confianza        │
│  - O: Manual (usuario)          │
└─────────────────────────────────┘
```

---

### Algoritmo: AGENT - Búsqueda Inteligente

**Entrada**: Transacción pendiente con descripción/merchant

**Proceso**:

```
1. Normalizar descripción
   ↓
2. Consultar HISTORICAL_EXACT
   - Buscar merchants/descripciones idénticas
   - Ver cómo fueron categorizadas
   ↓
3. Análisis de Patrones
   - Extraer palabras clave
   - Buscar coincidencias parciales
   ↓
4. Consultar Contexto
   - Transacciones similares del usuario
   - Comportamiento histórico
   ↓
5. Propuesta
   - Categoría sugerida + confianza
   - O: Abstenerse si hay incertidumbre
   ↓
6. Validación Humana (opcional)
   - Usuario confirma o corrige
```

**Ejemplos**:

| Descripción | Proceso | Resultado |
|---|---|---|
| `MERCADO CENTRAL` | Busca histórico → SUPER Categoría | ✅ "Supermercado" |
| `SPOTIFY CHARGE` | Busca histórico → SUSCRIPCIÓN | ✅ "Suscripciones" |
| `XYZ UNKNOWN CO` | No hay histórico → Incertidumbre | ⓘ Abstenerse |

---

## 🔀 Pipeline de Sugerencias

### Componentes Principales

```
Frontend (User Input)
    │
    ├─ Transacción pendiente
    │
    ▼
Backend (Processing)
    │
    ├─ 1. Validar transacción
    ├─ 2. Ejecutar RULES
    ├─ 3. Ejecutar HISTORICAL_EXACT
    ├─ 4. Ejecutar HISTORICAL_CONSENSUS
    ├─ 5. Ejecutar AGENT (si necesario)
    │
    ▼
Firestore (Storage)
    │
    ├─ Guardar sugerencia
    ├─ Guardar feedback del usuario
    │
    ▼
Frontend (Display)
    │
    └─ Mostrar sugerencia + Botones
       - Aceptar
       - Rechazar
       - Editar
```

### Estados de una Sugerencia

```
PENDING (creada)
    │
    ├─ ACCEPTED (usuario confirmó)
    │   └─ Transacción categorizada
    │
    ├─ REJECTED (usuario rechazó)
    │   └─ Feedback enviado
    │
    └─ EXPIRED (tiempo máximo)
        └─ No se actualizó
```

---

## ✅ Validación Humana

### FASE 07C3 - Validación de Calidad

**Objetivo**: Determinar confiabilidad de cada estrategia

**Datos a validar**:
- RULES: ~18 casos con confianza variada
- HISTORICAL_EXACT: ~32 casos con 100% consenso
- HISTORICAL_CONSENSUS: ~12 casos con >50% consenso
- AGENT: ~10 casos de LLM

**Proceso**:

```
1. Extraer muestras diversas
   ↓
2. Mostrar sugerencias al usuario
   ↓
3. Usuario valida: Aceptar/Rechazar
   ↓
4. Calcular tasa de aceptación por estrategia
   ↓
5. Análisis de resultados
   - RULES: ¿Qué confianza es confiable?
   - HISTORICAL: ¿Consenso mínimo?
   - AGENT: ¿Qué contexto ayuda?
   ↓
6. Recomendaciones para FASE 07C4
```

**Output Esperado**:

```json
{
  "RULES": {
    "0.9+": { "acceptance": 0.95, "samples": 5 },
    "0.7-0.89": { "acceptance": 0.80, "samples": 8 },
    "0.5-0.69": { "acceptance": 0.60, "samples": 5 }
  },
  "HISTORICAL_EXACT": { "acceptance": 0.98, "samples": 32 },
  "HISTORICAL_CONSENSUS": { "acceptance": 0.75, "samples": 12 },
  "AGENT": { "acceptance": 0.70, "samples": 9 }
}
```

---

## 🔄 Sincronización de Datos

### Actualización de Histórico

Cuando el usuario categoriza una transacción (manual o acepta sugerencia):

```
User Action (Aceptar/Rechazar/Editar)
    │
    ▼
Update Transaction
    │
    ├─ Guardar categoría
    ├─ Guardar timestamp
    ├─ Marcar como "user_confirmed"
    │
    ▼
Update Historical Index
    │
    ├─ Normalizador: merchant/descripción
    ├─ Agregar entrada a índice
    ├─ Actualizar consenso si hay múltiples
    │
    ▼
Regenerar Sugerencias
    │
    ├─ Otras transacciones pendientes
    ├─ Puede que ahora tengan HISTORICAL_EXACT
    │
    ▼
Notificar Usuario
    │
    └─ Transacciones categorizadas
```

### Invalidación de Cache

El índice histórico se regenera cuando:

1. Usuario agrega regla (RULES)
2. Usuario categoriza transacción
3. Usuario sincroniza desde banco
4. Se ejecuta validación FASE 07C3

---

## 📊 Métricas y Monitoreo

### KPIs Principales

| Métrica | Descripción | Target |
|---------|-------------|--------|
| **Auto-Categorization Rate** | % transacciones categorizadas automáticamente | >70% |
| **Acceptance Rate** | % sugerencias aceptadas por usuario | >80% |
| **False Positive Rate** | % sugerencias incorrectas | <10% |
| **Time to Categorize** | Tiempo promedio por transacción | <1s |

### Logs Relevantes

```
categorization:start → transactionId, description
categorization:rule_match → rule_id, confidence
categorization:historical_exact → count, categories
categorization:historical_consensus → consensus_pct
categorization:agent_call → model, latency
categorization:success → categoryId, source
categorization:error → error_type, reason
```

---

## 🔗 Documentos Relacionados

- [FASE_07C2_ACLARACION_PIPELINE.md](./FASE_07C2_ACLARACION_PIPELINE.md) - Detalle técnico del pipeline
- [FASE_07C3_STATUS.md](./FASE_07C3_STATUS.md) - Estado de validación humana
- [API.md](./API.md) - Endpoints de categorización
- [TECHNICAL_VALIDATION.md](./TECHNICAL_VALIDATION.md) - Validaciones técnicas

---

**Última actualización**: Oct 4, 2026  
**Versión**: 1.0.0  
**Autor**: Documentation System
