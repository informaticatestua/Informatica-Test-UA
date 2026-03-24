import { d as defineMiddleware, s as sequence } from './chunks/index_BaYamgcS.mjs';
import { g as getServerClient } from './chunks/server_ghbxFmdQ.mjs';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_BeVD66ve.mjs';
import 'piccolore';
import './chunks/astro/server_3QkxrEKH.mjs';
import 'clsx';

const onRequest$1 = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;
  if (url.pathname.startsWith("/admin") && url.pathname !== "/admin/login") {
    const accessToken = cookies.get("sb-access-token")?.value;
    if (!accessToken) {
      return redirect("/admin/login");
    }
    try {
      const db = getServerClient();
      const { data: { user }, error } = await db.auth.getUser(accessToken);
      if (error || !user) {
        return redirect("/admin/login");
      }
      context.locals.user = user;
    } catch {
      return redirect("/admin/login");
    }
  }
  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
