# PLAN FASE 03 — Carga Masiva + Resolución Segura

## Objetivos

1. ✅ Permitir seleccionar/arrastrar múltiples archivos
2. ✅ Analizar sin persistir datos
3. ✅ Mostrar solo excepciones
4. ✅ Importar automáticamente los READY
5. ✅ Permitir corrección de campos ambiguos
6. ✅ No persistir si hay errores previos

## Análisis de Componentes Existentes

### UploadStatements.tsx (Actual)

**Estructura**: Wizard lineal de 4 pasos

```
PASO 1: Seleccionar Banco
   ↓
PASO 2: Tipo de Cuenta
   ↓
PASO 3: Cuenta Específica
   ↓
PASO 4: Cargar Archivo
```

**Problema**: Un archivo a la vez, el wizard espera interacción manual en cada paso.

### Servicios Existentes

- ✅ `importStatements.service.ts` — Importa 1 archivo (reutilizable)
- ✅ `contextDetection.service.ts` — Detecta contexto (mejorado en FASE 02)
- ✅ `uploadHistory.service.ts` — Maneja historial y duplicados
- ✅ `checkDuplicateUpload()` — Verifica SHA-256

### Nuevos Servicios (FASE 03)

- ✅ `batchImport.service.ts` — Orquesta análisis/importación batch (ya creado)
- ✅ Tipos en `batchImport.ts` — Estados y estructuras (ya creado)

---

## Estrategia de Implementación

### OPCIÓN A: Componente Nuevo (Recomendado)

Crear `BatchUpload.tsx` que coexista con `UploadStatements.tsx`

**Ventajas**:
- No romper funcionalidad existente
- Gradualmente deprecar wizard viejo
- Usuario elige entre UI antigua o nueva

**Desventajas**:
- Mantener dos flujos

### OPCIÓN B: Refactorizar UploadStatements.tsx

Modificar el componente existente para soportar ambos modos

**Ventajas**:
- Una sola UI
- Menos código

**Desventajas**:
- Riesgo de romper algo
- Componente muy complejo

## DECISIÓN: OPCIÓN A (Componente Nuevo)

Crearemos `BatchUpload.tsx` independiente que:

1. Permite drag&drop de múltiples archivos
2. Muestra tabla de estado
3. Separa ANALYZE e IMPORT
4. Permite confirmar campos antes de importar

---

## Flujo de Uso

### 1. FASE ANALYZE

```
Usuario arrastra/selecciona N archivos
        ↓
Mostrar: "Analizando..."
        ↓
Para cada archivo:
  - Detectar contexto
  - Verificar duplicados
  - Determinar estado (READY/NEEDS_CONFIRMATION/DUPLICATE/FAILED)
        ↓
Mostrar tabla:
  ✓ Archivo 1    READY           listo
  ⚠ Archivo 2    NEEDS_CONFIRMATION    confirmar período
  🔄 Archivo 3   DUPLICATE       saltear
  ✕ Archivo 4    FAILED          error detectado
```

### 2. FASE CONFIRMACIÓN (condicional)

```
Si hay archivos NEEDS_CONFIRMATION:
        ↓
Mostrar modal para cada uno:
  
  "Archivo 2: estado_cuenta_20260812 - julio.xlsx"
  
  Banco:      ? [detectado: BROU]         ✓
  Período:    ? [detectado: 7/2026]       ✓
  Cuenta:     ? [no detectado]            ⚠ [Selector: BROU débito ▼]
  Moneda:     ? [detectado: UYU]          ✓
  
  [Confirmar]  [Cancelar]
```

### 3. FASE IMPORT

```
Usuario presiona: "Importar Listos"
        ↓
Mostrar: "Importando 5 archivos..."
        ↓
Para cada archivo READY o CONFIRMED:
  - Llamar importStatement()
  - Mostrar progreso
        ↓
Resultado final:
  ✓ 7 importados
  🔄 1 duplicado (no importado)
  ✕ 1 falló
  ⚠ 1 requiere revisión (confirmación pendiente)
```

---

## Estructura del Componente BatchUpload.tsx

### Estado Principal

```typescript
const [batchState, setBatchState] = useState<BatchImportState>(() => 
  createInitialBatchState()
);

const [files, setFiles] = useState<BatchFileInfo[]>([]);
const [phase, setPhase] = useState<'INPUT' | 'ANALYZING' | 'CONFIRMING' | 'IMPORTING' | 'COMPLETE'>('INPUT');
const [selectedFileForConfirmation, setSelectedFileForConfirmation] = useState<BatchFileInfo | null>(null);
```

### Handlers Principales

```typescript
// 1. Agregar archivos (click o drag&drop)
const handleFilesSelected = async (selectedFiles: File[]) => {
  const newFiles = selectedFiles.map(createBatchFileInfo);
  setFiles(prev => [...prev, ...newFiles]);
};

// 2. Analizar archivos
const handleAnalyzeAll = async () => {
  setPhase('ANALYZING');
  
  const analyzed = await Promise.all(
    files.map(f => analyzeFileForBatch(f, accounts, user?.uid))
  );
  
  setFiles(analyzed);
  
  const needsConfirm = analyzed.filter(f => f.state === 'NEEDS_CONFIRMATION');
  if (needsConfirm.length > 0) {
    setPhase('CONFIRMING');
    setSelectedFileForConfirmation(needsConfirm[0]);
  } else {
    setPhase('IMPORTING');
  }
};

// 3. Confirmar campo
const handleConfirmField = (fileId: string, confirmation: Partial<FileConfirmation>) => {
  setFiles(prev => prev.map(f => {
    if (f.id === fileId) {
      return updateFileConfirmation(f, confirmation);
    }
    return f;
  }));
  
  // Ir al siguiente archivo NEEDS_CONFIRMATION
  const remaining = files.find(f => f.state === 'NEEDS_CONFIRMATION');
  if (remaining) {
    setSelectedFileForConfirmation(remaining);
  } else {
    setPhase('IMPORTING');
  }
};

// 4. Importar
const handleImportAll = async () => {
  setPhase('IMPORTING');
  
  const ready = getReadyFilesForImport(files);
  
  const imported = await Promise.all(
    ready.map(f => importBatchFile(f, f.userConfirmation?.accountId || selectedAccount, account, accounts, user?.uid))
  );
  
  setFiles(prev => prev.map(old => imported.find(i => i.id === old.id) || old));
  setPhase('COMPLETE');
};
```

