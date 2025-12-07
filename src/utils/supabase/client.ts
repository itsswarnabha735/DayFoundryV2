import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Singleton Supabase client to prevent multiple GoTrueClient instances
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = `https://${projectId}.supabase.co`;

    console.log('Creating new Supabase client instance');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Project ID:', projectId);

    supabaseInstance = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        // Use a consistent storage key to avoid conflicts
        storageKey: 'df-auth-token',
        // Persist auth state in localStorage
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // Prevent multiple auth instances
        detectSessionInUrl: false,
        // Only refresh tokens when needed
        autoRefreshToken: true,
      },
      // Use consistent global headers
      global: {
        headers: {
          'X-Client-Info': 'day-foundry-mobile-app'
        }
      }
    });
  }

  return supabaseInstance;
}

// Export the singleton client
export const supabase = getSupabaseClient();

// Export the getter function for other components that need to ensure they get the singleton
export { getSupabaseClient };

// Export for convenience
export { projectId, publicAnonKey };