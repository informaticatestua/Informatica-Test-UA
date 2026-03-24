import { e as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_3QkxrEKH.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../../chunks/BaseLayout_DXpAHIBk.mjs';
import { $ as $$Header } from '../../chunks/Header_Do1pdDvG.mjs';
export { renderers } from '../../renderers.mjs';

const $$Login = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Acceso Admin" }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "Header", $$Header, {})} ${maybeRenderHead()}<main class="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 px-4"> <div class="max-w-md w-full p-8 bg-white rounded-3xl shadow-xl border border-gray-100"> <div class="text-center mb-8"> <span class="text-5xl">🔐</span> <h1 class="text-2xl font-bold text-gray-900 mt-4">Panel de Administración</h1> <p class="text-gray-500 text-sm">Ingresa tus credenciales para continuar</p> </div> <form class="space-y-6" id="login-form"> <div> <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label> <input type="email" id="email" required class="block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" placeholder="admin@ejemplo.com"> </div> <div> <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label> <input type="password" id="password" required class="block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" placeholder="••••••••"> </div> <div id="error-message" class="hidden text-red-500 text-sm text-center"></div> <button type="submit" class="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:shadow-lg hover:bg-opacity-90 transition-all flex items-center justify-center space-x-2"> <span class="material-icons-outlined">login</span> <span>Acceder</span> </button> </form> </div> </main> ` })} ${renderScript($$result, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/admin/login.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/admin/login.astro", void 0);

const $$file = "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/admin/login.astro";
const $$url = "/admin/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: $$Login,
    file: $$file,
    url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
