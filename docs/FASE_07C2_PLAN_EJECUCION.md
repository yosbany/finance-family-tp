# FASE 07C2 — PLAN DE EJECUCIÓN

**Fecha:** 3 de Octubre 2026
**Estado:** BLOQUEADO POR ACCESO A FIREBASE
**Objetivo:** Ejecutar pipeline real sobre las 76 transacciones pendientes

---

## 🔴 BLOQUEADOR IDENTIFICADO

**Problema:** No puedo acceder a Firebase directamente desde aquí.

Las transacciones pendientes viven en:
```
{familyRoot}/transactions/{transactionId}
```

Necesito que desde tu entorno ejecutes el siguiente script para exportar los datos reales:

---

## 📋 PASO 1: EXPORTAR DATOS REALES DE FIREBASE

### Script de Exportación:

```bash
# Asegúrate de que estas variables estén configuradas en tu entorno:
export FIREBASE_PROJECT_ID="..."
export FIREBASE_DATABASE_URL="..."
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/al/firebase-service-account.json"

# Luego ejecuta este comando desde la carpeta del proyecto:
cd /Users/yosbanytejas/Documents/finance-family

# Descarga el dump de Firebase (si tienes acceso)
firebase database:get / > /tmp/firebase-dump.json

# O usa este script Node para exportar solo las transacciones:
```

### Script Node (ALTERNATIVA):

```bash
cat > /tmp/export-transactions.js << 'EOF'
require('dotenv').config();
const admin = require('firebase-admin');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccount) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_PATH no configurada');
  process.exit(1);
}

const creds = JSON.parse(require('fs').readFileSync(serviceAccount));

admin.initializeApp({
  credential: admin.credential.cert(creds),
  projectId: creds.project_id,
  databaseURL: `https://${creds.project_id}-default-rtdb.firebaseio.com`
});

const db = admin.database();