### Vistas

#### Vista INPUT
```
┌─────────────────────────────────────────┐
│  Cargar Extractos (Carga Múltiple)      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                         │
│  [Arrastra aquí o] [Seleccionar]        │
│   haz clic para seleccionar             │
│   múltiples archivos                    │
│                                         │
│  Archivos seleccionados: 0              │
│  [Analizar]                             │
└─────────────────────────────────────────┘
```

#### Vista ANALYZING
```
Analizando...

Archivo 1/5: estado_cuenta_julio.xlsx
Archivo 2/5: resumen_oca.pdf
...
```

#### Vista CONFIRMING
```
┌─────────────────────────────────────────┐
│  Confirmar: estado_cuenta.xlsx          │
│                                         │
│  Banco:     OCA        ✓ (detectado)    │
│  Período:   07/2026    ✓ (detectado)    │
│  Moneda:    UYU        ✓ (detectado)    │
│  Cuenta:    ?          ⚠ (necesario)    │
│                                         │
│  [OCA Crédito ▼]                       │
│                                         │
│  [← Anterior] [Confirmar] [Siguiente →] │
└─────────────────────────────────────────┘
```

#### Vista IMPORTING
```
Importando... 

✓ Archivo 1: 25 transacciones
⏳ Archivo 2: procesando...
⏳ Archivo 3: procesando...
```

#### Vista COMPLETE
```
╔═══════════════════════════════════════╗
║       RESUMEN DE CARGA MASIVA         ║
╠═══════════════════════════════════════╣
║ ✓ Importados:         7               ║
║ 🔄 Duplicados:        1               ║
║ ✕ Fallos:             1               ║
║ ⚠ Requieren revisión: 1               ║
╚═══════════════════════════════════════╝

[Ver transacciones] [Nuevauscarga]
```

---

## Archivos a Crear/Modificar

### Crear
- ✅ `src/types/batchImport.ts` (ya creado)
- ✅ `src/services/batchImport.service.ts` (ya creado)
- ⏳ `src/components/transactions/BatchUpload.tsx` (nuevo componente)

### Modificar
- ✅ `src/services/contextDetection.service.ts` (ya corregido en FASE 02)
- ⏳ `src/components/transactions/UploadStatements.tsx` (agregar botón para "Carga Múltiple")

### No Modificar
- `src/services/importStatements.service.ts` (funciona como está)
- `src/services/uploadHistory.service.ts` (funciona como está)
- Otros servicios existentes

---

## Consideraciones de Seguridad

✅ **Archivos procesados localmente** — Todo en el navegador

✅ **Nada enviado a LLM** — Solo análisis local

✅ **Duplicados detectados previo a importación** — Uso SHA-256 existente

✅ **Identidad desde usuario autenticado** — Mismo mecanismo que hoy

✅ **Ningún secreto nuevo en frontend** — Solo usa credenciales existentes

✅ **Firebase Rules como barrera** — No cambia

---

## Secuencia de Implementación

1. ✅ Tipos (batchImport.ts)
2. ✅ Servicio (batchImport.service.ts)
3. ✅ Corrección de detección (contextDetection.service.ts) — FASE 02
4. ⏳ Componente BatchUpload.tsx
5. ⏳ Tests manuales contra /extraxtos
6. ⏳ Validación build/tsc/lint

---

## Criterio de Completitud

✅ Puede seleccionar varios extractos a la vez
✅ Aplicación analiza cada uno sin persistir datos
✅ Importa automáticamente los que tienen contexto suficiente
✅ Solamente pide intervención sobre archivos ambiguos
✅ Build, TypeScript, lint sin errores
✅ Tabla final con todos los archivos procesados
✅ NO hay persistencia de datos intermedios en Firefox

---

## Riesgos Identificados

1. **Performance**: Si se suben 100 archivos, ¿se bloquea UI?
   - Solución: Procesar en chunks, mostrar progreso

2. **Errores de parser**: Si un parser falla, ¿se detiene todo?
   - Solución: Try/catch por archivo, continuar con siguiente

3. **Storage/RAM**: Archivos muy grandes en memoria
   - Solución: Procesar y liberar de a uno

4. **Combinación de cuentas**: Archivos de diferentes cuentas
   - Solución: El usuario selecciona cuenta por defecto, pero puede cambiar por archivo

---

## Próxima Fase (FASE 04)

- Agregar agente para categorización automática mejorada
- Integrar LLM para recomendaciones
- Crear presupuestos automáticos

**NO hacer en FASE 03**:
- Conectar LLM
- Crear backend
- Generar recomendaciones financieras
- Modificar categorías
- Agregar funcionalidades no relacionadas

