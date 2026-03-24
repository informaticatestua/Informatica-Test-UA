import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, g as addAttribute } from '../chunks/astro/server_3QkxrEKH.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_D1PuRcm2.mjs';
import { $ as $$Navbar, a as $$Footer } from '../chunks/Footer_DDe8CIar.mjs';
import { j as getSubjects, i as getModulesForSubject } from '../chunks/service_BrFuEpE7.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  let sortedSubjects = [];
  let subjectsWithLinks = [];
  let groupedSubjects = {};
  let uniqueCategories = [];
  let errorMsg = null;
  try {
    sortedSubjects = await getSubjects();
    subjectsWithLinks = (await Promise.all(sortedSubjects.map(async (subject) => {
      const modules = await getModulesForSubject(subject.id);
      return {
        ...subject,
        modulesCount: modules.length,
        href: modules.length === 1 ? `/quiz/${modules[0].id}` : `/subject/${subject.id}`
      };
    }))).filter((s) => s.id !== "ic" && s.id !== "si").map((s) => {
      if (s.id === "mads" || s.id.includes("mads")) {
        s.category = "Rama Software";
      }
      return s;
    });
    uniqueCategories = [...new Set(subjectsWithLinks.map((s) => s.category).filter(Boolean))];
    const order = ["Cuarto Curso (Rama Software)", "Rama Software", "Cuarto Curso", "Tercer Curso", "Segundo Curso", "Primer Curso"];
    uniqueCategories.sort((a, b) => {
      const iA = order.indexOf(a);
      const iB = order.indexOf(b);
      if (iA === -1 && iB === -1) return a.localeCompare(b);
      if (iA === -1) return 1;
      if (iB === -1) return -1;
      return iA - iB;
    });
    uniqueCategories.forEach((c) => {
      groupedSubjects[c] = subjectsWithLinks.filter((s) => s.category === c);
    });
  } catch (err) {
    errorMsg = err.message || "Failed to load subjects. Please check Vercel environment variables.";
  }
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Inicio" }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "Navbar", $$Navbar, {})} ${maybeRenderHead()}<main class="flex-1 flex justify-center py-12 px-4 relative min-h-[90vh]"> <!-- Background Ambient --> <div class="fixed top-[-10%] justify-center w-full flex pointer-events-none -z-10"> <div class="w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full"></div> <div class="w-[400px] h-[400px] bg-blue-500/10 blur-[100px] rounded-full absolute mix-blend-screen"></div> </div> <!-- Main App Container mimicking #app with glassmorphism --> <div class="w-full max-w-4xl bg-[#151a24]/90 backdrop-blur-2xl border border-[#2a303c] rounded-[2rem] shadow-2xl p-8 md:p-12 relative" id="app"> <h1 class="text-3xl md:text-5xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight mb-12">
Seleccione una asignatura
</h1> <!-- Subjects Container with exact structure --> ${errorMsg ? renderTemplate`<div class="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center text-red-200"> <h3 class="text-xl font-bold mb-2">Error de Conexión</h3> <p class="mb-4">No se pudieron cargar las asignaturas. Verifica la configuración de la base de datos.</p> <code class="block bg-black/30 p-4 rounded text-sm text-left overflow-x-auto">${errorMsg}</code> <p class="mt-4 text-xs opacity-70">Asegúrate de configurar las variables de entorno en Vercel y volver a desplegar la aplicación.</p> </div>` : renderTemplate`<div id="subjects-container"> ${uniqueCategories.map((category) => {
    const subjects = groupedSubjects[category];
    if (subjects.length === 0) return null;
    const isCentered = category === "Primer Curso" || subjects.length === 1;
    let leftGroup, rightGroup;
    if (category === "Segundo Curso") {
      leftGroup = subjects.filter((s) => s.id === "redes");
      rightGroup = subjects.filter((s) => s.id !== "redes");
    } else {
      const half = Math.ceil(subjects.length / 2);
      leftGroup = subjects.slice(0, half);
      rightGroup = subjects.slice(half);
    }
    const displayCategory = category === "Cuarto Curso (Rama Software)" ? "Rama Software" : category;
    return renderTemplate`<div class="category-section w-full mb-8"> <h3 class="text-lg font-black text-slate-300 mb-6 text-center uppercase tracking-widest">${displayCategory}</h3> ${isCentered ? renderTemplate`<div class="flex flex-wrap justify-center gap-4 w-full mb-6"> ${subjects.map((subject) => renderTemplate`<a${addAttribute(subject.href, "href")}${addAttribute(subject.name, "title")}${addAttribute(`Ir a la asignatura ${subject.name}`, "aria-label")} class="subject-card flex items-center px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold transition-all shadow-lg hover:-translate-y-0.5 hover:shadow-primary/20 text-sm whitespace-nowrap"${addAttribute(subject.name.toLowerCase(), "data-name")}> <span class="mr-2 text-base leading-none">${subject.icon}</span> ${subject.id.toUpperCase()} </a>`)} </div>` : renderTemplate`<div class="grid grid-cols-1 md:grid-cols-[1fr_2px_1fr] gap-5 items-center mb-6"> <!-- Columna Izquierda (group-left) --> <div class="flex flex-wrap justify-center md:justify-end gap-4"> ${leftGroup.map((subject) => renderTemplate`<a${addAttribute(subject.href, "href")}${addAttribute(subject.name, "title")}${addAttribute(`Ir a la asignatura ${subject.name}`, "aria-label")} class="subject-card flex items-center px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold transition-all shadow-lg hover:-translate-y-0.5 hover:shadow-primary/20 text-sm whitespace-nowrap"${addAttribute(subject.name.toLowerCase(), "data-name")}> <span class="mr-2 text-base leading-none">${subject.icon}</span> ${subject.id.toUpperCase()} </a>`)} </div> <!-- Separador vertical (separator) --> <div class="hidden md:block w-[2px] h-[40px] bg-gradient-to-b from-transparent via-slate-600 to-transparent mx-auto"></div> <!-- Columna Derecha (group-right) --> <div class="flex flex-wrap justify-center md:justify-start gap-4"> ${rightGroup.map((subject) => renderTemplate`<a${addAttribute(subject.href, "href")}${addAttribute(subject.name, "title")}${addAttribute(`Ir a la asignatura ${subject.name}`, "aria-label")} class="subject-card flex items-center px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold transition-all shadow-lg hover:-translate-y-0.5 hover:shadow-primary/20 text-sm whitespace-nowrap"${addAttribute(subject.name.toLowerCase(), "data-name")}> <span class="mr-2 text-base leading-none">${subject.icon}</span> ${subject.id.toUpperCase()} </a>`)} </div> </div>`} </div>`;
  })} </div>`} </div> </main> ${renderComponent($$result2, "Footer", $$Footer, {})} ` })}`;
}, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/index.astro", void 0);

const $$file = "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
