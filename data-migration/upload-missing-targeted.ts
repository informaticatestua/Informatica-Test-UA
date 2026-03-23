import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'data-migration', 'service-account.json');
const FIRESTORE_DIR = path.join(process.cwd(), 'data-migration', 'firestore');

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const localSubjects: any[] = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'subjects.json'), 'utf-8'));
const localModules: any[] = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'modules.json'), 'utf-8'));
const localQuestions: any[] = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'questions.json'), 'utf-8'));

const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const order = ['Primer Curso', 'Segundo Curso', 'Tercer Curso', 'Rama Software', 'Cuarto Curso'];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Modules that are MISSING in Firestore (0 questions) or incomplete
const MODULES_TO_UPLOAD = [
  'sti-general',           // 120 in FS, 207 local -> upload missing 87
  'mads-parte-1-no-oficial', // 231 in FS, 664 local -> upload missing
  'mads-parte-2-no-oficial', // 0 in FS, 384 local
  'sds-presentaci-n',
  'sds-introducci-n-general',
  'sds-introducci-n-a-criptograf-a',
  'sds-aleatorios',
  'sds-flujo',
  'sds-bloque',
  'sds-hash',
  'sds-p-blica',
  'sds-transporte',
  'sds-ejercicios',
  'sds-malware',
  'sds-ataques',
  'sds-wireless',
  'sds-recomendaciones',
  'ped-general',
  'redes-enero-2023-2024',
  'redes-enero-2024-2025',
  'redes-enero-2025-2026',
  'redes-julio-2024-2025',
  'redes-general',
  'ppss-parte-1',
  'ppss-parte-2',
  'si-general',
  'taes-definitivo',
  'gcs-p1-no-oficial',  // renamed from gcsp1-no-oficial
  'gcs-p1-antiguo',     // renamed from gcsp1-antiguo
  'gcs-p2-antiguo',     // renamed from gcsp2-antiguo
];

// OLD stale module IDs to delete (wrong IDs from previous import)
const STALE_MODULE_IDS = [
  'gcsp1-no-oficial',
  'gcsp1-antiguo',
  'gcsp2-antiguo',
];

// Old subject IDs to delete
const STALE_SUBJECT_IDS = ['gcsp1', 'gcsp2'];

async function deleteStaleDocuments() {
  console.log('\n--- Deleting stale GCS documents ---');
  
  // Delete stale modules
  const modulesSnap = await db.collectionGroup('modules').get();
  for (const doc of modulesSnap.docs) {
    if (STALE_MODULE_IDS.includes(doc.id)) {
      console.log(`🗑️  Deleting stale module: ${doc.ref.path}`);
      // Delete questions sub-collection first
      const questionsSnap = await doc.ref.collection('questions').get();
      let batch = db.batch();
      let count = 0;
      for (const qDoc of questionsSnap.docs) {
        batch.delete(qDoc.ref);
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
      
      await doc.ref.delete();
      console.log(`  Deleted module ${doc.id} (with ${questionsSnap.size} questions)`);
    }
  }
  
  // Delete stale subjects
  const subjectsSnap = await db.collectionGroup('subjects').get();
  for (const doc of subjectsSnap.docs) {
    if (STALE_SUBJECT_IDS.includes(doc.id)) {
      console.log(`🗑️  Deleting stale subject: ${doc.ref.path} (${doc.id})`);
      await doc.ref.delete();
    }
  }
}

async function getExistingQuestionIds(moduleRef: FirebaseFirestore.DocumentReference): Promise<Set<string>> {
  const qSnap = await moduleRef.collection('questions').get();
  return new Set(qSnap.docs.map(d => d.id));
}

async function uploadModuleQuestions(mod: any, subject: any) {
  const courseId = slugify(subject.category);
  const modRef = db.collection('courses').doc(courseId)
    .collection('subjects').doc(mod.subjectId)
    .collection('modules').doc(mod.id);

  // Ensure module document exists
  await modRef.set({ ...mod, courseId }, { merge: true });

  // Get existing question IDs to avoid duplicates
  const existingIds = await getExistingQuestionIds(modRef);
  
  const moduleQuestions = localQuestions.filter((q: any) => q.moduleId === mod.id);
  const newQuestions = moduleQuestions.filter((q: any) => !existingIds.has(q.id));
  
  console.log(`📦 Module [${mod.id}]: ${moduleQuestions.length} total, ${existingIds.size} existing, ${newQuestions.length} to upload`);
  
  if (newQuestions.length === 0) {
    console.log(`   ✅ Nothing to upload`);
    return 0;
  }

  let batch = db.batch();
  let count = 0;
  let uploaded = 0;

  for (const q of newQuestions) {
    const qRef = modRef.collection('questions').doc(q.id);
    batch.set(qRef, q);
    count++;
    uploaded++;

    if (count >= 200) {
      await batch.commit();
      await sleep(500);
      batch = db.batch();
      count = 0;
      console.log(`   ...uploaded ${uploaded}/${newQuestions.length}`);
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`   ...uploaded remaining (Total: ${uploaded})`);
  }

  console.log(`   ✅ Done! Uploaded ${uploaded} questions to [${mod.id}]`);
  return uploaded;
}

async function run() {
  console.log('\n=== TARGETED UPLOAD TO FIRESTORE ===\n');

  // Step 1: Delete stale documents
  await deleteStaleDocuments();

  // Step 2: Ensure all local subjects exist in Firestore (update to make sure)
  console.log('\n--- Ensuring all subjects are up to date in Firestore ---');
  let batch = db.batch();
  let count = 0;
  
  for (const subject of localSubjects) {
    const courseId = slugify(subject.category);
    // Ensure course exists
    const courseRef = db.collection('courses').doc(courseId);
    batch.set(courseRef, {
      id: courseId,
      name: subject.category,
      order: order.indexOf(subject.category) !== -1 ? order.indexOf(subject.category) : 99
    }, { merge: true });
    
    // Ensure subject exists
    const subjectRef = courseRef.collection('subjects').doc(subject.id);
    batch.set(subjectRef, { ...subject, courseId }, { merge: true });
    count += 2;
    
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) { await batch.commit(); }
  console.log('✅ All subjects ensured in Firestore.');

  // Step 3: Upload missing questions for each target module
  console.log('\n--- Uploading missing questions ---');
  let totalUploaded = 0;
  
  for (const modId of MODULES_TO_UPLOAD) {
    const mod = localModules.find((m: any) => m.id === modId);
    if (!mod) {
      console.log(`⚠️  Module ${modId} not found in local data, skipping.`);
      continue;
    }
    const subject = localSubjects.find((s: any) => s.id === mod.subjectId);
    if (!subject) {
      console.log(`⚠️  Subject for module ${modId} not found, skipping.`);
      continue;
    }
    
    const uploaded = await uploadModuleQuestions(mod, subject);
    totalUploaded += uploaded;
    await sleep(300);
  }
  
  console.log(`\n✅ Upload complete! Total questions uploaded: ${totalUploaded}`);
  console.log('\n=== END OF TARGETED UPLOAD ===\n');
}

run().catch(console.error);
