import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data-migration', 'service-account.json'), 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
    // get STI module path
    const courseId = 'primer-curso';
    const subjectId = 'sti';
    const moduleId = 'sti-general';
    const qSnap = await db.collection('courses').doc(courseId)
        .collection('subjects').doc(subjectId)
        .collection('modules').doc(moduleId)
        .collection('questions').get();
    
    console.log(`Questions found in Firestore for STI: ${qSnap.size}`);
}

check();
