import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email y contraseña son obligatorios.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getServerClient();
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return new Response(JSON.stringify({ error: 'Credenciales incorrectas.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set secure session cookie (httpOnly for security)
    const maxAge = data.session.expires_in ?? 3600;
    cookies.set('sb-access-token', data.session.access_token, {
      path: '/',
      maxAge,
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Error interno.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
