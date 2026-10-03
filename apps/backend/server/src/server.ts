/**
 * Server Entry Point
 * 
 * Initializes and starts the Finance Family REST API backend.
 * 
 * STARTUP SEQUENCE:
 * 1. Load environment configuration
 * 2. Validate configuration
 * 3. Initialize Firebase Admin SDK
 * 4. Create Fastify application
 * 5. Start listening
 */

import { config, validateConfig } from './config/env.js';
import { initializeFirebase } from './firebase/admin.js';
import { createApp } from './app/app.js';

async function main() {
  try {
    console.log('🚀 Starting Finance Family REST API Backend...\n');

    // Step 1: Validate configuration
    console.log('📋 Validating configuration...');
    validateConfig();
    console.log(`   NODE_ENV: ${config.nodeEnv}`);
    console.log(`   PORT: ${config.port}`);
    console.log(`   Firebase Project: ${config.firebaseProjectId}`);
    console.log();

    // Step 2: Initialize Firebase
    console.log('🔥 Initializing Firebase Admin SDK...');
    initializeFirebase();
    console.log();

    // Step 3: Create app
    console.log('⚙️  Creating Fastify application...');
    const app = await createApp();
    console.log();

    // Step 4: Start server
    console.log('🎯 Starting server...');
    await app.listen({ port: config.port, host: '127.0.0.1' });

    console.log(`\n✅ Server is running on http://127.0.0.1:${config.port}`);
    console.log(`   Health check: http://127.0.0.1:${config.port}/health`);
    console.log(`   API base: http://127.0.0.1:${config.port}/api\n`);

    if (config.isDevelopment()) {
      console.log('💡 Development mode: ALLOWED_ORIGINS includes localhost');
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default main;
