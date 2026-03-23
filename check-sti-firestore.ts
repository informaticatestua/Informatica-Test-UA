import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data-migration', 'service-account.json'), 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
    const qSnap = await db.collectionGroup('questions').where('subjectId', '==', 'sti').get();
    console.log(`Questions found in Firestore for STI: ${qSnap.size}`);
}

check();
