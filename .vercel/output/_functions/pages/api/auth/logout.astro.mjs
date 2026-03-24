export { renderers } from '../../../renderers.mjs';

const POST = async ({ cookies, redirect }) => {
  cookies.delete("sb-access-token", { path: "/" });
  return redirect("/admin/login");
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
