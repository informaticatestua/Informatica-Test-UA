import { e as createComponent, r as renderTemplate, n as renderSlot, o as renderHead, g as addAttribute, h as createAstro } from './astro/server_3QkxrEKH.mjs';
import 'piccolore';
import 'clsx';
/* empty css                             */

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro();
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title, description = "Plataforma de preguntas de test para estudiantes de Ingenier\xEDa Inform\xE1tica de la UA." } = Astro2.props;
  return renderTemplate(_a || (_a = __template(['<html lang="es" class="dark"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" type="image/png" href="/logo.png"><meta name="generator"', "><title>", ' | Inform\xE1tica Test UA</title><meta name="description"', '><!-- Google Fonts: Inter & Material Symbols --><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"><!-- KaTeX Auto-render --><script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"><\/script>', "</head> <body> ", " <script>\n			document.addEventListener('DOMContentLoaded', function() {\n				renderMathInElement(document.body, {\n					delimiters: [\n						{left: '$$', right: '$$', display: true},\n						{left: '$', right: '$', display: false}\n					],\n					throwOnError : false\n				});\n			});\n		<\/script> </body> </html>"])), addAttribute(Astro2.generator, "content"), title, addAttribute(description, "content"), renderHead(), renderSlot($$result, $$slots["default"]));
}, "C:/Users/Jesus/Documents/Proyectos/Informatica-Test-UA/src/layouts/BaseLayout.astro", void 0);

export { $$BaseLayout as $ };
