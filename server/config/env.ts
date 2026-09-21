import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Automatically load .env.local (if present in local development) followed by .env
let envInitialized = false;
export function initServerEnv(): void {
  if (envInitialized) return;
  try {
    const localEnvPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
      dotenv.config({ path: localEnvPath });
    }
    dotenv.config(); // fallback to standard .env if present
  } catch {
    // In serverless environments (Vercel / Netlify / Cloud Run),
    // environment variables are provided natively via process.env.
  }
  envInitialized = true;
}

// Initialize on module load
initServerEnv();

export interface ServerEnvironmentConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_KEY: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  APP_URL: string;
  GEMINI_API_KEY?: string;
  PORT: number;
  NODE_ENV: string;
}

/**
 * Returns current server environment configuration.
 * Always retrieves active values from process.env.
 */
export function getServerConfig(): ServerEnvironmentConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || '';
  const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';

  const port = parseInt(process.env.PORT || '3000', 10);
  const appUrl = process.env.APP_URL?.trim() || `http://localhost:${port}`;
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    SUPABASE_KEY: supabaseKey,
    RAZORPAY_KEY_ID: razorpayKeyId,
    RAZORPAY_KEY_SECRET: razorpayKeySecret,
    APP_URL: appUrl,
    GEMINI_API_KEY: geminiApiKey,
    PORT: port,
    NODE_ENV: nodeEnv,
  };
}

export interface EnvValidationResult {
  isValid: boolean;
  missingRequired: string[];
  warnings: string[];
}

/**
 * Validates required environment variables for ROAMX Expeditions.
 * Logs clear configuration errors without exposing sensitive secret values.
 * Never silently uses mock data or hardcoded credentials.
 */
export function validateServerEnv(): EnvValidationResult {
  const config = getServerConfig();
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  // 1. Supabase Validation
  if (!config.SUPABASE_URL) {
    missingRequired.push('SUPABASE_URL');
  }

  if (!config.SUPABASE_SERVICE_ROLE_KEY && !config.SUPABASE_ANON_KEY) {
    missingRequired.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  } else if (!config.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Operating with SUPABASE_ANON_KEY. For full user administration and bypassing RLS on server endpoints, configure SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  // 2. Razorpay Validation
  if (!config.RAZORPAY_KEY_ID) {
    warnings.push('RAZORPAY_KEY_ID is missing. Online payment processing will be unavailable.');
  }
  if (!config.RAZORPAY_KEY_SECRET) {
    warnings.push(
      'RAZORPAY_KEY_SECRET is missing. Payment order creation and cryptographic signature verification will fail.'
    );
  }

  // 3. Gemini AI (Optional)
  if (!config.GEMINI_API_KEY) {
    warnings.push('GEMINI_API_KEY is not set. AI Trail Captain assistant will run with default guide rules.');
  }

  const isValid = missingRequired.length === 0;

  // Log structured diagnostic report at startup
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏔️  ROAMX EXPEDITIONS — Environment Configuration Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`• Environment: ${config.NODE_ENV}`);
  console.log(`• App URL:     ${config.APP_URL}`);
  console.log(
    `• Supabase:    ${config.SUPABASE_URL ? `Connected (${config.SUPABASE_URL})` : 'MISSING'}`
  );
  console.log(
    `• Auth Key:    ${
      config.SUPABASE_SERVICE_ROLE_KEY
        ? 'Service Role Key (Admin)'
        : config.SUPABASE_ANON_KEY
        ? 'Anon Key'
        : 'NONE'
    }`
  );
  console.log(
    `• Razorpay:    ${
      config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET
        ? 'Configured (Active Gateway)'
        : 'Incomplete / Missing'
    }`
  );
  console.log(
    `• Gemini AI:   ${config.GEMINI_API_KEY ? 'Configured' : 'Not configured (Optional)'}`
  );

  if (!isValid) {
    console.error('❌ CONFIGURATION ERROR: Missing required environment variables:');
    missingRequired.forEach((v) => console.error(`   - ${v}`));
    console.error(
      '👉 Please configure these variables in your hosting dashboard (Vercel / Netlify) or in .env.local for local development.'
    );
    console.error('👉 Refer to .env.example for required variable definitions.');
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Configuration Notices:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return { isValid, missingRequired, warnings };
}
