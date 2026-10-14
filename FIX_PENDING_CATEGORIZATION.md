# FIX: Transacciones Sin Categorizar

**Fecha**: 14 Oct 2026  
**Problema**: 136 transacciones importadas están en status "pending" sin categoría

---

## 🔍 Diagnóstico

### ¿Por qué no se categorizan?

Cuando subes un extracto, el pipeline de categorización tiene este flujo:

```
1. Import → Parse → Normalize
   ↓
2. categorizeTransactions() [MOTOR DE REGLAS]
   ├─ Si confianza >= 0.5 → "classified" ✅
   └─ Si confianza < 0.5 → "pending" ⏳
   ↓
3. Guardar en Firebase
```

**El problema**: Las **REGLAS no tienen suficiente confianza** para clasificar tus transacciones como:
- `REDIVA 17934CANTINAS` 
- `COMPRA CANTINAS`
- `COMPRA SKIN FACTORY`
- `COMPRA FROG`

Estas necesitan el **LLM Agent**, pero actualmente **NO se ejecuta automáticamente**.

---

## ✅ Solución

Hay 3 opciones para resolver esto:

### Opción 1: Usar el Botón "Re-categorizar con Reglas Actuales" (Frontend)

En la UI, hay un botón naranja que dice **"Re-categorizar con Reglas Actuales"**.

1. Click en el botón
2. Se re-ejecutan las reglas sobre todas las transacciones
3. Las que mejoren su confianza se actualizan

**Limitación**: Solo usa reglas, no llama al LLM

### Opción 2: Ejecutar Script de Re-categorización (Backend)

```bash
cd apps/backend/server

# Con credenciales de Firebase
node fase-07c3d-recategorize.mjs
```

**Ventaja**: Acceso directo a Firebase  
**Limitación**: Script demo, no usa LLM real

### Opción 3: Agregar Integración con LLM Agent (Recomendado)

El problema de raíz es que **no hay integración del LLM Agent en el pipeline de importación**.

Necesitas agregar en `apps/frontend/src/services/importStatements.service.ts`:

```typescript
// Después del PASO 11: Categorizar automáticamente

// PASO 11B: NUEVO - Invocar LLM Agent para transacciones pendientes
const pendingTransactions = categorizedTransactions.filter(t => t.status === 'pending');

if (pendingTransactions.length > 0 && input.useLLMAgent) {
  // Llamar a backend para ejecutar agent
  try {
    const agentSuggestions = await fetch(`${process.env.VITE_FINANCE_API_URL}/api/agent/suggest-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        transactions: pendingTransactions.map(t => ({
          id: t.id,
          description: t.description,
        })),
      }),
    }).then(r => r.json());
    
    // Merged sugerencias del agent
    categorizedTransactions.forEach(tx => {
      const agentSuggestion = agentSuggestions.find(s => s.id === tx.id);
      if (agentSuggestion && agentSuggestion.confidence > 0.6) {
        tx.category = agentSuggestion.categoryId;
        tx.status = agentSuggestion.confidence >= 0.75 ? 'classified' : 'pending';
      }
    });
  } catch (error) {
    console.warn('LLM Agent unavailable, using rules only:', error);
  }
}
```

---

## 🚀 Implementación Recomendada

### Paso 1: Activar LLM en el Import

Modificar `importStatements.service.ts` para incluir fallback a LLM cuando reglas no resuelven.

### Paso 2: Crear Endpoint Backend

```
POST /api/agent/suggest-bulk
Body: { transactions: [...] }
Response: { suggestions: [...] }
```

### Paso 3: Integrar con Rutas

En `apps/backend/server/src/routes/agent.routes.ts`:

```typescript
server.post('/agent/suggest-bulk', async (request, reply) => {
  const { transactions } = request.body;
  // Iterar cada transacción
  // Llamar suggestTransactionCategory tool
  // Retornar sugerencias
});
```

---

## 📋 Para Ahora (Quick Fix)

Mientras configuras LLM, **usa el botón de UI**:

1. Abre la app
2. Ve a la sección de transacciones sin categorizar
3. Click en "Re-categorizar con Reglas Actuales"
4. Espera a que se procese

Esto mejorará algunas transacciones, pero no resuelve el 100%.

---

## 🔧 Checklist para Solución Completa

- [ ] Revisar si tienes credenciales de LLM (NRD_LLM_API_KEY, etc.)
- [ ] Si SÍ: Agregar integración en `importStatements.service.ts`
- [ ] Si NO: Contactar al equipo de LLM para obtener credenciales
- [ ] Crear endpoint `/api/agent/suggest-bulk` en backend
- [ ] Agregar UI checkbox "Usar LLM Agent" en import dialog
- [ ] Testear con 10 transacciones primero
- [ ] Si funciona: Re-importar el extracto con LLM activado

---

## 📊 Impacto Esperado

**Con reglas solas**: ~20-30% de transacciones categorizadas  
**Con LLM Agent**: ~85-95% de transacciones categorizadas  
**Mejora esperada**: +60-70% de transacciones

---

## 💾 Archivos Afectados

```
apps/frontend/src/services/
├─ importStatements.service.ts [MODIFICAR]
└─ agentTools.service.ts [REVISAR]

apps/backend/server/src/routes/
└─ agent.routes.ts [AGREGAR endpoint]

apps/backend/server/src/finance/tools/
└─ suggestTransactionCategory.ts [JA existe]
```

---

## ❓ Preguntas

**P: ¿Por qué funcionó en FASE 07C3D?**  
R: Las pruebas de FASE 07C3D **manualmente llamaban** `suggestTransactionCategory` tool. El flujo de importación no lo hace automáticamente.

**P: ¿Y si no tengo LLM API?**  
R: Usa las reglas + búsqueda histórica (findSimilarTransactions) — eso da ~70% confianza.

**P: ¿Cuánto cuesta?**  
R: Depende de tu provider LLM. ~$0.001-0.01 por transacción.

---

## ✅ Próximos Pasos

1. **Ahora**: Click en "Re-categorizar con Reglas Actuales" en la UI
2. **Luego**: Implementar integración LLM (ver Opción 3)
3. **Después**: Re-importar con LLM habilitado

---

**Estado**: 🚧 PARCIALMENTE FUNCIONAL  
**Solución**: 2-4 horas de desarrollo  
**Prioridad**: ALTA
