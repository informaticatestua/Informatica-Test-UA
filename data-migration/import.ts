import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Use process.cwd() for ESM compatibility
const DATA_MIGRATION_DIR = path.join(process.cwd(), 'data-migration');
const SERVICE_ACCOUNT_PATH = path.join(DATA_MIGRATION_DIR, 'service-account.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('Error: service-account.json not found in data-migration folder.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const order = ['Primer Curso', 'Segundo Curso', 'Tercer Curso', 'Rama Software', 'Cuarto Curso'];

async function run() {
  try {
    const FIREBASE_DATA_DIR = path.join(DATA_MIGRATION_DIR, 'firestore');
    
    const subjects: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'subjects.json'), 'utf-8'));
    const modules: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'modules.json'), 'utf-8'));
    const questions: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'questions.json'), 'utf-8'));

    console.log(`Starting nested import for ${subjects.length} subjects, ${modules.length} modules, and ${questions.length} questions...`);

    // 1. Process Courses & Subjects
    let batch = db.batch();
    let count = 0;
    
    for (const subject of subjects) {
        const courseId = slugify(subject.category);
        
        // Ensure Course document exists
        const courseRef = db.collection('courses').doc(courseId);
        batch.set(courseRef, { 
            id: courseId, 
            name: subject.category,
            order: order.indexOf(subject.category) !== -1 ? order.indexOf(subject.category) : 99
        }, { merge: true });

        // Add Subject as subcollection
        const subjectRef = courseRef.collection('subjects').doc(subject.id);
        batch.set(subjectRef, { ...subject, courseId });
        
        count += 2;
        if (count >= 400) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0) { await batch.commit(); batch = db.batch(); count = 0; }
    console.log('Finished uploading subjects.');

    // 2. Process Modules
    for (const mod of modules) {
        const parentSubject = subjects.find(s => s.id === mod.subjectId);
        if (!parentSubject) continue;
        
        const courseId = slugify(parentSubject.category);
        const modRef = db.collection('courses').doc(courseId)
            .collection('subjects').doc(mod.subjectId)
            .collection('modules').doc(mod.id);
            
        batch.set(modRef, { ...mod, courseId });
        count++;
        if (count >= 400) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0) { await batch.commit(); batch = db.batch(); count = 0; }
    console.log('Finished uploading modules.');

    // Helper to prevent deadline exceeded
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 3. Process Questions
    let qTotal = 0;
    for (const q of questions) {
        const parentModule = modules.find(m => m.id === q.moduleId);
        if (!parentModule) continue;
        const parentSubject = subjects.find(s => s.id === q.subjectId);
        if (!parentSubject) continue;
        
        const courseId = slugify(parentSubject.category);
        const qRef = db.collection('courses').doc(courseId)
            .collection('subjects').doc(q.subjectId)
            .collection('modules').doc(q.moduleId)
            .collection('questions').doc(q.id);
            
        batch.set(qRef, q);
        count++;
        qTotal++;
        if (count >= 200) {
            await batch.commit();
            await sleep(500);
            batch = db.batch();
            count = 0;
            console.log(`...uploaded ${qTotal}/${questions.length} questions`);
        }
    }
    if (count > 0) { 
        await batch.commit();
        console.log(`...uploaded remaining questions (Total: ${qTotal})`);
    }
    console.log('Finished uploading questions.');

    console.log('Successfully imported all nested data to Firestore!');
  } catch (error) {
    console.error('Error during import:', error);
  }
}

run();
