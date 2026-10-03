# FASE 07C2 - EJECUCIÓN REAL

## Objetivo

Ejecutar medición real del funnel de categorización sobre Firebase con:
1. Unificación de engine compartido ✅
2. Línea base de datos reales
3. Ejecución de pipeline determinístico (RULES → HISTORY_EXACT → HISTORY_CONSENSUS)
4. Clasificación de casos restantes
5. Piloto LLM en máx 10 candidatos

## Estado

### ✅ Completado

1. **Motor Unificado**
   - Frontend ahora re-exporta desde `apps/shared/categorization/engine.ts`
   - Backend ya usa shared engine
   - Compilación verificada
   - Parity test ejecutado ✅

2. **Build**
   - Frontend: ✅ Build exitoso
   - Backend: ✅ Build exitoso
   - Compartición verificada

### ⏳ En Ejecución

3. **Medición Real**
   - Script: `scripts/measure-07c2.ts`
   - Requiere: Firebase service account en `/etc/finance-family-api/firebase-service-account.json`
   - Conexión: Solo lectura (READ-ONLY)
   
   **Para ejecutar desde VPS:**
   ```bash
   cd /ruta/finance-family/apps/backend/server
   FIREBASE_SA_PATH=/etc/finance-family-api/firebase-service-account.json npx tsx ../../scripts/measure-07c2.ts
   ```

### Espera

4. **Piloto LLM** - Después de obtener métricas reales

## Resultados Esperados

Reporte JSON con:
- Dataset: {total, categorizado, pendiente, categorías}
- Funnel: {rules, historical_exact, historical_consensus, remaining}
- Classification: {semantic, ambiguous, opaque}
- Agent Candidates: max 10 con datos para revisión

## Seguridad

- ✅ READ-ONLY en Firebase
- ✅ No persiste sugerencias
- ✅ No requiere UID en input
- ✅ Sanitized output

## Siguiente

Reporte en: `docs/FASE_07C2_RESULTADOS_REALES.json`
