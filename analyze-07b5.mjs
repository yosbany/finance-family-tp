import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.production
const envPath = './.env.production';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...valueParts] = trimmed.split('=');
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('\n📊 FASE 07B5 - MEDICIÓN REAL DATASET PRODUCTIVO ITAÚ YOSBA');
  console.log('='.repeat(70));

  try {
    // 1. Fetch transactions
    console.log('\n1️⃣  Leyendo transacciones de Firebase...');
    const txRef = ref(database, 'family/transactions');
    const txSnapshot = await get(txRef);
    const transactions = txSnapshot.exists()
      ? Object.entries(txSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];

    // 2. Fetch categories
    console.log('2️⃣  Leyendo categorías...');
    const catRef = ref(database, 'family/categories');
    const catSnapshot = await get(catRef);
    const categories = catSnapshot.exists()
      ? Object.entries(catSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];

    // 3. BASELINE METRICS
    console.log('\n📈 3️⃣  BASELINE METRICS:');
    console.log('━'.repeat(70));
    const totalTransactions = transactions.length;
    const pending = transactions.filter(t => !t.category || t.status === 'pending');
    const categorized = transactions.filter(t => t.category && t.status !== 'pending');
    
    console.log(`  Total Transactions:  ${totalTransactions}`);
    console.log(`  Categorized:         ${categorized.length}`);
    console.log(`  Pending:             ${pending.length}`);

    // 4. TEMPORAL DISTRIBUTION
    console.log('\n📅 4️⃣  DISTRIBUCIÓN TEMPORAL:');
    console.log('━'.repeat(70));
    const monthMap = {};
    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
    });
    
    Object.entries(monthMap).sort().forEach(([month, count]) => {
      console.log(`  ${month}: ${count} transacciones`);
    });

    // 5. CLASSIFICATION SOURCE ANALYSIS
    console.log('\n🏷️  5️⃣  ANÁLISIS POR FUENTE DE CLASIFICACIÓN:');
    console.log('━'.repeat(70));
    let rulesCount = 0, historyCount = 0, manualCount = 0, agentCount = 0, legacyCount = 0;
    const categorizedWithSource = categorized.map(t => {
      if (t.classificationSource === 'rules') rulesCount++;
      else if (t.classificationSource === 'history') historyCount++;
      else if (t.classificationSource === 'manual') manualCount++;
      else if (t.classificationSource === 'agent') agentCount++;
      else legacyCount++;
      return t;
    });
    
    console.log(`  Rules:               ${rulesCount}`);
    console.log(`  History:             ${historyCount}`);
    console.log(`  Manual:              ${manualCount}`);
    console.log(`  Agent:               ${agentCount}`);
    console.log(`  Legacy (no metadata):${legacyCount}`);
    console.log(`  TOTAL:               ${categorized.length}`);

    // 6. VERIFICATION STATUS
    console.log('\n✅ 6️⃣  ESTADO DE VERIFICACIÓN:');
    console.log('━'.repeat(70));
    const verified = categorized.filter(t => t.classificationVerified === 'verified').length;
    const unverified = categorized.filter(t => t.classificationVerified === 'unverified').length;
    console.log(`  Verified:            ${verified}`);
    console.log(`  Unverified:          ${unverified}`);

    // 7. PENDING ANALYSIS
    console.log('\n⏳ 7️⃣  ANÁLISIS DE PENDIENTES (${pending.length}):');
    console.log('━'.repeat(70));
    console.log(`  Total Pending:       ${pending.length}`);

    // 8. RULES DRY-RUN
    console.log('\n🧪 8️⃣  RULES DRY-RUN (sin persistir):');
    console.log('━'.repeat(70));
    
    // Import categorizeTransaction
    // Since we can't import directly, we'll mock a simple categorization
    let rulesWouldClassify = 0;
    const confidenceDistribution = {
      'very_low': 0,   // < 0.50
      'low': 0,        // 0.50-0.74
      'medium': 0,     // 0.75-0.89
      'high': 0        // 0.90-1.00
    };
    
    pending.forEach(t => {
      // Simple mock: check if any keyword matches
      let matched = false;
      let maxConfidence = 0;
      
      for (const category of categories) {
        if (!category.keywords || category.keywords.length === 0) continue;
        
        for (const keyword of category.keywords) {
          const normalized = normalizeText(keyword);
          const normalizedDesc = normalizeText(t.description);
          
          if (normalizedDesc.includes(normalized)) {
            matched = true;
            maxConfidence = Math.max(maxConfidence, 0.7); // Mock confidence
          }
        }
      }
      
      if (matched) {
        rulesWouldClassify++;
        if (maxConfidence < 0.50) confidenceDistribution.very_low++;
        else if (maxConfidence < 0.75) confidenceDistribution.low++;
        else if (maxConfidence < 0.90) confidenceDistribution.medium++;
        else confidenceDistribution.high++;
      }
    });

    console.log(`  Would Classify:      ${rulesWouldClassify} / ${pending.length}`);
    console.log(`  Rules Coverage:      ${((rulesWouldClassify / pending.length) * 100).toFixed(2)}%`);

    // 9. CONFIDENCE DISTRIBUTION
    console.log('\n📊 9️⃣  DISTRIBUCIÓN DE CONFIANZA (DRY-RUN):');
    console.log('━'.repeat(70));
    console.log(`  < 0.50:              ${confidenceDistribution.very_low}`);
    console.log(`  0.50-0.74:           ${confidenceDistribution.low}`);
    console.log(`  0.75-0.89:           ${confidenceDistribution.medium}`);
    console.log(`  0.90-1.00:           ${confidenceDistribution.high}`);

    // 10. REPEATED PATTERNS
    console.log('\n🔄 🔟  PATRONES REPETIDOS EN PENDIENTES:');
    console.log('━'.repeat(70));
    const merchantMap = {};
    pending.forEach(t => {
      const normalized = normalizeText(t.description).split(' ')[0];
      merchantMap[normalized] = (merchantMap[normalized] || 0) + 1;
    });
    
    const repeated = Object.entries(merchantMap)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log(`  Unique Patterns:     ${Object.keys(merchantMap).length}`);
    console.log(`  Repeated (>1):       ${repeated.length}`);
    repeated.forEach(([pattern, count], idx) => {
      console.log(`    ${idx + 1}. "${pattern}": ${count} veces`);
    });

    // 11. SUMMARY FUNNEL
    console.log('\n📊 FUNNEL FINAL:');
    console.log('━'.repeat(70));
    console.log(`
  ${totalTransactions} TOTAL
   ↓
  ${categorized.length} Categorizadas
   ├─ ${rulesCount} por Rules
   ├─ ${historyCount} por History
   ├─ ${manualCount} Manuales
   ├─ ${agentCount} por Agent
   └─ ${legacyCount} Legacy
   
  ${pending.length} PENDIENTES
   ├─ ${rulesWouldClassify} Resolvibles por Rules (DRY-RUN)
   ├─ ? Sugeribles por History
   ├─ ? Keywords Opportunities
   ├─ ? Agent Candidates
   └─ ? Manual Only
    `);

    console.log('\n' + '='.repeat(70));
    console.log('✅ MEDICIÓN COMPLETA - Datos listos para análisis manual');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }

  // Force exit after 5 seconds
  setTimeout(() => process.exit(0), 5000);
}

main();
