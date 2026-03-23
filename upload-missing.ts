import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const DATA_MIGRATION_DIR = path.join(process.cwd(), 'data-migration');
const SERVICE_ACCOUNT_PATH = path.join(DATA_MIGRATION_DIR, 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

async function run() {
    console.log('Using BulkWriter for PED/REDES uploads...');
    const FIREBASE_DATA_DIR = path.join(DATA_MIGRATION_DIR, 'firestore');
    
    const subjects = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'subjects.json'), 'utf-8'));
    const questions: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'questions.json'), 'utf-8'));
    
    const targetSubjects = ['ped', 'redes'];
    const targetQuestions = questions.filter((q: any) => targetSubjects.includes(q.subjectId));
    console.log(`Uploading ${targetQuestions.length} questions via bulkWriter.`);

    const writer = db.bulkWriter();
    writer.onWriteError((error: any) => {
        console.error(`Error writing document: ${error.message}`);
        return true; // Retry
    });

    for(let i=0; i<targetQuestions.length; i++) {
        const q = targetQuestions[i];
        const parentSubject = subjects.find((s: any) => s.id === q.subjectId);
        if (!parentSubject) continue;

        const courseId = slugify(parentSubject.category);
        const qRef = db.collection('courses').doc(courseId)
            .collection('subjects').doc(q.subjectId)
            .collection('modules').doc(q.moduleId)
            .collection('questions').doc(q.id);
        
        writer.set(qRef, q);
    }
    
    console.log('Flushing writes to database (this handles rate limits automatically)...');
    await writer.close(); // Flushes and waits for all writes to complete
    
    console.log('Complete!');
    process.exit(0);
}
run();
