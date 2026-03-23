import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

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

async function run() {
  try {
    const FIREBASE_DATA_DIR = path.join(DATA_MIGRATION_DIR, 'firestore');
    
    const subjects: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'subjects.json'), 'utf-8'));
    const modules: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'modules.json'), 'utf-8'));
    const questions: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'questions.json'), 'utf-8'));

    console.log(`Starting individual concurrent upload for ${questions.length} questions...`);

    let qTotal = 0;
    let promises = [];
    
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
            
        promises.push(qRef.set(q));
        
        if (promises.length >= 100) {
            await Promise.all(promises);
            promises = [];
            qTotal += 100;
            console.log(`...uploaded ${qTotal}/${questions.length} questions`);
        }
    }
    
    if (promises.length > 0) { 
        await Promise.all(promises);
        qTotal += promises.length;
        console.log(`...uploaded remaining questions (Total: ${qTotal})`);
    }
    
    console.log('Finished uploading all questions successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during import:', error);
    process.exit(1);
  }
}

run();
