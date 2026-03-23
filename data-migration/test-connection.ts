import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'data-migration/service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function test() {
  try {
    console.log("Testing connection to Firestore project:", serviceAccount.project_id);
    const collections = await db.listCollections();
    console.log("Successfully connected. Collections found:", collections.length);
    collections.forEach(c => console.log(" - ", c.id));
  } catch (e) {
    console.error("Connection failed with error:");
    console.error(e);
  }
}

test();
