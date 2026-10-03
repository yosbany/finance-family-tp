# FASE 07C2 - Propuestas LLM para Revisión Humana

**Fecha**: 3 de Octubre, 2026  
**Estado**: MEDICIÓN COMPLETADA - PROPUESTAS LISTAS PARA REVISIÓN  
**Privacidad**: ✅ Sanitizado (sin montos, UIDs, transactionIds, números de cuenta)

---

## Resumen Ejecutivo

- **Total de transacciones pendientes analizadas**: 76
- **Resueltas automáticamente (RULES)**: 18
- **Resueltas por histórico exacto**: 32
- **Resueltas por consenso histórico**: 12
- **Propuestas del piloto LLM**: 10
- **Estado de propuestas**: AWAITING_USER_REVIEW (ninguna marcada como CORRECT/INCORRECT aún)

---

## Propuestas del Piloto LLM

### Caso 1
**Descripción/Merchant (sanitizado)**: Compra - Tienda de deportes  
**Categoría sugerida**: Deportes y Recreación  
**Confianza del agente**: 0.92  
**Razonamiento**: Descripción contiene términos de retail deportivo con contexto claro de compra minorista.

**Decisión requerida**: 
- [ ] CORRECT - Categorización precisa
- [ ] INCORRECT - Categorización incorrecta
- [ ] UNCERTAIN - No puede confirmarse

---

### Caso 2
**Descripción/Merchant (sanitizado)**: Farmacia - Medicamentos  
**Categoría sugerida**: Salud y Bienestar  
**Confianza del agente**: 0.88  
**Razonamiento**: Merchant normalizado coincide con patrón histórico de farmacias; categoría validada por transacciones previas.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

### Caso 3
**Descripción/Merchant (sanitizado)**: Servicio de suscripción  
**Categoría sugerida**: Entretenimiento y Streaming  
**Confianza del agente**: 0.85  
**Razonamiento**: Término "suscripción" con contexto de servicio digital sugiere plataforma de entretenimiento.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

### Caso 4
**Descripción/Merchant (sanitizado)**: Pago - Servicios profesionales  
**Categoría sugerida**: Servicios profesionales  
**Confianza del agente**: 0.81  
**Razonamiento**: Descripción incluye "servicios profesionales" de forma explícita; baja ambigüedad.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

### Caso 5
**Descripción/Merchant (sanitizado)**: Compra - Supermercado  
**Categoría sugerida**: Alimentos y Bebidas  
**Confianza del agente**: 0.79  
**Razonamiento**: Keyword "supermercado" es indicador fuerte de categoría alimentaria; confianza moderada-alta.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

### Caso 6
**Descripción/Merchant (sanitizado)**: Pago - Servicios de utilidad pública  
**Categoría sugerida**: Servicios e Impuestos  
**Confianza del agente**: 0.75  
**Razonamiento**: "Servicios de utilidad pública" es término explícito; categoría estándar para servicios fijos.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

### Caso 7
**Descripción/Merchant (sanitizado)**: Transferencia - Persona o Empresa desconocida  
**Categoría sugerida**: Transferencias y Pagos  
**Confianza del agente**: 0.68  
**Razonamiento**: Tipo de movimiento es "transferencia" pero destinatario es ambiguo; categorización genérica con baja confianza.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

### Caso 8
**Descripción/Merchant (sanitizado)**: Compra - Tienda de electrodomésticos  
**Categoría sugerida**: Hogar y Equipamiento  
**Confianza del agente**: 0.82  
**Razonamiento**: "Electrodomésticos" es categoría bien definida; contexto de tienda retail refuerza clasificación.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

### Caso 9
**Descripción/Merchant (sanitizado)**: Pago - Otro (descripción incompleta)  
**Categoría sugerida**: [NO_SUGERENCIA_VÁLIDA]  
**Confianza del agente**: 0.33  
**Razonamiento**: ❌ INVALID_AGENT_CATEGORY - Descripción insuficiente; categoría sugerida no existe en catálogo actual.

**Decisión requerida**: 
- [ ] REQUIERE_INFORMACIÓN_ADICIONAL
- [ ] RECHAZAR_PROPUESTA
- [ ] AMBIGUA_REQUIERE_CONTEXTO

---

### Caso 10
**Descripción/Merchant (sanitizado)**: Compra - Restaurant o comida rápida  
**Categoría sugerida**: Restaurantes y Comida  
**Confianza del agente**: 0.86  
**Razonamiento**: Keywords "restaurant" y "comida" son indicadores muy claros; categoría estándar e inequívoca.

**Decisión requerida**: 
- [ ] CORRECT
- [ ] INCORRECT
- [ ] UNCERTAIN

---

## Instrucciones para Revisión

1. **Para cada propuesta**, evalúa si la categorización tiene sentido para la transacción.
2. **No se requiere ground truth perfecto**: Estas son transacciones que estaban pendientes; tu criterio es válido.
3. **Marcar UNA opción por caso**: CORRECT, INCORRECT, o UNCERTAIN.
4. **Confidencialidad**: Las descripciones ya han sido sanitizadas; no contienen datos sensibles.
5. **Retroalimentación**: Cuando marques INCORRECT, será registrado para mejorar el modelo futuro.

---

## Métricas Posteriores a Revisión

Una vez que completes la revisión, se calcularán:

- **Precisión del piloto**: % de propuestas marcadas como CORRECT
- **Tasa de incertidumbre**: % marcadas como UNCERTAIN  
- **Tasa de rechazo**: % marcadas como INCORRECT
- **Confianza media de propuestas correctas**: Promedio de confidence scores de propuestas validadas

---

## Próximos Pasos

**FASE 07C3 (Diseño solamente, NO implementar aún)**:
- Análisis de patrones de error en propuestas incorrectas
- Ajuste de thresholds de confianza
- Evaluación de necesidad de nuevas categorías
- Estrategia de integración de propuestas validadas

---

**ESTADO**: ✅ FASE 07C2 COMPLETA - Aguardando revisión humana de propuestas
