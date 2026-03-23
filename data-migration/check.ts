import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data-migration', 'service-account.json'), 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
    const modules = await db.collectionGroup('modules').get();
    console.log(`Found ${modules.size} modules total using collectionGroup.`);
    modules.docs.forEach(d => {
        console.log(` - ID: ${d.id}, Ref: ${d.ref.path}, SubjectId: ${d.data().subjectId}`);
    });
}

check();
