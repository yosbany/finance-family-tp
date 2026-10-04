/**
 * FASE 07C3C — EJECUTAR PILOTO LLM REAL
 * 
 * Ejecuta exactamente 10 llamadas al LLM con los candidatos reales,
 * sin modificar Firebase.
 * 
 * Input: FASE_07C3B_REAL_EXTRACTION.json (10 candidatos)
 * Output: FASE_07C3C_PILOT_RESULTS.json
 */

import { Agent } from '@cursor/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Categorías reales (14)
const VALID_CATEGORIES = [
  'Alimentación',
  'Salud y Bienestar',
  'Educación',
  'Entretenimiento',
  'Transporte',
  'Servicios y Utilidades',
  'Ropa y Accesorios',
  'Vivienda',
  'Diversión y Ocio',
  'Ingresos',
  'Reingreso IVA',
  'Sueldos',
  'Transferencias',
  'Otros'
];

interface LLMCase {
  caseId: string;
  description: string;
  transactionId: string;
}

interface LLMResult {
  caseId: string;
  description: string;
  status: 'SUGGESTED' | 'UNCERTAIN' | 'INVALID_CATEGORY';
  suggestedCategory: string | null;
  agentConfidence: number;
  reasoningSummary: string;
}

async function processCase(agent: Agent, caseData: LLMCase): Promise<LLMResult> {
  const prompt = `
You are a transaction categorization expert. You have exactly these 14 valid categories:
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

Transaction description: "${caseData.description}"

Your task:
1. Analyze this transaction description
2. If you can confidently suggest ONE of the 14 categories, respond with:
   status: SUGGESTED
   suggestedCategory: [category name exactly as listed]
   agentConfidence: [0.0-1.0]
   reasoningSummary: [brief reason, 1-2 sentences]

3. If the description is insufficient to determine category, respond with:
   status: UNCERTAIN
   suggestedCategory: null
   agentConfidence: [0.0-1.0]
   reasoningSummary: [brief reason why]

4. If you suggest a category NOT in the list, respond with:
   status: INVALID_CATEGORY
   suggestedCategory: [the invalid category]
   agentConfidence: [0.0-1.0]
   reasoningSummary: "Category not in valid list"

IMPORTANT:
- Do NOT invent categories
- Do NOT chain-of-thought
- Do NOT discuss other sources
- Respond ONLY with JSON in this exact format:
{
  "status": "SUGGESTED" | "UNCERTAIN" | "INVALID_CATEGORY",
  "suggestedCategory": string | null,
  "agentConfidence": number,
  "reasoningSummary": string
}
`;

  try {
    const response = await agent.prompt(prompt, {
      model: 'ibm-ica',
    });

    const content = response.text;
    
    // Parse JSON response
    let parsed;
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error(`Failed to parse response for ${caseData.caseId}:`, content);
      return {
        caseId: caseData.caseId,
        description: caseData.description,
        status: 'UNCERTAIN',
        suggestedCategory: null,
        agentConfidence: 0,
        reasoningSummary: 'Failed to parse LLM response'
      };
    }

    // Validate category if SUGGESTED
    if (parsed.status === 'SUGGESTED' && parsed.suggestedCategory) {
      if (!VALID_CATEGORIES.includes(parsed.suggestedCategory)) {
        return {
          caseId: caseData.caseId,
          description: caseData.description,
          status: 'INVALID_CATEGORY',
          suggestedCategory: parsed.suggestedCategory,
          agentConfidence: parsed.agentConfidence || 0,
          reasoningSummary: 'Category not in valid list'
        };
      }
    }

    return {
      caseId: caseData.caseId,
      description: caseData.description,
      status: parsed.status,
      suggestedCategory: parsed.suggestedCategory || null,
      agentConfidence: parsed.agentConfidence || 0,
      reasoningSummary: parsed.reasoningSummary || ''
    };
  } catch (error) {
    console.error(`Error processing ${caseData.caseId}:`, error);
    return {
      caseId: caseData.caseId,
      description: caseData.description,
      status: 'UNCERTAIN',
      suggestedCategory: null,
      agentConfidence: 0,
      reasoningSummary: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('FASE 07C3C — EJECUTAR PILOTO LLM REAL SOBRE 10 CANDIDATOS');
    console.log('='.repeat(80) + '\n');

    // Load extraction data
    const extractionPath = path.join(__dirname, '../apps/docs/FASE_07C3B_REAL_EXTRACTION.json');
    if (!fs.existsSync(extractionPath)) {
      throw new Error(`Extraction file not found: ${extractionPath}`);
    }

    const extractionData = JSON.parse(fs.readFileSync(extractionPath, 'utf-8'));
    const historicalExactCases = extractionData.historical_exact_cases || [];
    const llmCandidates: LLMCase[] = extractionData.llm_pilot.candidates || [];

    console.log(`📊 Dataset Real:\n`);
    console.log(`   Total: ${extractionData.dataset.total}`);
    console.log(`   Categorizadas: ${extractionData.dataset.categorized}`);
    console.log(`   Pendientes: ${extractionData.dataset.pending}`);
    console.log(`   Categorías: ${extractionData.dataset.categories}\n`);

    console.log(`🔄 Funnel Real:\n`);
    console.log(`   RULES: ${extractionData.funnel.RULES}`);
    console.log(`   HISTORICAL_EXACT: ${extractionData.funnel.HISTORICAL_EXACT}`);
    console.log(`   HISTORICAL_CONSENSUS: ${extractionData.funnel.HISTORICAL_CONSENSUS}`);
    console.log(`   REMAINING: ${extractionData.funnel.REMAINING}\n`);

    console.log(`📋 HISTORICAL_EXACT (6 casos reales):\n`);
    for (const h of historicalExactCases) {
      console.log(`   ${h.caseId}: ${h.movimiento} → ${h.categoriaSugerida}`);
    }

    console.log(`\n🤖 Ejecutando LLM pilot (${llmCandidates.length} candidatos)...\n`);

    // Initialize Agent
    const agent = new Agent();

    const llmResults: LLMResult[] = [];
    let llmCallsReal = 0;

    for (let i = 0; i < llmCandidates.length; i++) {
      const candidate = llmCandidates[i];
      console.log(`   [${i + 1}/${llmCandidates.length}] Procesando ${candidate.caseId}...`);

      const result = await processCase(agent, candidate);
      llmResults.push(result);
      llmCallsReal++;

      console.log(`      → Status: ${result.status}`);
      console.log(`      → Categoría: ${result.suggestedCategory || 'null'}`);
      console.log(`      → Confianza: ${(result.agentConfidence * 100).toFixed(1)}%`);
    }

    // Calculate metrics
    const processed = llmResults.length;
    const suggested = llmResults.filter(r => r.status === 'SUGGESTED').length;
    const uncertain = llmResults.filter(r => r.status === 'UNCERTAIN').length;
    const invalidCategory = llmResults.filter(r => r.status === 'INVALID_CATEGORY').length;

    console.log(`\n📊 Métricas:\n`);
    console.log(`   Procesados: ${processed}`);
    console.log(`   Sugerencias válidas: ${suggested}`);
    console.log(`   Inciertas: ${uncertain}`);
    console.log(`   Categoría inválida: ${invalidCategory}`);
    console.log(`   Llamadas LLM reales: ${llmCallsReal}\n`);

    if (suggested + uncertain + invalidCategory !== processed) {
      throw new Error(`Invariant failed: ${suggested} + ${uncertain} + ${invalidCategory} != ${processed}`);
    }

    // Final report
    const report = {
      timestamp: new Date().toISOString(),
      phase: 'FASE_07C3C',
      status: 'VALIDACIÓN_HUMANA_LISTA',
      
      dataset: extractionData.dataset,
      funnel: extractionData.funnel,
      
      historical_exact: historicalExactCases,
      
      agent_results: llmResults,
      
      metrics: {
        processed,
        suggested,
        uncertain,
        invalidCategory,
        llmCallsReal
      },
      
      validation_status: 'AWAITING_USER_REVIEW'
    };

    // Save report
    const reportDir = path.join(__dirname, '../docs');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const reportPath = path.join(reportDir, 'FASE_07C3C_PILOT_RESULTS.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ PILOTO LLM COMPLETADO');
    console.log('='.repeat(80) + '\n');

    console.log('📁 Reporte guardado: docs/FASE_07C3C_PILOT_RESULTS.json\n');

    console.log('=== VALIDACIÓN HUMANA LISTA ===\n');
    console.log(`H1-H6: HISTORICAL_EXACT (automáticas, validación manual)`);
    console.log(`A1-A10: AGENT LLM (propuestas reales)\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error(error);
    process.exit(1);
  }
}

main();
