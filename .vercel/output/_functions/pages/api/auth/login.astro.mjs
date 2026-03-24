import { g as getServerClient } from '../../../chunks/server_CZpMGDek.mjs';
export { renderers } from '../../../renderers.mjs';

const POST = async ({ request, cookies, redirect }) => {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email y contraseña son obligatorios." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const db = getServerClient();
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return new Response(JSON.stringify({ error: "Credenciales incorrectas." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const maxAge = data.session.expires_in ?? 3600;
    cookies.set("sb-access-token", data.session.access_token, {
      path: "/",
      maxAge,
      httpOnly: true,
      sameSite: "lax",
      secure: true
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Error interno." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
