import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service_role key.
 * NEVER import this on the client side.
 */
export function getServerClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables. Ensure PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
  }

  return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * Creates a Supabase client scoped to a user session (for admin pages).
 * Pass the access_token from the session cookie.
 */
export function createServerClient(accessToken: string) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables for client. Ensure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set.");
  }

  const client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  client.auth.setSession({ access_token: accessToken, refresh_token: '' });
  return client;
}
