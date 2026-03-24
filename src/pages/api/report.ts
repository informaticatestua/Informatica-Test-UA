import type { APIRoute } from 'astro';
import { submitReport } from '../../lib/supabase/service';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { question_id, reason, details } = body;

    if (!question_id || !reason) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await submitReport({ question_id, reason, details: details ?? '' });

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
