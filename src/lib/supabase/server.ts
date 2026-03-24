import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service_role key.
 * NEVER import this on the client side.
 */
export function getServerClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    {
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
  const client = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  client.auth.setSession({ access_token: accessToken, refresh_token: '' });
  return client;
}
