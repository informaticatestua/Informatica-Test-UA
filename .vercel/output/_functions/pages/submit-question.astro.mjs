import { e as createComponent, k as renderComponent, m as maybeRenderHead, n as renderSlot, r as renderTemplate, l as renderScript, g as addAttribute } from '../chunks/astro/server_3QkxrEKH.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_D1PuRcm2.mjs';
import { $ as $$Header } from '../chunks/Header_Do1pdDvG.mjs';
import { j as getSubjects } from '../chunks/service_BrFuEpE7.mjs';
export { renderers } from '../renderers.mjs';

const $$InternalPageLayout = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Header", $$Header, {})} ${maybeRenderHead()}<div class="bg-primary text-white py-12"> <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> ${renderSlot($$result, $$slots["header"])} </div> </div> <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> ${renderSlot($$result, $$slots["default"])} </main>`;
}, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/components/layout/InternalPageLayout.astro", void 0);

const $$SubmitQuestion = createComponent(async ($$result, $$props, $$slots) => {
  const subjects = await getSubjects();
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Sugerir Pregunta" }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "InternalPageLayout", $$InternalPageLayout, {}, { "default": async ($$result3) => renderTemplate`  ${maybeRenderHead()}<div class="max-w-3xl mx-auto mt-8 glass rounded-3xl p-8 shadow-sm border border-white/10"> <form id="suggestion-form" class="space-y-6"> <div> <label class="block text-sm font-bold text-slate-300 mb-2">Asignatura</label> <select name="subjectId" required class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"> <option value="" class="text-slate-800">Selecciona una asignatura...</option> ${subjects.map((s) => renderTemplate`<option${addAttribute(s.id, "value")} class="text-slate-800">${s.name}</option>`)} </select> </div> <div> <label class="block text-sm font-bold text-slate-300 mb-2">Texto de la Pregunta</label> <textarea name="text" required rows="4" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Escribe aquí el enunciado..."></textarea> </div> <div class="space-y-4"> <label class="block text-sm font-bold text-slate-300">Opciones de Respuesta</label> <p class="text-xs text-slate-400 mb-2">Marca la casilla de la respuesta correcta.</p> <div class="grid grid-cols-1 gap-4"> ${[1, 2, 3, 4].map((i) => renderTemplate`<div class="flex items-center space-x-3"> <input type="radio" name="correctIndex"${addAttribute(i - 1, "value")} required class="w-5 h-5 text-primary focus:ring-primary"> <input type="text"${addAttribute(`option-${i - 1}`, "name")}${addAttribute(`Opci\xF3n ${i}`, "placeholder")} class="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-primary outline-none"${addAttribute(i <= 2, "required")}> </div>`)} </div> </div> <div> <label class="block text-sm font-bold text-slate-300 mb-2">Nota adicional (opcional)</label> <input type="text" name="note" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="P.ej: Pregunta del examen de enero 2024"> </div> <div class="pt-6"> <button type="submit" class="w-full bg-primary text-white font-bold py-4 rounded-2xl hover:bg-opacity-90 hover:shadow-lg hover:shadow-primary/30 transform active:scale-[0.98] transition-all flex items-center justify-center space-x-2"> <span class="material-symbols-outlined">send</span> <span>Enviar Sugerencia</span> </button> </div> </form> </div> `, "header": async ($$result3) => renderTemplate`<div> <h1 class="text-3xl font-bold text-white">Sugerir Nueva Pregunta</h1> <p class="text-blue-200 mt-2">Ayuda a otros compañeros aportando material nuevo</p> </div>` })} ` })} ${renderScript($$result, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/submit-question.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/submit-question.astro", void 0);

const $$file = "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/submit-question.astro";
const $$url = "/submit-question";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: $$SubmitQuestion,
    file: $$file,
    url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
