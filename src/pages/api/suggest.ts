import type { APIRoute } from 'astro';
import { submitQuestionSuggestion } from '../../lib/firebase/service';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    await submitQuestionSuggestion(data);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
};
