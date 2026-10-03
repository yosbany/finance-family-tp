#!/usr/bin/env node

/**
 * Verify LLM API Compatibility
 * 
 * Tests the real LLM API to determine:
 * - Endpoint availability
 * - Model list
 * - Chat completions format
 * - Tool calling support
 * - Required authentication
 */

import fetch from 'node-fetch';

const LLM_BASE_URL = process.env.NRD_LLM_BASE_URL || 'https://model.nrdonline.site/v1';
const LLM_API_KEY = process.env.NRD_LLM_API_KEY;

if (!LLM_API_KEY) {
  console.error('❌ Error: NRD_LLM_API_KEY is required');
  process.exit(1);
}

async function request(endpoint, method = 'GET', body = null) {
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
  console.log('🔍 Verifying LLM API Compatibility\n');
  console.log(`Base URL: ${LLM_BASE_URL}`);
  console.log(`API Key: ${LLM_API_KEY.substring(0, 10)}...`);
  console.log();

  // Test 1: /models
  console.log('1️⃣  Testing /v1/models');
  const modelsRes = await request('/models');
  if (modelsRes.error) {
    console.log(`   ❌ Error: ${modelsRes.error}`);
  } else if (!modelsRes.ok) {
    console.log(`   ❌ Status: ${modelsRes.status}`);
    console.log(`   Response:`, JSON.stringify(modelsRes.data, null, 2).substring(0, 200));
  } else {
    console.log(`   ✅ Status: ${modelsRes.status}`);
    if (modelsRes.data.data && Array.isArray(modelsRes.data.data)) {
      console.log(`   Models available: ${modelsRes.data.data.length}`);
      modelsRes.data.data.slice(0, 3).forEach((m) => {
        console.log(`     - ${m.id}`);
      });
    } else {
      console.log(`   Response structure:`, JSON.stringify(modelsRes.data, null, 2).substring(0, 300));
    }
  }
  console.log();

  // Test 2: Simple chat completion
  console.log('2️⃣  Testing /v1/chat/completions');
  const chatRes = await request('/chat/completions', 'POST', {
    model: 'gpt-4-turbo', // This may not be the real model
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: 'Hello',
      },
    ],
    temperature: 0.7,
    max_tokens: 100,
  });
  if (chatRes.error) {
    console.log(`   ❌ Error: ${chatRes.error}`);
  } else if (!chatRes.ok) {
    console.log(`   ❌ Status: ${chatRes.status}`);
    console.log(`   Response:`, JSON.stringify(chatRes.data, null, 2).substring(0, 300));
  } else {
    console.log(`   ✅ Status: ${chatRes.status}`);
    if (chatRes.data.choices && chatRes.data.choices[0]) {
      console.log(`   Response format: OK`);
      console.log(`   Message content: ${chatRes.data.choices[0].message?.content?.substring(0, 100) || 'N/A'}`);
    } else {
      console.log(`   Response structure:`, JSON.stringify(chatRes.data, null, 2).substring(0, 300));
    }
  }
  console.log();

  // Test 3: Tool calling
  console.log('3️⃣  Testing tool calling');
  const toolRes = await request('/chat/completions', 'POST', {
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'user',
        content: 'Search for transactions',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'searchTransactions',
          description: 'Search transactions',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
          },
        },
      },
    ],
    tool_choice: 'auto',
  });
  if (toolRes.error) {
    console.log(`   ❌ Error: ${toolRes.error}`);
  } else if (!toolRes.ok) {
    console.log(`   ❌ Status: ${toolRes.status}`);
    console.log(`   Response:`, JSON.stringify(toolRes.data, null, 2).substring(0, 300));
  } else {
    console.log(`   ✅ Status: ${toolRes.status}`);
    if (toolRes.data.choices && toolRes.data.choices[0]) {
      const choice = toolRes.data.choices[0];
      if (choice.message?.tool_calls) {
        console.log(`   Tool calling: ✅ SUPPORTED`);
        console.log(`   Tool calls in response: ${choice.message.tool_calls.length}`);
      } else {
        console.log(`   Tool calling: Responded without tool calls (might be OK)`);
      }
    }
  }
  console.log();

  console.log('✅ Verification complete');
  console.log();
  console.log('Summary:');
  console.log('- If /models endpoint returns data, use the first model from that list');
  console.log('- If /chat/completions works, tool calling is likely supported');
  console.log('- Adjust the orchestrator model selection based on real /models response');
}

main().catch(console.error);
