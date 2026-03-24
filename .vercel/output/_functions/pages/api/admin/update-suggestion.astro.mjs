import { c as updateSuggestionStatus } from '../../../chunks/service_BrFuEpE7.mjs';
export { renderers } from '../../../renderers.mjs';

const POST = async ({ request, cookies }) => {
  const token = cookies.get("sb-access-token")?.value;
  if (!token) return new Response("Unauthorized", { status: 401 });
  try {
    const { suggestionId, status } = await request.json();
    if (!suggestionId || !["accepted", "rejected"].includes(status)) {
      return new Response("Invalid payload", { status: 400 });
    }
    await updateSuggestionStatus(suggestionId, status);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
