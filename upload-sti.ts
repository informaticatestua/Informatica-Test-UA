import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const DATA_MIGRATION_DIR = path.join(process.cwd(), 'data-migration');
const SERVICE_ACCOUNT_PATH = path.join(DATA_MIGRATION_DIR, 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
    const FIREBASE_DATA_DIR = path.join(DATA_MIGRATION_DIR, 'firestore');
    const questions: any[] = JSON.parse(fs.readFileSync(path.join(FIREBASE_DATA_DIR, 'questions.json'), 'utf-8'));
    
    // Only upload STI
    const stiQuestions = questions.filter(q => q.subjectId === 'sti');
    console.log(`Found ${stiQuestions.length} STI questions. Uploading...`);

    let t = 0;
    let b = db.batch();
    for(let i=0; i<stiQuestions.length; i++) {
        const q = stiQuestions[i];
        const qRef = db.collection('courses').doc('primer-curso')
            .collection('subjects').doc('sti')
            .collection('modules').doc('sti-general')
            .collection('questions').doc(q.id);
        
        b.set(qRef, q);
        t++;
        if (t >= 10) {
            console.log(`Committing 10... (${i+1}/${stiQuestions.length})`);
            await b.commit();
            console.log(`... Success!`);
            b = db.batch();
            t = 0;
        }
    }
    if (t > 0) {
        console.log(`Committing remaining ${t}...`);
        await b.commit();
        console.log(`... Success!`);
    }
    console.log('STI completely uploaded.');
    process.exit(0);
}
run();
