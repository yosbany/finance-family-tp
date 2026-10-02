/**
 * Environment Configuration
 * 
 * Centralized configuration loading from environment variables.
 * This module ensures all critical values are present at startup.
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || '';
}

function getEnvPort(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port for ${key}: ${value}`);
  }
  return port;
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) {
    return ['http://localhost:5173', 'http://localhost:5174'];
  }
  return value.split(',').map(origin => origin.trim()).filter(Boolean);
}

export const config = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: getEnvPortWithName('PORT', 3001),
  
  // CORS Configuration
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  
  // Firebase Configuration
  firebaseProjectId: getEnvVar('FIREBASE_PROJECT_ID'),
  firebaseDatabaseUrl: getEnvVar('FIREBASE_DATABASE_URL'),
  
  // Optional: For LLM integration (FASE 05+)
  llmBaseUrl: process.env.NRD_LLM_BASE_URL || undefined,
  llmApiKey: process.env.NRD_LLM_API_KEY || undefined,
  llmModel: process.env.NRD_LLM_MODEL || undefined,
  
  // Feature flags
  isDevelopment: () => getEnvVar('NODE_ENV', 'development') === 'development',
  isProduction: () => getEnvVar('NODE_ENV', 'development') === 'production',
} as const;

function getEnvPortWithName(key: string, defaultValue: number): number {
  return getEnvPort(key, defaultValue);
}

/**
 * Validate critical configuration at startup
 */
export function validateConfig(): void {
  try {
    // These will throw if missing
    config.firebaseProjectId;
    config.firebaseDatabaseUrl;
    
    console.log('✅ Configuration validated successfully');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    process.exit(1);
  }
}

export default config;
