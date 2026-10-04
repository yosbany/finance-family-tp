#!/usr/bin/env node

import { Agent } from "@cursor/sdk";
import process from "process";
import fs from "fs/promises";

// 10 candidatos reales del Firebase
const CASOS_REALES = [
  { id: "A1", description: "ASISTENCIA 365" },
  { id: "A2", description: "MIX UP (1/3)" },
  { id: "A3", description: "DREAMSTORE OCA (1/3)" },
  { id: "A4", description: "RETIRO CORRESPONSALES, MONTEVIDEO" },
  { id: "A5", description: "COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO" },
  { id: "A6", description: "COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO" },
  { id: "A7", description: "COMPRA CON TARJETA DEBITO COMPADRE, MONTEVIDEO" },
  { id: "A8", description: "DEBITO OPERACION EN BANCA DIGITAL P--" },
  { id: "A9", description: "DEBITO OPERACION EN BANCA DIGITAL P--" },
  { id: "A10", description: "DEBITO OPERACION EN BANCA DIGITAL PCREDITO" },
];

// 14 categorías válidas
const CATEGORIAS_VALIDAS = [
  "Alimentación",
  "Salud y Bienestar",
  "Educación",
  "Entretenimiento",
  "Transporte",
  "Servicios y Utilidades",
  "Ropa y Accesorios",
  "Vivienda",
  "Diversión y Ocio",
  "Ingresos",
  "Reingreso IVA",
  "Sueldos",
  "Transferencias",
  "Otros",
];

async function procesarCaso(caso) {
  const prompt = `Analiza la siguiente descripción de transacción financiera y sugiere UNA categoría de la lista exacta proporcionada.

Descripción: "${caso.description}"

Categorías válidas (elige SOLO de esta lista):
${CATEGORIAS_VALIDAS.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Responde en JSON únicamente con esta estructura (sin explicaciones adicionales):
{
  "status": "SUGGESTED" | "UNCERTAIN" | "INVALID_CATEGORY",
  "suggestedCategory": "nombre exacto de categoría" | null,
  "agentConfidence": 0.0-1.0,
  "reasoningSummary": "breve razón (máximo 20 palabras)"
}`;

  try {
    // Try cloud first with explicit API key handling
    const apiKey = process.env.CURSOR_API_KEY;
    const result = await Agent.prompt(prompt, {
      model: "ibm-ica",
      apiKey: apiKey,
      cloud: { repos: ["yosbany/finance-family"] },
    });

    if (result.status !== "finished") {
      return {
        status: "ERROR",
        error: `Run failed with status: ${result.status}`,
      };
    }

    // Parsear texto de resultado
    let responseText = result.result || "";

    if (!responseText) {
      return {
        status: "ERROR",
        error: "No text response from agent",
      };
    }

    // Parsear JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        status: "ERROR",
        error: "No JSON found in response",
        rawResponse: responseText.substring(0, 200),
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validar estructura
    if (
      !parsed.status ||
      !["SUGGESTED", "UNCERTAIN", "INVALID_CATEGORY"].includes(parsed.status)
    ) {
      return {
        status: "ERROR",
        error: "Invalid status value",
        rawResponse: parsed,
      };
    }

    // Si el status es SUGGESTED, validar que la categoría esté en la lista
    if (parsed.status === "SUGGESTED") {
      if (!parsed.suggestedCategory) {
        return {
          status: "ERROR",
          error: "SUGGESTED status pero sin suggestedCategory",
          rawResponse: parsed,
        };
      }

      if (!CATEGORIAS_VALIDAS.includes(parsed.suggestedCategory)) {
        parsed.status = "INVALID_CATEGORY";
        parsed.originalSuggestion = parsed.suggestedCategory;
        parsed.suggestedCategory = null;
      }
    }

    return parsed;
  } catch (error) {
    return {
      status: "ERROR",
      error: error.message,
      caseId: caso.id,
    };
  }
}

async function main() {
  console.log("🚀 Iniciando FASE 07C3C — Piloto LLM Real\n");
  console.log(`📋 Procesando ${CASOS_REALES.length} casos\n`);

  const agentResultados = {};
  let llmCallsReal = 0;
  let suggested = 0;
  let uncertain = 0;
  let invalidCategory = 0;
  let errors = 0;

  // Procesar secuencialmente
  for (const caso of CASOS_REALES) {
    console.log(`\n📍 Procesando: ${caso.id} — "${caso.description}"`);

    const resultado = await procesarCaso(caso);

    if (resultado.status === "ERROR") {
      console.log(`❌ Error: ${resultado.error}`);
      errors++;
    } else {
      console.log(`✓ Status: ${resultado.status}`);
      if (resultado.suggestedCategory) {
        console.log(`  → Categoría: ${resultado.suggestedCategory}`);
      }
      console.log(`  → Confianza: ${resultado.agentConfidence}`);
      console.log(`  → Razón: ${resultado.reasoningSummary}`);

      if (resultado.status === "SUGGESTED") {
        suggested++;
      } else if (resultado.status === "UNCERTAIN") {
        uncertain++;
      } else if (resultado.status === "INVALID_CATEGORY") {
        invalidCategory++;
      }

      llmCallsReal++;
    }

    agentResultados[caso.id] = resultado;
  }

  const processed = CASOS_REALES.length - errors;

  // Validar invariante
  const invariante =
    suggested + uncertain + invalidCategory === processed ? "✓" : "✗";

  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("📊 RESULTADOS FINALES");
  console.log("═══════════════════════════════════════════════════════════\n");

  const resultado_final = {
    histórico_exacto: {
      status: "Información histórica desde ejecuciones anteriores",
      nota: "Ver FASE_07C3B_REAL_EXTRACTION.json para detalles",
    },
    agente_resultados: agentResultados,
    métricas: {
      processed,
      suggested,
      uncertain,
      invalidCategory,
      errors,
      llmCallsReal,
      invariante_válida: invariante === "✓",
    },
    estado: "VALIDACIÓN_HUMANA_LISTA",
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(resultado_final, null, 2));

  // Guardar a archivo
  const outputPath = "./docs/FASE_07C3C_PILOTO_LLM_REAL.json";
  await fs.writeFile(outputPath, JSON.stringify(resultado_final, null, 2));

  console.log(`\n✅ Resultados guardados en: ${outputPath}`);
  console.log(
    `\n${invariante} Invariante validada: ${suggested + uncertain + invalidCategory} = ${processed}`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
