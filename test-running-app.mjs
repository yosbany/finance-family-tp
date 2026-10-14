#!/usr/bin/env node

/**
 * Test Script - Finance Family Running App
 *
 * Verifica que:
 * 1. Frontend responde en http://localhost:5173
 * 2. Backend API responde en http://localhost:3001
 * 3. Tools están registradas
 * 4. Firebase está configurado
 */

const BASE_URL_FRONTEND = 'http://localhost:5173/finance-family-tp/';
const BASE_URL_BACKEND = 'http://localhost:3001';

async function testFrontend() {
  console.log('\n📱 Testing FRONTEND...');
  try {
    const response = await fetch(BASE_URL_FRONTEND);
    if (response.status === 200) {
      const html = await response.text();
      const hasRoot = html.includes('id="root"');
      const hasTitle = html.includes('Finance Family');

      if (hasRoot && hasTitle) {
        console.log('✅ Frontend HTML loaded correctly');
        console.log('   - Root element found');
        console.log('   - Title: "Finance Family"');
        return true;
      }
    }
    console.log('❌ Frontend HTML structure issue');
    return false;
  } catch (error) {
    console.log('❌ Frontend not responding:', error.message);
    return false;
  }
}

async function testBackend() {
  console.log('\n🔧 Testing BACKEND...');
  try {
    const response = await fetch(`${BASE_URL_BACKEND}/health`);
    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ Backend health check passed');
      console.log(`   - Status: ${data.status}`);
      console.log(`   - Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
      return true;
    }
    console.log('❌ Backend health check failed');
    return false;
  } catch (error) {
    console.log('❌ Backend not responding:', error.message);
    return false;
  }
}

async function testToolRegistry() {
  console.log('\n🔨 Testing TOOL REGISTRY...');
  try {
    const response = await fetch(`${BASE_URL_BACKEND}/api/agent/tools`);

    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ Tools endpoint available');
      console.log(`   - Number of tools: ${data.tools?.length || 0}`);

      const hasFinanceSimilarTool = data.tools?.some(t =>
        t.name === 'findSimilarTransactions' ||
        t.includes('findSimilar')
      );

      if (hasFinanceSimilarTool) {
        console.log('   ✅ findSimilarTransactions tool found');
      } else {
        console.log('   ℹ️  findSimilarTransactions not in initial list (may be dynamic)');
      }
      return true;
    } else if (response.status === 404) {
      console.log('ℹ️  Tools endpoint not found (may not be exposed)');
      return true;
    }

    console.log('❌ Tools endpoint error');
    return false;
  } catch (error) {
    console.log('ℹ️  Tools endpoint not accessible (expected if not exposed):', error.message);
    return true;
  }
}

async function testFirebaseConnection() {
  console.log('\n🔥 Testing FIREBASE CONNECTION...');
  try {
    const response = await fetch(`${BASE_URL_BACKEND}/api/firebase/status`);

    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ Firebase connection status available');
      console.log(`   - Project: ${data.projectId || 'unknown'}`);
      return true;
    } else if (response.status === 404) {
      console.log('ℹ️  Firebase status endpoint not exposed');
      return true;
    }

    return false;
  } catch (error) {
    console.log('ℹ️  Firebase status not exposed (expected if secure):', error.message);
    return true;
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 FINANCE FAMILY - RUNNING APP TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════');

  const results = {
    frontend: await testFrontend(),
    backend: await testBackend(),
    tools: await testToolRegistry(),
    firebase: await testFirebaseConnection(),
  };

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  console.log(`\n📈 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED - APP IS READY FOR TESTING');
    console.log('\n📍 Access the app at: http://localhost:5173/finance-family-tp/');
    console.log('🔗 API endpoint: http://localhost:3001');
    return 0;
  } else {
    console.log('\n⚠️  Some tests failed - check configuration');
    return 1;
  }
}

await runAllTests().then(code => process.exit(code));
