#!/usr/bin/env node

/**
 * Diagnóstico de Configuración FASE 05B
 * 
 * Ejecuta una serie de pruebas para determinar:
 * 1. Si NRD_LLM_API_KEY está disponible
 * 2. Si el endpoint LLM está accesible
 * 3. Qué modelo se detecta como disponible
 * 4. Si tool calling es soportado
 * 
 * Uso:
 * 1. Con clave en env:
 *    export NRD_LLM_API_KEY="sk-..."
 *    node diagnose-llm-setup.mjs
 * 
 * 2. O proporciona en CLI:
 *    node diagnose-llm-setup.mjs sk-...
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';

const LLM_BASE_URL = process.env.NRD_LLM_BASE_URL || 'https://model.nrdonline.site/v1';
let LLM_API_KEY = process.env.NRD_LLM_API_KEY || process.argv[2];

console.log('================================================================================');
console.log('DIAGNÓSTICO FASE 05B — Verificación LLM + Tool Calling');
console.log('================================================================================\n');

console.log(`Base URL: ${LLM_BASE_URL}`);
console.log(`API Key: ${LLM_API_KEY ? `${LLM_API_KEY.substring(0, 10)}...` : 'NO DISPONIBLE'}`);
console.log();

if (!LLM_API_KEY) {
  console.error('❌ ERROR: NRD_LLM_API_KEY no está disponible');
  console.error();
  console.error('Soluciones:');
  console.error('1. Proporcionar en variable de entorno:');
  console.error('   export NRD_LLM_API_KEY="sk-..."');
  console.error('   node diagnose-llm-setup.mjs');
  console.error();
  console.error('2. O proporcionar como argumento:');
  console.error('   node diagnose-llm-setup.mjs sk-...');
  console.error();
  console.error('3. O agregar a /etc/finance-family-api/finance-family-api.env en VPS:');
  console.error('   echo "NRD_LLM_API_KEY=sk-..." >> /etc/finance-family-api/finance-family-api.env');
  process.exit(1);
}

async function testEndpoint(endpoint, method = 'GET', body = null, expectToolCalls = false) {
  try {
    const response = await fetch(`${LLM_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

async function main() {
  let passCount = 0;
  let failCount = 0;

  // TEST 1: /models endpoint
  console.log('TEST 1️⃣ : /v1/models (Detectar modelos disponibles)');
  console.log('─────────────────────────────────────────────────────────────────');
  const modelsRes = await testEndpoint('/models');
  
  if (modelsRes.error) {
    console.log(`❌ Error de conexión: ${modelsRes.error}`);
    failCount++;
  } else if (!modelsRes.ok) {
    console.log(`❌ HTTP ${modelsRes.status}`);
    console.log(`   Response: ${JSON.stringify(modelsRes.data).substring(0, 200)}`);
    failCount++;
  } else {
    console.log(`✅ HTTP 200 OK`);
    if (modelsRes.data.data && Array.isArray(modelsRes.data.data)) {
      console.log(`   Modelos disponibles: ${modelsRes.data.data.length}`);
      const modelIds = modelsRes.data.data.map(m => m.id);
      modelIds.slice(0, 5).forEach((id, i) => {
        console.log(`   ${i + 1}. ${id}`);
      });
      if (modelIds.length > 5) {
        console.log(`   ... y ${modelIds.length - 5} más`);
      }
      console.log(`\n   🎯 PRIMER MODELO (a usar): ${modelIds[0]}`);
      passCount++;
    } else {
      console.log(`⚠️ Estructura inesperada:`);
      console.log(`   ${JSON.stringify(modelsRes.data, null, 2).substring(0, 300)}`);
      failCount++;
    }
  }
  console.log();

  // TEST 2: Simple chat completion
  console.log('TEST 2️⃣ : /v1/chat/completions (Sin tools)');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const modelId = modelsRes.data?.data?.[0]?.id || 'gpt-4-turbo';
  const chatRes = await testEndpoint('/chat/completions', 'POST', {
    model: modelId,
    messages: [
      {
        role: 'user',
        content: 'Responde con una palabra: financiero',
      },
    ],
    temperature: 0.7,
    max_tokens: 20,
  });

  if (chatRes.error) {
    console.log(`❌ Error de conexión: ${chatRes.error}`);
    failCount++;
  } else if (!chatRes.ok) {
    console.log(`❌ HTTP ${chatRes.status}`);
    console.log(`   Response: ${JSON.stringify(chatRes.data).substring(0, 200)}`);
    failCount++;
  } else {
    console.log(`✅ HTTP 200 OK`);
    if (chatRes.data.choices?.[0]?.message?.content) {
      const content = chatRes.data.choices[0].message.content;
      console.log(`   Respuesta: "${content.substring(0, 100)}"`);
      passCount++;
    } else {
      console.log(`⚠️ Estructura inesperada`);
      console.log(`   ${JSON.stringify(chatRes.data, null, 2).substring(0, 300)}`);
      failCount++;
    }
  }
  console.log();

  // TEST 3: Tool calling
  console.log('TEST 3️⃣ : /v1/chat/completions (CON tools - searchTransactions)');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const toolRes = await testEndpoint('/chat/completions', 'POST', {
    model: modelId,
    messages: [
      {
        role: 'user',
        content: 'Busca mis transacciones de septiembre.',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'searchTransactions',
          description: 'Search transactions by date range and filters',
          parameters: {
            type: 'object',
            properties: {
              from: { 
                type: 'integer', 
                description: 'Start timestamp in milliseconds' 
              },
              to: { 
                type: 'integer', 
                description: 'End timestamp in milliseconds' 
              },
              limit: { 
                type: 'integer', 
                description: 'Max results' 
              },
              description: { 
                type: 'string', 
                description: 'Text search' 
              },
              minAmount: { 
                type: 'number', 
                description: 'Minimum amount' 
              },
              maxAmount: { 
                type: 'number', 
                description: 'Maximum amount' 
              },
            },
            required: ['from', 'to'],
          },
        },
      },
    ],
    tool_choice: 'auto',
  });

  if (toolRes.error) {
    console.log(`❌ Error de conexión: ${toolRes.error}`);
    failCount++;
  } else if (!toolRes.ok) {
    console.log(`❌ HTTP ${toolRes.status}`);
    console.log(`   Response: ${JSON.stringify(toolRes.data).substring(0, 200)}`);
    failCount++;
  } else {
    console.log(`✅ HTTP 200 OK`);
    const choice = toolRes.data.choices?.[0];
    
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      console.log(`✅ TOOL CALLING SOPORTADO`);
      choice.message.tool_calls.forEach((tc, i) => {
        console.log(`   ${i + 1}. Tool: ${tc.function.name}`);
        console.log(`      Args: ${JSON.stringify(tc.function.arguments).substring(0, 100)}`);
      });
      passCount++;
    } else {
      console.log(`⚠️ Sin tool calls (puede ser normal si LLM decidió no usarlas)`);
      if (choice?.message?.content) {
        console.log(`   Respuesta: "${choice.message.content.substring(0, 100)}"`);
      }
      passCount++; // No es un fallo, solo información
    }
  }
  console.log();

  // RESUMEN
  console.log('================================================================================');
  console.log('RESUMEN DIAGNÓSTICO');
  console.log('================================================================================\n');
  
  console.log(`✅ Tests exitosos: ${passCount}`);
  console.log(`❌ Tests fallidos: ${failCount}`);
  console.log();

  if (failCount === 0) {
    console.log('🎉 EXCELENTE: Todo funciona correctamente');
    console.log();
    console.log('Próximos pasos:');
    console.log(`1. Usa modelo: ${modelId}`);
    console.log('2. Configura en VPS:');
    console.log('   NRD_LLM_BASE_URL=https://model.nrdonline.site/v1');
    console.log(`   NRD_LLM_API_KEY=${LLM_API_KEY}`);
    console.log(`   NRD_LLM_MODEL=${modelId}`);
    console.log('3. Ejecuta: ./FASE_05B_DEPLOY.sh');
  } else {
    console.log('⚠️ PROBLEMAS DETECTADOS');
    console.log();
    console.log('Posibles soluciones:');
    console.log('1. Verificar API key es válida');
    console.log('2. Verificar endpoint LLM está activo');
    console.log('3. Verificar conexión de red');
    console.log('4. Contactar soporte LLM');
  }
  console.log();

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
