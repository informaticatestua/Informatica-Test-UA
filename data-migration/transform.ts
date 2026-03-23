import fs from 'fs';
import path from 'path';

const INPUT_DIR = path.join(process.cwd(), 'data-migration/output');
const CONFIG_FILE = path.join(process.cwd(), 'data-migration/subjects-config.json');
const FINAL_OUTPUT_DIR = path.join(process.cwd(), 'data-migration/firestore');

if (!fs.existsSync(FINAL_OUTPUT_DIR)) {
  fs.mkdirSync(FINAL_OUTPUT_DIR, { recursive: true });
}

const fileMapping: Record<string, { subjectId: string, subjectName: string, category: string, moduleName: string }> = {
  // Primer Curso
  'stiPreguntas.json': { subjectId: 'sti', subjectName: 'STI', category: 'Primer Curso', moduleName: 'General' },

  // Segundo Curso
  'ada-p1Preguntas.json': { subjectId: 'ada', subjectName: 'ADA', category: 'Segundo Curso', moduleName: 'Parcial 1' },
  'ada-p2Preguntas.json': { subjectId: 'ada', subjectName: 'ADA', category: 'Segundo Curso', moduleName: 'Parcial 2' },
  'adaPreguntas.json': { subjectId: 'ada', subjectName: 'ADA', category: 'Segundo Curso', moduleName: 'General' },
  'ada_descartadasPreguntas.json': { subjectId: 'ada', subjectName: 'ADA', category: 'Segundo Curso', moduleName: 'Descartadas' },
  
  'ac_CP-F2_Preguntas.json': { subjectId: 'ac', subjectName: 'AC', category: 'Segundo Curso', moduleName: 'CP-F2' },
  'ac_CP-F3_Preguntas.json': { subjectId: 'ac', subjectName: 'AC', category: 'Segundo Curso', moduleName: 'CP-F3' },
  'ac_CT1-2_Preguntas.json': { subjectId: 'ac', subjectName: 'AC', category: 'Segundo Curso', moduleName: 'CT1-2' },
  'ac_CT3-4_Preguntas.json': { subjectId: 'ac', subjectName: 'AC', category: 'Segundo Curso', moduleName: 'CT3-4' },
  'acPracticaPreguntas.json': { subjectId: 'ac', subjectName: 'AC', category: 'Segundo Curso', moduleName: 'Práctica' },

  'pedPreguntas.json': { subjectId: 'ped', subjectName: 'PED', category: 'Segundo Curso', moduleName: 'General' },

  'redesPreguntas.json': { subjectId: 'redes', subjectName: 'REDES', category: 'Segundo Curso', moduleName: 'General' },
  'redesEnero2324Preguntas.json': { subjectId: 'redes', subjectName: 'REDES', category: 'Segundo Curso', moduleName: 'Enero 2023-2024' },
  'redesEnero2425Preguntas.json': { subjectId: 'redes', subjectName: 'REDES', category: 'Segundo Curso', moduleName: 'Enero 2024-2025' },
  'redesEnero2526Preguntas.json': { subjectId: 'redes', subjectName: 'REDES', category: 'Segundo Curso', moduleName: 'Enero 2025-2026' },
  'redesJulio2425Preguntas.json': { subjectId: 'redes', subjectName: 'REDES', category: 'Segundo Curso', moduleName: 'Julio 2024-2025' },

  'hadaPreguntas.json': { subjectId: 'hada', subjectName: 'HADA', category: 'Segundo Curso', moduleName: 'General' },

  // Tercer Curso
  'adiPreguntas.json': { subjectId: 'adi', subjectName: 'ADI', category: 'Tercer Curso', moduleName: 'General' },
  'dssPreguntas.json': { subjectId: 'dss', subjectName: 'DSS', category: 'Tercer Curso', moduleName: 'General' },
  'gpiPreguntas.json': { subjectId: 'gpi', subjectName: 'GPI', category: 'Tercer Curso', moduleName: 'General' },
  'ic-p1.json': { subjectId: 'ic', subjectName: 'IC', category: 'Tercer Curso', moduleName: 'Parte 1' },
  'siPreguntas.json': { subjectId: 'si', subjectName: 'SI', category: 'Tercer Curso', moduleName: 'General' },
  'taesDefinitivoPreguntas.json': { subjectId: 'taes', subjectName: 'TAES', category: 'Tercer Curso', moduleName: 'Definitivo' },
  'ppss-p1Preguntas.json': { subjectId: 'ppss', subjectName: 'PPSS', category: 'Tercer Curso', moduleName: 'Parte 1' },
  'ppss-p2Preguntas.json': { subjectId: 'ppss', subjectName: 'PPSS', category: 'Tercer Curso', moduleName: 'Parte 2' },

  // Rama Software
  'dcaPreguntas.json': { subjectId: 'dca', subjectName: 'DCA', category: 'Rama Software', moduleName: 'Oficial' },
  'dca-NO-OFICIALPreguntas.json': { subjectId: 'dca', subjectName: 'DCA', category: 'Rama Software', moduleName: 'No Oficial' },

  'gcsp1nooficialPreguntas.json': { subjectId: 'gcs', subjectName: 'GCS', category: 'Rama Software', moduleName: 'P1 No Oficial' },
  'gcsp1oldPreguntas.json': { subjectId: 'gcs', subjectName: 'GCS', category: 'Rama Software', moduleName: 'P1 Antiguo' },
  'gcsp2oldPreguntas.json': { subjectId: 'gcs', subjectName: 'GCS', category: 'Rama Software', moduleName: 'P2 Antiguo' },

  'sds01-presentacionPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Presentación' },
  'sds02-introgoPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Introducción General' },
  'sds03-introcriptoPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Introducción a Criptografía' },
  'sds04-aleatoriosPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Aleatorios' },
  'sds05-flujoPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Flujo' },
  'sds06-bloquePreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Bloque' },
  'sds07-hashPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Hash' },
  'sds08-publicaPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Pública' },
  'sds09-transportePreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Transporte' },
  'sds10-ejerciciosPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Ejercicios' },
  'sds11-malwarePreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Malware' },
  'sds12-ataquesPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Ataques' },
  'sds13-wirelessPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Wireless' },
  'sds14-recomendacionesPreguntas.json': { subjectId: 'sds', subjectName: 'SDS', category: 'Rama Software', moduleName: 'Recomendaciones' },

  // Asignaturas MADS
  'MADS-NO-OFICIAL-P1Preguntas.json': { subjectId: 'mads', subjectName: 'MADS', category: 'Cuarto Curso', moduleName: 'Parte 1 No Oficial' },
  'MADS-NO-OFICIAL-P2Preguntas.json': { subjectId: 'mads', subjectName: 'MADS', category: 'Cuarto Curso', moduleName: 'Parte 2 No Oficial' },
};

const subjectsConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

const subjects: any[] = [];
const modules: any[] = [];
const questions: any[] = [];

const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), 'utf-8'));
  
  if (!fileMapping[file]) {
    console.warn(`WARNING: File ${file} has no explicit mapping. Skipping.`);
    return;
  }

  const { subjectId, subjectName, category, moduleName } = fileMapping[file];

  // Add subject if not exists
  if (!subjects.find(s => s.id === subjectId)) {
    const config = subjectsConfig[subjectId] || { icon: '📚', color: '#666666' };
    subjects.push({
      id: subjectId,
      name: subjectName,
      category: category,
      icon: config.icon,
      color: config.color,
      createdAt: new Date().toISOString()
    });
  }

  const moduleId = `${subjectId}-${moduleName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  
  // Add module if not exists
  if (!modules.find(m => m.id === moduleId)) {
    modules.push({
      id: moduleId,
      subjectId: subjectId,
      name: moduleName,
      createdAt: new Date().toISOString()
    });
  }

  // Add questions
  data.forEach((q: any) => {
    questions.push({
      ...q,
      subjectId,
      moduleId,
    });
  });
});

// Calculate total questions for subjects and modules to save time in UI later
export const processStats = () => {
    // We could add counts directly here if caching
}

fs.writeFileSync(path.join(FINAL_OUTPUT_DIR, 'subjects.json'), JSON.stringify(subjects, null, 2));
fs.writeFileSync(path.join(FINAL_OUTPUT_DIR, 'modules.json'), JSON.stringify(modules, null, 2));
fs.writeFileSync(path.join(FINAL_OUTPUT_DIR, 'questions.json'), JSON.stringify(questions, null, 2));

console.log(`Transformation complete!`);
console.log(`Subjects: ${subjects.length}`);
console.log(`Modules: ${modules.length}`);
console.log(`Questions: ${questions.length}`);
