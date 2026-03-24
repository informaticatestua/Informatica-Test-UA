import { defineMiddleware } from 'astro:middleware';
import { getServerClient } from './lib/supabase/server';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;

  // Only protect /admin/* routes (except /admin/login itself)
  if (url.pathname.startsWith('/admin') && url.pathname !== '/admin/login') {
    const accessToken = cookies.get('sb-access-token')?.value;

    if (!accessToken) {
      return redirect('/admin/login');
    }

    try {
      const db = getServerClient();
      const { data: { user }, error } = await db.auth.getUser(accessToken);

      if (error || !user) {
        return redirect('/admin/login');
      }

      // Attach user to locals for downstream use
      context.locals.user = user;
    } catch {
      return redirect('/admin/login');
    }
  }

  return next();
});
