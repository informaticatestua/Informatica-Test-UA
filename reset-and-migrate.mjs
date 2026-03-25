/**
 * reset-and-migrate.mjs
 *
 * 1. LIMPIA toda la BD de Supabase (options → questions → modules → subjects → courses)
 * 2. Recrea la estructura EXACTA definida por el usuario
 * 3. Sube todas las preguntas desde preguntasTestCommunity/resources/data/
 *
 * Ejecutar:  node reset-and-migrate.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL        = 'https://lwtyzqemiipprusmdaor.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dHl6cWVtaWlwcHJ1c21kYW9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4Nzk2MCwiZXhwIjoyMDg5ODYzOTYwfQ.r0UQrqkbQaVSXsdUktASqymg1_xqPXn_EFIhTirtEzM';
const DATA_DIR            = 'C:/Users/Jesus/Documents/Proyectos/preguntasTestCommunity/resources/data';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Exact structure as defined by the user ────────────────────────────────────
// Format: courses → subjects → modules (with corresponding .txt files)
// A null modules array means the subject has NO modules (questions go directly in a synthetic module)
const STRUCTURE = {
  courses: [
    { id: 'primero',    name: 'Primer Curso' },
    { id: 'segundo',    name: 'Segundo Curso' },
    { id: 'tercero',    name: 'Tercer Curso' },
    { id: 'cuarto-sw',  name: 'Cuarto Curso (Rama Software)' },
  ],
  subjects: [
    // ── Primer Curso ──────────────────────────────────────────────────────────
    {
      id: 'sti', course_id: 'primero', name: 'STI', icon: '📚', category: 'Primer Curso',
      modules: [
        { id: 'sti-full', name: 'Completo', file: 'stiPreguntas.txt' },
      ]
    },
    // ── Segundo Curso ─────────────────────────────────────────────────────────
    {
      id: 'redes', course_id: 'segundo', name: 'Redes', icon: '📡', category: 'Segundo Curso',
      modules: [
        { id: 'redes_full',        name: 'Completo',       file: 'redesPreguntas.txt' },
        { id: 'redesEnero2324',    name: 'Enero 23-24',    file: 'redesEnero2324Preguntas.txt' },
        { id: 'redesEnero2425',    name: 'Enero 24-25',    file: 'redesEnero2425Preguntas.txt' },
        { id: 'redesJulio2425',    name: 'Julio 24-25',    file: 'redesJulio2425Preguntas.txt' },
        { id: 'redesEnero2526',    name: 'Enero 25-26',    file: 'redesEnero2526Preguntas.txt' },
      ]
    },
    {
      id: 'ada', course_id: 'segundo', name: 'ADA', icon: '📊', category: 'Segundo Curso',
      modules: [
        { id: 'ada-p1',   name: 'Parcial 1', file: 'ada-p1Preguntas.txt' },
        { id: 'ada-p2',   name: 'Parcial 2', file: 'ada-p2Preguntas.txt' },
        { id: 'ada-full', name: 'Completo',  file: 'adaPreguntas.txt' },
      ]
    },
    {
      id: 'ped', course_id: 'segundo', name: 'PED', icon: '💻', category: 'Segundo Curso',
      modules: [
        { id: 'ped-full', name: 'Completo', file: 'pedPreguntas.txt' },
      ]
    },
    {
      id: 'ac', course_id: 'segundo', name: 'AC', icon: '⚙️', category: 'Segundo Curso',
      modules: [
        { id: 'ac_CP-F2ac', name: 'CP Fase 2',  file: 'ac_CP-F2_Preguntas.txt' },
        { id: 'CP-F3ac',    name: 'CP Fase 3',  file: 'ac_CP-F3_Preguntas.txt' },
        { id: 'CT1-2ac',    name: 'CT1-CT2',    file: 'ac_CT1-2_Preguntas.txt' },
        { id: 'CT3-4',      name: 'CT3-CT4',    file: 'ac_CT3-4_Preguntas.txt' },
      ]
    },
    {
      id: 'hada', course_id: 'segundo', name: 'HADA', icon: '📊', category: 'Segundo Curso',
      modules: [
        { id: 'hada-full', name: 'Completo', file: 'hadaPreguntas.txt' },
      ]
    },
    // ── Tercer Curso ──────────────────────────────────────────────────────────
    {
      id: 'dss', course_id: 'tercero', name: 'DSS', icon: '🛡️', category: 'Tercer Curso',
      modules: [
        { id: 'dss-full', name: 'Completo', file: 'dssPreguntas.txt' },
      ]
    },
    {
      id: 'gpi', course_id: 'tercero', name: 'GPI', icon: '📝', category: 'Tercer Curso',
      modules: [
        { id: 'gpi-full', name: 'Completo', file: 'gpiPreguntas.txt' },
      ]
    },
    {
      id: 'ic', course_id: 'tercero', name: 'IC-P1', icon: '🧪', category: 'Tercer Curso',
      modules: [
        { id: 'ic-p1-full', name: 'Completo', file: 'ic-p1.txt' },
      ]
    },
    {
      id: 'taes', course_id: 'tercero', name: 'TAES-DEFINITIVO-OLD', icon: '🧪', category: 'Tercer Curso',
      modules: [
        { id: 'taes-definitivo-old', name: 'Definitivo Old', file: 'taesDefinitivoPreguntas.txt' },
      ]
    },
    {
      id: 'ppss', course_id: 'tercero', name: 'PPSS', icon: '🔧', category: 'Tercer Curso',
      modules: [
        { id: 'PPSS-P1',       name: 'Parcial 1', file: 'ppss-p1Preguntas.txt' },
        { id: 'PPSS-P2',       name: 'Parcial 2', file: 'ppss-p2Preguntas.txt' },
        { id: 'PPSS-C4-2025',  name: 'C4 2025',   file: null },   // No data file yet
      ]
    },
    // ── Rama Software ─────────────────────────────────────────────────────────
    {
      id: 'dca', course_id: 'cuarto-sw', name: 'DCA', icon: '🛠️', category: 'Rama Software',
      modules: [
        { id: 'DCA-OFICIAL',     name: 'Oficial',    file: 'dcaPreguntas.txt' },
        { id: 'DCA-NO-OFICIAL',  name: 'No Oficial', file: 'dca-NO-OFICIALPreguntas.txt' },
      ]
    },
    {
      id: 'mads', course_id: 'cuarto-sw', name: 'MADS-NO-OFICIAL', icon: '💻', category: 'Rama Software',
      modules: [
        { id: 'MADS-NO-OFICIAL-P1', name: 'Parcial 1', file: 'MADS-NO-OFICIAL-P1Preguntas.txt' },
        { id: 'MADS-NO-OFICIAL-P2', name: 'Parcial 2', file: 'MADS-NO-OFICIAL-P2Preguntas.txt' },
      ]
    },
    {
      id: 'gcs', course_id: 'cuarto-sw', name: 'GCS', icon: '📁', category: 'Rama Software',
      modules: [
        { id: 'GCS-P1-NO-OFICIAL-2025', name: 'P1 No Oficial 2025', file: 'gcsp1nooficialPreguntas.txt' },
        { id: 'GCS-P1-old-2024',        name: 'P1 Old 2024',         file: 'gcsp1oldPreguntas.txt' },
        { id: 'GCS-P2-old-2024',        name: 'P2 Old 2024',         file: 'gcsp2oldPreguntas.txt' },
      ]
    },
    {
      id: 'sds', course_id: 'cuarto-sw', name: 'SDS-NO-OFICIAL', icon: '🛡️', category: 'Rama Software',
      modules: [
        { id: 'SDSFULL',               name: 'Completo',            file: null },  // no combined file
        { id: 'sds01-presentacion',    name: 'T1 Presentación',     file: 'sds01-presentacionPreguntas.txt' },
        { id: 'sds02-introgo',         name: 'T2 Intro Go',         file: 'sds02-introgoPreguntas.txt' },
        { id: 'sds03-introcripto',     name: 'T3 Intro Criptografía', file: 'sds03-introcriptoPreguntas.txt' },
        { id: 'sds04-aleatorios',      name: 'T4 Aleatorios',       file: 'sds04-aleatoriosPreguntas.txt' },
        { id: 'sds05-flujo',           name: 'T5 Cifrado Flujo',    file: 'sds05-flujoPreguntas.txt' },
        { id: 'sds06-bloque',          name: 'T6 Cifrado Bloque',   file: 'sds06-bloquePreguntas.txt' },
        { id: 'sds07-hash',            name: 'T7 Hash',             file: 'sds07-hashPreguntas.txt' },
        { id: 'sds08-publica',         name: 'T8 Clave Pública',    file: 'sds08-publicaPreguntas.txt' },
        { id: 'sds09-transporte',      name: 'T9 Capa Transporte',  file: 'sds09-transportePreguntas.txt' },
        { id: 'sds10-ejercicios',      name: 'T10 Ejercicios',      file: 'sds10-ejerciciosPreguntas.txt' },
        { id: 'sds11-malware',         name: 'T11 Malware',         file: 'sds11-malwarePreguntas.txt' },
        { id: 'sds12-ataques',         name: 'T12 Ataques',         file: 'sds12-ataquesPreguntas.txt' },
        { id: 'sds13-wireless',        name: 'T13 Wireless',        file: 'sds13-wirelessPreguntas.txt' },
        { id: 'sds14-recomendaciones', name: 'T14 Recomendaciones', file: 'sds14-recomendacionesPreguntas.txt' },
      ]
    },
  ]
};

// ── Parser ────────────────────────────────────────────────────────────────────
function parseTxtFile(filePath) {
  const content = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const blocks = content.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  const questions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 4) continue; // at least: question, correctIdx, opt1, opt2

    const text = lines[0];
    const correctIdxRaw = parseInt(lines[1], 10);
    if (isNaN(correctIdxRaw) || correctIdxRaw < 1 || correctIdxRaw > 6) continue;

    // Options: everything after line[1], strip leading '-' or letter (a. b. c.)
    const rawOpts = lines.slice(2);
    const opts = rawOpts.map(o =>
      o.replace(/^-\s*/, '')         // strip leading "- "
       .replace(/^[a-z]\.\s*/i, '')  // strip leading "a. "
       .trim()
    ).filter(Boolean);

    if (opts.length < 2) continue;

    // Extract image URL if embedded in question text
    let questionText = text;
    let imagePath = null;
    const imgMatch = text.match(/(https?:\/\/\S+)/);
    if (imgMatch) {
      imagePath = imgMatch[1];
      questionText = text.replace(imgMatch[1], '').trim();
    }

    const options = opts.map((optText, idx) => ({
      text: optText,
      is_correct: idx + 1 === correctIdxRaw
    }));

    questions.push({ text: questionText, image_path: imagePath, options });
  }

  return questions;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function clearAll() {
  console.log('🗑️  Limpiando toda la base de datos...');
  // Delete in dependency order (children first)
  await db.from('options').delete().neq('id', 'impossible');
  await db.from('questions').delete().neq('id', 'impossible');
  await db.from('modules').delete().neq('id', 'impossible');
  await db.from('subjects').delete().neq('id', 'impossible');
  await db.from('courses').delete().neq('id', 'impossible');
  console.log('  ✅ BD limpia.\n');
}

