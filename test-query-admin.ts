import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data-migration', 'service-account.json'), 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
    const questions = await db.collectionGroup('questions').where('moduleId', '==', 'ac-ct1-2').get();
    console.log(`Questions found via collectionGroup for ac-ct1-2: ${questions.size}`);
    
    // Testing getQuestionsForModule logic from service.ts
    const moduleId = 'ac-ct1-2';
    const modulesSnap = await db.collectionGroup('modules').get();
    const targetModule = modulesSnap.docs.find((d: any) => d.id === moduleId)?.data();
    if(targetModule) {
        const qSnap = await db.collection('courses').doc(targetModule.courseId)
            .collection('subjects').doc(targetModule.subjectId)
            .collection('modules').doc(moduleId)
            .collection('questions').get();
        console.log(`Direct path questions for ${moduleId}: ${qSnap.size}`);
    } else {
        console.log('Target module not found.');
    }
}

check();
