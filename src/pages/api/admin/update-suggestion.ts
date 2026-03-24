import type { APIRoute } from 'astro';
import { updateSuggestionStatus } from '../../../lib/supabase/service';

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('sb-access-token')?.value;
  if (!token) return new Response('Unauthorized', { status: 401 });

  try {
    const { suggestionId, status } = await request.json();
    if (!suggestionId || !['accepted', 'rejected'].includes(status)) {
      return new Response('Invalid payload', { status: 400 });
    }

    await updateSuggestionStatus(suggestionId, status as 'accepted' | 'rejected');
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