async function exportTransactions() {
  try {
    // Obtener el familyRoot del usuario autorizado
    const authRef = db.ref('authorizedUsers');
    const authSnap = await authRef.once('value');
    const authData = authSnap.val();
    
    if (!authData) {
      console.error('No authorized users found');
      process.exit(1);
    }

    // Tomar el primer usuario autorizado
    const firstUid = Object.keys(authData)[0];
    const familyRoot = authData[firstUid].familyRoot || 'family';

    console.log(`📍 Usando familyRoot: ${familyRoot}`);

    // Obtener todas las transacciones
    const txRef = db.ref(`${familyRoot}/transactions`);
    const txSnap = await txRef.once('value');
    const transactions = txSnap.val() || {};

    const transactionsArray = Object.entries(transactions).map(([id, data]) => ({
      id,
      ...data
    }));

    // Estadísticas
    const pending = transactionsArray.filter(t => t.status === 'pending');
    const classified = transactionsArray.filter(t => t.status === 'classified');

    console.log(`\n📊 DATASET REAL:`);
    console.log(`  Total: ${transactionsArray.length}`);
    console.log(`  Clasificadas: ${classified.length}`);
    console.log(`  Pendientes: ${pending.length}`);
    console.log(`  Categorías únicas: ${new Set(classified.map(t => t.category)).size}`);

    // Exportar a JSON
    const output = {
      exported: new Date().toISOString(),
      dataset: {
        total: transactionsArray.length,
        classified: classified.length,
        pending: pending.length,
        categories: new Set(classified.map(t => t.category)).size
      },
      transactions: transactionsArray
    };

    require('fs').writeFileSync(
      '/tmp/transactions-real.json',
      JSON.stringify(output, null, 2)
    );

    console.log(`\n✅ Exportadas ${transactionsArray.length} transacciones a /tmp/transactions-real.json`);

    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

exportTransactions();
EOF

cd /Users/yosbanytejas/Documents/finance-family
node /tmp/export-transactions.js
```

---

## 📋 PASO 2: EJECUTAR PIPELINE REAL

Una vez que tengas el archivo `transactions-real.json` con los datos reales:

```bash
# Copiar el archivo a la carpeta del proyecto
cp /tmp/transactions-real.json /Users/yosbanytejas/Documents/finance-family/test-data-fase07c2.json

# Ejecutar el script del pipeline (necesita compilación)
cd /Users/yosbanytejas/Documents/finance-family

# Opción A: Compilar el test script
npx tsx scripts/test-fase07c2.ts

# Opción B: Compilar directamente en el backend (recomendado)
cd apps/backend/server
npm run build
node dist/test-fase07c2.js
```

---

## 🎯 RESULTADO ESPERADO

El script generará un reporte con la estructura:

```json
{
  "timestamp": "2026-10-03T...",
  "dataset": {
    "total": 672,
    "categorized": 596,
    "pending": 76,
    "categories": 14
  },
  "funnel": {
    "total": 76,
    "historical_exact": X,
    "historical_consensus": Y,
    "none": Z
  },
  "results": [
    {
      "transactionId": "tx-123",
      "suggestedCategoryId": "cat-456",
      "source": "historical_exact",
      "confidence": 1.0,
      "reason": "..."
    },
    ...
  ]
}
```

---

## 📊 MÉTRICAS FINALES QUE NECESITAMOS

```
1. DATASET ACTUAL:
   - total (debería ser ~672)
   - categorized (debería ser ~596)
   - pending (debería ser ~76)
   - categories (debería ser ~14)

2. FUNNEL REAL:
   - HISTORICAL_EXACT: X transacciones
   - HISTORICAL_CONSENSUS: Y transacciones
   - NONE: Z transacciones
   - TOTAL = X + Y + Z = 76

3. RATE DE RESOLUCIÓN:
   - Resueltas = X + Y
   - % = (Resueltas / 76) * 100

4. ANÁLISIS DE RESTANTES:
   - Listar todas las transacciones sin sugerencia
   - Clasificarlas manualmente en:
     - SEMANTIC (descripción clara)
     - AMBIGUOUS (podría ser varias categorías)
     - OPAQUE (sin contexto suficiente)

5. CANDIDATES PARA AGENTE:
   - agentCandidateCount = SEMANTIC + parte de AMBIGUOUS
   - máximo 10 para pilot LLM
```

---

## 📝 ACCIONES REQUERIDAS

### Tu lado (usuario):

1. **Obtener credenciales de Firebase**
   - Ubicación: Probablemente en `~/.config/gcloud/` o `~/.credentials/`
   - O en el .env del proyecto backend

2. **Ejecutar exportación:**
   ```bash
   cd /Users/yosbanytejas/Documents/finance-family
   # Primero: identifica dónde están las credenciales
   echo $GOOGLE_APPLICATION_CREDENTIALS
   
   # Luego ejecuta el script de exportación
   node /tmp/export-transactions.js
   ```

3. **Confirmar que tienes el archivo:**
   ```bash
   ls -lh /tmp/transactions-real.json
   jq '.dataset' /tmp/transactions-real.json
   ```

4. **Decirme los números reales**
   - Cuántas transacciones totales
   - Cuántas clasificadas
   - Cuántas pendientes

---

## 🔄 FLUJO COMPLETO FASE 07C2

```
┌─────────────────────────────────────┐
│ 1. EXPORTAR FIREBASE (TÚ)           │
│ → transactions-real.json             │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│ 2. VERIFICAR DATOS                  │
│ → dataset.total/pending/classified   │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│ 3. EJECUTAR PIPELINE                │
│ → Procesar 76 pendientes             │
│ → Medir funnel real                 │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│ 4. GENERAR REPORTE                  │
│ → FASE_07C2_RESULTADOS_REALES.md    │
│ → Números definitivos                │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│ 5. DECIDIR SIGUIENTES PASOS         │
│ → ¿RULES necesario?                  │
│ → ¿AGENT para restantes?             │
│ → ¿Qué UI mostrar en 07C3?          │
└─────────────────────────────────────┘
```

---

## ❓ PRÓXIMAS PREGUNTAS

### Si tienes acceso a Firebase:
```bash
# 1. Verifica la conexión:
firebase --version

# 2. Exporta los datos:
firebase database:get / > /tmp/firebase-export.json

# 3. Verifica la estructura:
cat /tmp/firebase-export.json | jq 'keys' | head -20
```

### Si NO tienes acceso a Firebase:
- Necesitarás credenciales: `GOOGLE_APPLICATION_CREDENTIALS`
- O credenciales de Firebase Admin: service account JSON
- O replicar datos manualmente en test JSON

---

## ✋ ESTADO ACTUAL

**FASE 07C2: BLOQUEADA - Esperando datos reales de Firebase**

Cuando tengas los datos reales, continuaremos con:
1. Ejecución del pipeline
2. Medición del funnel
3. Análisis de restantes
4. Piloto de agente
5. Recomendaciones para UI 07C3

---
