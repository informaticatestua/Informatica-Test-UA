import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_DBDCoK5D.mjs';
import { manifest } from './manifest_DE1ywOz9.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/admin/dashboard.astro.mjs');
const _page2 = () => import('./pages/admin/login.astro.mjs');
const _page3 = () => import('./pages/api/admin/update-report.astro.mjs');
const _page4 = () => import('./pages/api/admin/update-suggestion.astro.mjs');
const _page5 = () => import('./pages/api/auth/login.astro.mjs');
const _page6 = () => import('./pages/api/auth/logout.astro.mjs');
const _page7 = () => import('./pages/api/report.astro.mjs');
const _page8 = () => import('./pages/api/suggest.astro.mjs');
const _page9 = () => import('./pages/quiz/_moduleid_.astro.mjs');
const _page10 = () => import('./pages/subject/_id_.astro.mjs');
const _page11 = () => import('./pages/submit-question.astro.mjs');
const _page12 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/admin/dashboard.astro", _page1],
    ["src/pages/admin/login.astro", _page2],
    ["src/pages/api/admin/update-report.ts", _page3],
    ["src/pages/api/admin/update-suggestion.ts", _page4],
    ["src/pages/api/auth/login.ts", _page5],
    ["src/pages/api/auth/logout.ts", _page6],
    ["src/pages/api/report.ts", _page7],
    ["src/pages/api/suggest.ts", _page8],
    ["src/pages/quiz/[moduleId].astro", _page9],
    ["src/pages/subject/[id].astro", _page10],
    ["src/pages/submit-question.astro", _page11],
    ["src/pages/index.astro", _page12]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "middlewareSecret": "dfe386eb-e43d-46b3-9dfe-cdda10580abe",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
