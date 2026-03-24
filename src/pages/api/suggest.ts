import type { APIRoute } from 'astro';
import { submitSuggestion } from '../../lib/supabase/service';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { subject_id, module_id, question_text, options, contributor_note } = body;

    if (!subject_id || !question_text || !Array.isArray(options) || options.length < 2) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios o hay menos de 2 opciones.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const hasCorrect = options.some((o: any) => o.is_correct === true);
    if (!hasCorrect) {
      return new Response(JSON.stringify({ error: 'Debes marcar al menos una respuesta correcta.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await submitSuggestion({ subject_id, module_id, question_text, options, contributor_note });

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
