import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'data-migration', 'service-account.json');
const FIRESTORE_DIR = path.join(process.cwd(), 'data-migration', 'firestore');

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const localSubjects = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'subjects.json'), 'utf-8'));
const localModules = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'modules.json'), 'utf-8'));
const localQuestions = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'questions.json'), 'utf-8'));

async function checkFirestore() {
  console.log('\n=== FIRESTORE STATE REPORT ===\n');

  // Check courses
  const coursesSnap = await db.collection('courses').get();
  console.log(`📁 Courses in Firestore: ${coursesSnap.size}`);
  coursesSnap.docs.forEach(d => {
    console.log(`   - ${d.id}: ${JSON.stringify(d.data())}`);
  });

  // Check subjects via collectionGroup
  const subjectsSnap = await db.collectionGroup('subjects').get();
  console.log(`\n📚 Subjects in Firestore: ${subjectsSnap.size} (local: ${localSubjects.length})`);
  
  const fsSubjectIds = subjectsSnap.docs.map(d => d.id);
  const localSubjectIds = localSubjects.map((s: any) => s.id);
  
  // Missing from Firestore
  const missingSubjects = localSubjectIds.filter((id: string) => !fsSubjectIds.includes(id));
  if (missingSubjects.length > 0) {
    console.log(`⚠️  Subjects missing from Firestore: ${missingSubjects.join(', ')}`);
  }

  // Check each subject's data completeness
  console.log('\n--- Subject data completeness ---');
  for (const doc of subjectsSnap.docs) {
    const data = doc.data();
    const localMatch = localSubjects.find((s: any) => s.id === doc.id);
    const requiredFields = ['id', 'name', 'category', 'icon', 'color', 'courseId'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) {
      console.log(`⚠️  [${doc.id}] missing fields in Firestore: ${missing.join(', ')}`);
      console.log(`     Firestore data: ${JSON.stringify(data)}`);
    } else {
      console.log(`✅ [${doc.id}] complete`);
    }
  }

  // Check modules via collectionGroup
  const modulesSnap = await db.collectionGroup('modules').get();
  console.log(`\n📦 Modules in Firestore: ${modulesSnap.size} (local: ${localModules.length})`);

  const fsModuleIds = modulesSnap.docs.map(d => d.id);
  const localModuleIds = localModules.map((m: any) => m.id);
  
  const missingModules = localModuleIds.filter((id: string) => !fsModuleIds.includes(id));
  if (missingModules.length > 0) {
    console.log(`⚠️  Modules missing from Firestore: ${missingModules.join(', ')}`);
  }

  // Check module data completeness
  console.log('\n--- Module data completeness ---');
  for (const doc of modulesSnap.docs) {
    const data = doc.data();
    const requiredFields = ['id', 'name', 'subjectId', 'courseId'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) {
      console.log(`⚠️  Module [${doc.id}] missing fields: ${missing.join(', ')}`);
      console.log(`     Data: ${JSON.stringify(data)}`);
    }
  }

  // Query questions count per module in Firestore
  console.log('\n--- Questions count per module (Firestore vs local) ---');
  for (const doc of modulesSnap.docs) {
    const data = doc.data();
    const qSnap = await doc.ref.collection('questions').count().get();
    const fsCount = qSnap.data().count;
    const localCount = localQuestions.filter((q: any) => q.moduleId === doc.id).length;
    const status = fsCount === localCount ? '✅' : '⚠️ ';
    console.log(`${status} Module [${doc.id}]: Firestore=${fsCount}, Local=${localCount}`);
  }

  // Check for local modules not in Firestore
  const extraLocalModules = localModuleIds.filter((id: string) => !fsModuleIds.includes(id));
  if (extraLocalModules.length > 0) {
    console.log(`\n⚠️  Local modules NOT in Firestore: ${extraLocalModules.join(', ')}`);
    extraLocalModules.forEach((id: string) => {
      const m = localModules.find((m: any) => m.id === id);
      const localCount = localQuestions.filter((q: any) => q.moduleId === id).length;
      console.log(`   - ${id}: ${localCount} local questions`);
    });
  }

  console.log('\n=== END OF FIRESTORE CHECK ===\n');
}

checkFirestore().catch(console.error);
