/**
 * ROAMX Expeditions — Client Environment Configuration
 *
 * Security Notice:
 * Only variables with VITE_ prefix are exposed to the browser.
 * Server secrets are NEVER included in client code.
 */

export interface ClientEnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
}

export function getClientConfig(): ClientEnvironmentConfig {
  const defaultAppUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    appUrl: import.meta.env.VITE_APP_URL || defaultAppUrl,
  };
}
