/**
 * migrate-local-to-supabase.mjs
 * 
 * Migra los datos de los archivos .txt locales de preguntasTestCommunity
 * a Supabase. Ejecutar UNA sola vez:
 *   node migrate-local-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://lwtyzqemiipprusmdaor.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dHl6cWVtaWlwcHJ1c21kYW9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4Nzk2MCwiZXhwIjoyMDg5ODYzOTYwfQ.r0UQrqkbQaVSXsdUktASqymg1_xqPXn_EFIhTirtEzM';
const DATA_DIR = 'C:/Users/Jesus/Documents/Proyectos/preguntasTestCommunity/resources/data';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Subject / Course / Category mapping (from index.html) ────────────────────
const SUBJECT_MAP = {
  // id (used as module prefix) → { subjectId, subjectName, courseId, courseName, category, icon }
  'ac':                  { subjectId: 'ac',    name: 'Arquitectura de Computadores', courseId: 'segundo', courseName: 'Segundo Curso', category: 'Segundo Curso', icon: '⚙️' },
  'ada':                 { subjectId: 'ada',   name: 'Algorítmica y Diseño de Algoritmos', courseId: 'segundo', courseName: 'Segundo Curso', category: 'Segundo Curso', icon: '📊' },
  'adi':                 { subjectId: 'adi',   name: 'ADI', courseId: 'tercero', courseName: 'Tercer Curso', category: 'Tercer Curso', icon: '🌐' },
  'dca':                 { subjectId: 'dca',   name: 'Diseño Centrado en el Acceso (DCA)', courseId: 'cuarto-sw', courseName: 'Cuarto Curso (Rama Software)', category: 'Rama Software', icon: '🛠️' },
  'dss':                 { subjectId: 'dss',   name: 'Desarrollo de Software Seguro', courseId: 'tercero', courseName: 'Tercer Curso', category: 'Tercer Curso', icon: '🛡️' },
  'gcs':                 { subjectId: 'gcs',   name: 'Gestión y Control del Software', courseId: 'cuarto-sw', courseName: 'Cuarto Curso (Rama Software)', category: 'Rama Software', icon: '📁' },
  'gpi':                 { subjectId: 'gpi',   name: 'Gestión de Proyectos Informáticos', courseId: 'tercero', courseName: 'Tercer Curso', category: 'Tercer Curso', icon: '📝' },
  'hada':                { subjectId: 'hada',  name: 'Heurísticas y Alg. de Diseño y Análisis', courseId: 'segundo', courseName: 'Segundo Curso', category: 'Segundo Curso', icon: '📊' },
  'ic':                  { subjectId: 'ic',    name: 'Inteligencia Computacional', courseId: 'tercero', courseName: 'Tercer Curso', category: 'Tercer Curso', icon: '🧪' },
  'mads':                { subjectId: 'mads',  name: 'MADS NO OFICIAL', courseId: 'cuarto-sw', courseName: 'Cuarto Curso (Rama Software)', category: 'Rama Software', icon: '💻' },
  'ped':                 { subjectId: 'ped',   name: 'Programación y Estructuras de Datos', courseId: 'segundo', courseName: 'Segundo Curso', category: 'Segundo Curso', icon: '💻' },
  'ppss':                { subjectId: 'ppss',  name: 'Paradigmas y Patrones Software', courseId: 'tercero', courseName: 'Tercer Curso', category: 'Tercer Curso', icon: '🔧' },
  'redes':               { subjectId: 'redes', name: 'Redes', courseId: 'segundo', courseName: 'Segundo Curso', category: 'Segundo Curso', icon: '📡' },
  'sds':                 { subjectId: 'sds',   name: 'SDS NO OFICIAL', courseId: 'cuarto-sw', courseName: 'Cuarto Curso (Rama Software)', category: 'Rama Software', icon: '🛡️' },
  'si':                  { subjectId: 'si',    name: 'Sistemas de Información', courseId: 'tercero', courseName: 'Tercer Curso', category: 'Tercer Curso', icon: '🗄️' },
  'sti':                 { subjectId: 'sti',   name: 'STI', courseId: 'primero', courseName: 'Primer Curso', category: 'Primer Curso', icon: '📚' },
  'taes':                { subjectId: 'taes',  name: 'TAES', courseId: 'tercero', courseName: 'Tercer Curso', category: 'Tercer Curso', icon: '🧪' },
};

// Map filename to { subjectId, moduleName }
function resolveSubjectAndModule(filename) {
  const base = filename.replace('Preguntas.txt', '').replace('.txt', '');

  // Explicit filename → { subjectKey, moduleName }
  const FILE_MAP = {
    'acPractica':          { key: 'ac',    module: 'Práctica' },
    'ac_CP-F2':            { key: 'ac',    module: 'CP Fase 2' },
    'ac_CP-F3':            { key: 'ac',    module: 'CP Fase 3' },
    'ac_CT1-2':            { key: 'ac',    module: 'CT1-CT2' },
    'ac_CT3-4':            { key: 'ac',    module: 'CT3-CT4' },
    'ada-p1':              { key: 'ada',   module: 'Parcial 1' },
    'ada-p2':              { key: 'ada',   module: 'Parcial 2' },
    'ada':                 { key: 'ada',   module: 'Completo' },
    'ada_descartadas':     { key: 'ada',   module: 'Descartadas' },
    'adi':                 { key: 'adi',   module: 'Completo' },
    'dca-NO-OFICIAL':      { key: 'dca',   module: 'NO OFICIAL' },
    'dca':                 { key: 'dca',   module: 'Oficial' },
    'dss':                 { key: 'dss',   module: 'Completo' },
    'gcsp1nooficial':      { key: 'gcs',   module: 'P1 No Oficial 2025' },
    'gcsp1old':            { key: 'gcs',   module: 'P1 Old 2024' },
    'gcsp2old':            { key: 'gcs',   module: 'P2 Old 2024' },
    'gpi':                 { key: 'gpi',   module: 'Completo' },
    'hada':                { key: 'hada',  module: 'Completo' },
    'ic-p1':               { key: 'ic',    module: 'Parcial 1' },
    'MADS-NO-OFICIAL-P1':  { key: 'mads',  module: 'Parcial 1' },
    'MADS-NO-OFICIAL-P2':  { key: 'mads',  module: 'Parcial 2' },
    'ped':                 { key: 'ped',   module: 'Completo' },
    'ppss-p1':             { key: 'ppss',  module: 'Parcial 1' },
    'ppss-p2':             { key: 'ppss',  module: 'Parcial 2' },
    'ppss':                { key: 'ppss',  module: 'Completo' },
    'redesEnero2324':      { key: 'redes', module: 'Enero 23-24' },
    'redesEnero2425':      { key: 'redes', module: 'Enero 24-25' },
    'redesEnero2526':      { key: 'redes', module: 'Enero 25-26' },
    'redesJulio2425':      { key: 'redes', module: 'Julio 24-25' },
    'redes':               { key: 'redes', module: 'Completo' },
    'sds01-presentacion':  { key: 'sds',   module: 'T1 Presentación' },
    'sds02-introgo':       { key: 'sds',   module: 'T2 Intro Go' },
    'sds03-introcripto':   { key: 'sds',   module: 'T3 Intro Criptografía' },
    'sds04-aleatorios':    { key: 'sds',   module: 'T4 Aleatorios' },
    'sds05-flujo':         { key: 'sds',   module: 'T5 Cifrado Flujo' },
    'sds06-bloque':        { key: 'sds',   module: 'T6 Cifrado Bloque' },
    'sds07-hash':          { key: 'sds',   module: 'T7 Hash' },
    'sds08-publica':       { key: 'sds',   module: 'T8 Clave Pública' },
    'sds09-transporte':    { key: 'sds',   module: 'T9 Capa Transporte' },
    'sds10-ejercicios':    { key: 'sds',   module: 'T10 Ejercicios' },
    'sds11-malware':       { key: 'sds',   module: 'T11 Malware' },
    'sds12-ataques':       { key: 'sds',   module: 'T12 Ataques' },
    'sds13-wireless':      { key: 'sds',   module: 'T13 Wireless' },
    'sds14-recomendaciones': { key: 'sds', module: 'T14 Recomendaciones' },
    'si':                  { key: 'si',    module: 'Completo' },
    'sti':                 { key: 'sti',   module: 'Completo' },
    'taesDefinitivo':      { key: 'taes',  module: 'Definitivo Old' },
  };

  const entry = FILE_MAP[base];
  if (!entry) {
    console.warn(`  ⚠️  No mapping for: ${filename}`);
    return null;
  }
  return { subjectKey: entry.key, moduleName: entry.module };
}

// ── Parse .txt ────────────────────────────────────────────────────────────────
function parseTxtFile(filePath) {
  const content = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const blocks = content.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  const questions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 5) continue; // need at least: text, correctIdx, opt1, opt2, opt3

    const text = lines[0];
    const correctIdxRaw = parseInt(lines[1], 10);
    if (isNaN(correctIdxRaw) || correctIdxRaw < 1 || correctIdxRaw > 3) continue;

    // lines[2], [3], [4] → options; lines[5] may be 'NO MARCAR' (ignore)
    const opts = [lines[2], lines[3], lines[4]].filter(Boolean);
    if (opts.length < 2) continue;

    // Extract image URL if embedded in question text (e.g. "texto... https://...")
    let questionText = text;
    let imagePath = null;
    const imgMatch = text.match(/(https?:\/\/\S+)/);
    if (imgMatch) {
      imagePath = imgMatch[1];
      questionText = text.replace(imgMatch[1], '').trim().replace(/\s+$/, '');
    }

    const options = opts.map((optText, idx) => ({
      text: optText,
      is_correct: idx + 1 === correctIdxRaw
    }));

    questions.push({ text: questionText, image_path: imagePath, options });
  }

  return questions;
}

// ── Upsert helpers ────────────────────────────────────────────────────────────
async function upsertCourse(id, name) {
  const { error } = await db.from('courses').upsert({ id, name }, { onConflict: 'id' });
  if (error) throw new Error(`upsertCourse ${id}: ${error.message}`);
}

async function upsertSubject(subjectData) {
  const { error } = await db.from('subjects').upsert(subjectData, { onConflict: 'id' });
  if (error) throw new Error(`upsertSubject ${subjectData.id}: ${error.message}`);
}

async function upsertModule(id, subject_id, name) {
  const { error } = await db.from('modules').upsert({ id, subject_id, name }, { onConflict: 'id' });
  if (error) throw new Error(`upsertModule ${id}: ${error.message}`);
}

async function insertQuestionsAndOptions(moduleId, questions) {
  let insertedQ = 0, insertedO = 0;

  for (const q of questions) {
    const qId = randomUUID();
    const { error: qErr } = await db.from('questions').insert({
      id: qId,
      module_id: moduleId,
      text: q.text,
      image_path: q.image_path
    });
    if (qErr) {
      console.error(`  ❌ Question insert error: ${qErr.message}`);
      continue;
    }
    insertedQ++;

    const optRows = q.options.map(o => ({
      id: randomUUID(),
      question_id: qId,
      text: o.text,
      is_correct: o.is_correct
    }));
    const { error: oErr } = await db.from('options').insert(optRows);
    if (oErr) {
      console.error(`  ❌ Options insert error: ${oErr.message}`);
    } else {
      insertedO += optRows.length;
    }
  }

  return { insertedQ, insertedO };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('🚀 Iniciando migración local → Supabase...\n');

  let totalQ = 0, totalO = 0, totalFiles = 0, skipped = 0;

  // 1. Insert all unique courses
  const uniqueCourses = new Map();
  for (const meta of Object.values(SUBJECT_MAP)) {
    if (!uniqueCourses.has(meta.courseId)) {
      uniqueCourses.set(meta.courseId, meta.courseName);
    }
  }
  console.log(`📦 Insertando ${uniqueCourses.size} cursos...`);
  for (const [id, name] of uniqueCourses) {
    await upsertCourse(id, name);
    console.log(`  ✅ Course: ${id}`);
  }

  // 2. Insert all unique subjects
  const uniqueSubjects = new Map();
  for (const [key, meta] of Object.entries(SUBJECT_MAP)) {
    if (!uniqueSubjects.has(meta.subjectId)) {
      uniqueSubjects.set(meta.subjectId, {
        id: meta.subjectId,
        course_id: meta.courseId,
        name: meta.name,
        icon: meta.icon ?? null,
        category: meta.category ?? null
      });
    }
  }
  console.log(`\n📚 Insertando ${uniqueSubjects.size} asignaturas...`);
  for (const [, subjectData] of uniqueSubjects) {
    await upsertSubject(subjectData);
    console.log(`  ✅ Subject: ${subjectData.id} — ${subjectData.name}`);
  }

  // 3. Process each .txt file
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.txt'));
  console.log(`\n📄 Procesando ${files.length} archivos .txt...\n`);

  for (const filename of files) {
    const resolved = resolveSubjectAndModule(filename);
    if (!resolved) { skipped++; continue; }

    const { subjectKey, moduleName } = resolved;
    const subjectMeta = SUBJECT_MAP[subjectKey];
    if (!subjectMeta) {
      console.warn(`  ⚠️  Subject key not in SUBJECT_MAP: ${subjectKey}`);
      skipped++;
      continue;
    }

    // Derive stable module ID from filename
    const moduleId = basename(filename, '.txt')
      .replace('Preguntas', '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    console.log(`📝 ${filename}`);
    console.log(`   Subject: ${subjectMeta.subjectId} | Module: ${moduleId} (${moduleName})`);

    await upsertModule(moduleId, subjectMeta.subjectId, moduleName);

    const filePath = join(DATA_DIR, filename);
    const questions = parseTxtFile(filePath);
    console.log(`   Preguntas encontradas: ${questions.length}`);

    if (questions.length === 0) { skipped++; continue; }

    const { insertedQ, insertedO } = await insertQuestionsAndOptions(moduleId, questions);
    totalQ += insertedQ;
    totalO += insertedO;
    totalFiles++;
    console.log(`   ✅ Insertadas: ${insertedQ} preguntas, ${insertedO} opciones\n`);
  }

  console.log('═══════════════════════════════════════');
  console.log(`✅ Migración completada!`);
  console.log(`   Archivos procesados: ${totalFiles}`);
  console.log(`   Archivos omitidos  : ${skipped}`);
  console.log(`   Preguntas          : ${totalQ}`);
  console.log(`   Opciones           : ${totalO}`);
  console.log('═══════════════════════════════════════');
}

migrate().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
