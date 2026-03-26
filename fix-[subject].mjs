import fs from 'node:fs';

let file = 'src/pages/[subject].astro';
let content = fs.readFileSync(file, 'utf8');

// Encuentra las lineas con @apply ... !important;
content = content.replace(/@apply\s+([^;]+)\s+!important;/g, (match, classesStr) => {
    let classes = classesStr.trim().split(/\s+/);
    let importantClasses = classes.map(c => c.endsWith('!') ? c : c + '!');
    return `@apply ${importantClasses.join(' ')};`;
});

fs.writeFileSync(file, content);
console.log('Fixed important syntax');
