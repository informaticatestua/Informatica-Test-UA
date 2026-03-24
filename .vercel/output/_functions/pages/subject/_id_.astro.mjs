import { e as createComponent, k as renderComponent, r as renderTemplate, h as createAstro, m as maybeRenderHead, g as addAttribute } from '../../chunks/astro/server_3QkxrEKH.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../../chunks/BaseLayout_DXpAHIBk.mjs';
import { $ as $$Navbar, a as $$Footer } from '../../chunks/Footer_DDe8CIar.mjs';
import { f as getSubject, i as getModulesForSubject, h as getQuestionsForModule } from '../../chunks/service_DAF_8fqT.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$id;
  const { id } = Astro2.params;
  const subject = await getSubject(id);
  if (!subject) {
    return Astro2.redirect("/");
  }
  const subjectModules = await getModulesForSubject(id);
  const modulesWithCounts = await Promise.all(subjectModules.map(async (m) => {
    const questions = await getQuestionsForModule(m.id);
    return { ...m, questionCount: questions.length };
  }));
  const totalQuestions = modulesWithCounts.reduce((acc, curr) => acc + curr.questionCount, 0);
  const iconMap = {
    "\u{1F4BB}": "terminal",
    "\u{1F4DA}": "library_books",
    "\u{1F5C4}\uFE0F": "database",
    "\u2699\uFE0F": "settings",
    "\u{1F4CA}": "bar_chart",
    "\u{1F6E0}\uFE0F": "build",
    "\u{1F50C}": "power",
    "\u{1F527}": "build",
    "\u{1F4DD}": "description",
    "\u{1F9EA}": "home_health",
    "\u{1F310}": "language",
    "\u{1F6E1}\uFE0F": "shield",
    "\u{1F4C1}": "folder",
    "\u{1F4E1}": "settings_input_antenna",
    "\u{1F680}": "rocket"
  };
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": `Asignatura: ${subject.name}` }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "Navbar", $$Navbar, {})} ${maybeRenderHead()}<main class="flex-1"> <!-- Subject Header --> <div class="relative py-20 px-6 border-b border-white/5 overflow-hidden"> <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-10 relative z-10"> <div class="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] flex items-center justify-center text-5xl md:text-6xl shadow-2xl border border-white/10"${addAttribute(`background-color: ${subject.color}20; color: ${subject.color}`, "style")}> <span class="material-symbols-outlined text-inherit block scale-125" style="font-variation-settings: 'FILL' 1"> ${iconMap[subject.icon] || "book"} </span> </div> <div class="space-y-4"> <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
Asignatura Detallada
</div> <h1 class="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">${subject.name}</h1> <p class="text-slate-400 font-medium text-lg max-w-2xl leading-relaxed">
Explora los diferentes módulos de test y prepárate para los exámenes oficiales con preguntas seleccionadas.
</p> </div> </div> <!-- Glow background --> <div class="absolute top-1/2 left-0 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div> </div> <div class="max-w-7xl mx-auto px-6 lg:px-20 py-16"> <!-- Stats --> <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20"> <div class="glass rounded-2xl p-8 border border-white/5 flex items-center gap-6"> <div class="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20"> <span class="material-symbols-outlined text-2xl">library_books</span> </div> <div> <p class="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Módulos</p> <p class="text-3xl font-black text-white">${modulesWithCounts.length}</p> </div> </div> <div class="glass rounded-2xl p-8 border border-white/5 flex items-center gap-6"> <div class="w-14 h-14 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20"> <span class="material-symbols-outlined text-2xl">quiz</span> </div> <div> <p class="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Preguntas</p> <p class="text-3xl font-black text-white">${totalQuestions}</p> </div> </div> <div class="glass rounded-2xl p-8 border border-white/5 flex items-center gap-6"> <div class="w-14 h-14 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20"> <span class="material-symbols-outlined text-2xl">school</span> </div> <div> <p class="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Universidad</p> <p class="text-xl font-black text-white">Alicante (UA)</p> </div> </div> </div> <div class="flex items-center justify-between mb-12"> <div class="space-y-1"> <h2 class="text-2xl font-black text-white flex items-center gap-3"> <span class="material-symbols-outlined text-primary">format_list_bulleted</span>
Tests Disponibles
</h2> <p class="text-slate-500 text-sm font-medium">Selecciona un bloque temático para comenzar el simulacro.</p> </div> <div class="hidden md:block flex-grow ml-10 h-px bg-white/5"></div> </div> <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-10"> ${modulesWithCounts.map((module) => renderTemplate`<a${addAttribute(`/quiz/${module.id}`, "href")} class="group glass card-hover rounded-2xl p-8 flex flex-col min-h-[220px] relative overflow-hidden"> <div class="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"> <span class="material-symbols-outlined text-primary text-xl">arrow_right_alt</span> </div> <div class="flex-grow"> <h3 class="text-2xl font-bold text-white group-hover:text-primary transition-colors mb-4 line-clamp-3 leading-tight">${module.name}</h3> <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 w-fit px-3 py-1.5 rounded-lg border border-white/5 group-hover:border-primary/20 group-hover:text-primary transition-all"> <span class="material-symbols-outlined text-xs">format_list_numbered</span> <span>${module.questionCount} preguntas</span> </div> </div> <div class="mt-8 flex items-center justify-between pt-6 border-t border-white/5"> <span class="text-xs font-black text-slate-500 uppercase tracking-widest group-hover:text-primary transition-colors">Empezar Test</span> <div class="w-10 h-10 rounded-full bg-white/5 text-slate-500 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all transform group-hover:scale-110 shadow-lg"> <span class="material-symbols-outlined text-sm">play_arrow</span> </div> </div> </a>`)} ${modulesWithCounts.length === 0 && renderTemplate`<div class="col-span-full py-32 text-center bg-white/2 rounded-3xl border border-dashed border-white/10"> <span class="material-symbols-outlined text-7xl text-slate-700 mb-6 block">folder_off</span> <h3 class="text-3xl font-black text-white mb-3">Sin módulos</h3> <p class="text-slate-500 text-lg font-medium">No hay módulos de preguntas disponibles para esta asignatura.</p> </div>`} </div> </div> </main> ${renderComponent($$result2, "Footer", $$Footer, {})} ` })}`;
}, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/subject/[id].astro", void 0);

const $$file = "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/subject/[id].astro";
const $$url = "/subject/[id]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$id,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
