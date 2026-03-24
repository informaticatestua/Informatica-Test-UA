import { e as createComponent, m as maybeRenderHead, r as renderTemplate } from './astro/server_3QkxrEKH.mjs';
import 'piccolore';
import 'clsx';

const $$Header = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<header class="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 sticky top-0 z-50 py-1"> <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> <div class="flex justify-between items-center h-16"> <div class="flex items-center"> <a href="/" class="flex items-center space-x-3 group"> <img src="/ua_logo.png" alt="TestUA Logo" class="h-10 w-auto group-hover:opacity-90 transition-opacity duration-300"> <span class="text-2xl font-black tracking-tight text-slate-800 hidden sm:inline-block">Informatica<span class="text-primary font-bold ml-1">Test UA</span></span> </a> </div> <nav class="hidden md:flex items-center space-x-8"> <a href="/" class="text-sm font-semibold text-slate-600 hover:text-primary transition-colors">Asignaturas</a> <a href="/submit-question" class="text-sm font-semibold text-slate-600 hover:text-primary transition-colors">Sugerir Pregunta</a> </nav> <div class="flex items-center space-x-4"> <a href="/admin/login" class="flex items-center space-x-2 px-5 py-2.5 rounded-full border-2 border-slate-100 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-bold text-sm shadow-sm hover:shadow-md"> <span class="material-icons-outlined text-[20px]">admin_panel_settings</span> <span>Admin</span> </a> </div> </div> </div> </header>`;
}, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/components/layout/Header.astro", void 0);

export { $$Header as $ };