async function insertQuestionsAndOptions(moduleId, questions) {
  let insertedQ = 0, insertedO = 0;
  // Insert in batches to avoid timeouts
  for (const q of questions) {
    const qId = randomUUID();
    const { error: qErr } = await db.from('questions').insert({
      id: qId, module_id: moduleId, text: q.text, image_path: q.image_path
    });
    if (qErr) { console.error(`    ❌ Q error: ${qErr.message}`); continue; }
    insertedQ++;

    const optRows = q.options.map(o => ({
      id: randomUUID(), question_id: qId, text: o.text, is_correct: o.is_correct
    }));
    const { error: oErr } = await db.from('options').insert(optRows);
    if (oErr) { console.error(`    ❌ Opts error: ${oErr.message}`); }
    else insertedO += optRows.length;
  }
  return { insertedQ, insertedO };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('🚀 Iniciando reset + migración completa → Supabase\n');

  await clearAll();

  let totalQ = 0, totalO = 0;

  // Insert courses
  console.log(`📦 Insertando ${STRUCTURE.courses.length} cursos...`);
  for (const course of STRUCTURE.courses) {
    const { error } = await db.from('courses').insert(course);
    if (error) console.error(`  ❌ Course ${course.id}: ${error.message}`);
    else console.log(`  ✅ Course: ${course.id}`);
  }

  // Insert subjects and modules
  console.log(`\n📚 Insertando ${STRUCTURE.subjects.length} asignaturas y sus módulos...\n`);
  for (const subject of STRUCTURE.subjects) {
    const { modules, ...subjectData } = subject;
    const { error: sErr } = await db.from('subjects').insert(subjectData);
    if (sErr) { console.error(`  ❌ Subject ${subject.id}: ${sErr.message}`); continue; }
    console.log(`  📗 ${subject.id} — ${subject.name} (${modules.length} módulos)`);

    for (const mod of modules) {
      const { error: mErr } = await db.from('modules').insert({
        id: mod.id, subject_id: subject.id, name: mod.name
      });
      if (mErr) { console.error(`    ❌ Module ${mod.id}: ${mErr.message}`); continue; }

      if (!mod.file) {
        console.log(`    📂 ${mod.id} — (sin preguntas todavía)`);
        continue;
      }

      const filePath = join(DATA_DIR, mod.file);
      let questions = [];
      try {
        questions = parseTxtFile(filePath);
      } catch (err) {
        console.error(`    ❌ Leyendo ${mod.file}: ${err.message}`);
        continue;
      }

      const { insertedQ, insertedO } = await insertQuestionsAndOptions(mod.id, questions);
      totalQ += insertedQ;
      totalO += insertedO;
      console.log(`    ✅ ${mod.id} — ${insertedQ} preguntas, ${insertedO} opciones`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Migración completada!');
  console.log(`   Preguntas : ${totalQ}`);
  console.log(`   Opciones  : ${totalO}`);
  console.log('═══════════════════════════════════════');
}

migrate().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
