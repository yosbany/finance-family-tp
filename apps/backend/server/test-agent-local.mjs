#!/usr/bin/env node

/**
 * Local Agent Testing
 * 
 * Tests the agent endpoint locally without needing the full LLM setup.
 * For this to work:
 * 1. Start the server: npm run dev
 * 2. Get a valid Firebase ID token
 * 3. Run this script: node test-agent-local.mjs
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3001';
const FIREBASE_ID_TOKEN = process.env.FIREBASE_ID_TOKEN;

if (!FIREBASE_ID_TOKEN) {
  console.error('❌ Error: FIREBASE_ID_TOKEN is required');
  console.error('Set it with: export FIREBASE_ID_TOKEN="your-token"');
  process.exit(1);
}

async function testAgent(message) {
  console.log(`\n📝 Query: "${message}"`);
  console.log('─'.repeat(50));

  try {
    const response = await fetch(`${API_BASE}/api/agent/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIREBASE_ID_TOKEN}`,
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ Error (${response.status}):`);
      console.log(`   ${data.error}: ${data.message}`);
      return;
    }

    console.log('✅ Success');
    console.log(`Answer: ${data.answer}`);
    console.log(`Tools used: ${data.toolsUsed.join(', ') || 'None'}`);
    console.log(`Iterations: ${data.toolIterations}`);
    console.log(`Request ID: ${data.requestId}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🤖 Agent Testing Suite');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Token: ${FIREBASE_ID_TOKEN.substring(0, 10)}...`);
  console.log();

  // Test cases
  const queries = [
    // Case 1: No tool
    '¿Qué tipo de información podés consultar de mis finanzas?',

    // Case 2: Tool usage
    'Mostrame mis transacciones de septiembre de 2026.',

    // Case 3: Filters
    '¿Tuve alguna transacción de más de $10.000 en septiembre?',

    // Case 4: Description
    'Buscá movimientos relacionados con supermercado.',

    // Case 5: No results period
    'Mostrame transacciones de enero del 2020.',

    // Case 6: Aggregation
    '¿Cuánto gasté en total este mes?',
  ];

  for (const query of queries) {
    await testAgent(query);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Test suite complete');
}

main().catch(console.error);
