import type { APIRoute } from 'astro';
import { updateReportStatus } from '../../../lib/supabase/service';

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('sb-access-token')?.value;
  if (!token) return new Response('Unauthorized', { status: 401 });

  try {
    const { reportId, status } = await request.json();
    if (!reportId || !['accepted', 'rejected'].includes(status)) {
      return new Response('Invalid payload', { status: 400 });
    }

    await updateReportStatus(reportId, status as 'accepted' | 'rejected');
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
