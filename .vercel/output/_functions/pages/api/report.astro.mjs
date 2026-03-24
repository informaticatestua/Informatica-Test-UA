import { s as submitReport } from '../../chunks/service_DAF_8fqT.mjs';
export { renderers } from '../../renderers.mjs';

const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { question_id, reason, details } = body;
    if (!question_id || !reason) {
      return new Response(JSON.stringify({ error: "Faltan campos obligatorios." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    await submitReport({ question_id, reason, details: details ?? "" });
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
