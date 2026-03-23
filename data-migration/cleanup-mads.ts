import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'data-migration', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findAndDeleteDuplicateMads() {
  console.log('\n=== FINDING DUPLICATE MADS SUBJECTS ===\n');

  const subjectsSnap = await db.collectionGroup('subjects').get();
  
  // Find all 'mads' subject docs with their full paths  
  const madsSubjects = subjectsSnap.docs.filter(d => d.id === 'mads');
  console.log(`Found ${madsSubjects.length} 'mads' subject documents:`);
  
  for (const doc of madsSubjects) {
    console.log(`  Path: ${doc.ref.path}`);
    const data = doc.data();
    console.log(`  courseId: ${data.courseId}, category: ${data.category}`);
    
    // Check modules under this subject
    const modulesSnap = await doc.ref.collection('modules').get();
    console.log(`  Modules (${modulesSnap.size}):`);
    for (const mDoc of modulesSnap.docs) {
      const qSnap = await mDoc.ref.collection('questions').count().get();
      console.log(`    - ${mDoc.id}: ${qSnap.data().count} questions`);
    }
  }

  // The stale subject is the one NOT under 'asignaturas-mads' course
  const staleSubjects = madsSubjects.filter(d => !d.ref.path.includes('asignaturas-mads'));
  
  if (staleSubjects.length === 0) {
    console.log('\n✅ No stale MADS subjects found. All good!');
    return;
  }
  
  console.log(`\nFound ${staleSubjects.length} stale MADS subject(s) to delete...`);
  
  for (const staleDoc of staleSubjects) {
    console.log(`\n🗑️  Deleting stale subject at: ${staleDoc.ref.path}`);
    
    const modulesSnap = await staleDoc.ref.collection('modules').get();
    for (const mDoc of modulesSnap.docs) {
      console.log(`   Deleting stale module: ${mDoc.id}`);
      // Delete questions first
      const questionsSnap = await mDoc.ref.collection('questions').get();
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
      await mDoc.ref.delete();
      console.log(`   Deleted module ${mDoc.id} (with ${questionsSnap.size} questions)`);
    }
    
    await staleDoc.ref.delete();
    console.log(`   Deleted stale subject: ${staleDoc.id}`);
  }
  
  // Also check for orphaned old course (if all subjects were removed from it)
  const coursesSnap = await db.collection('courses').get();
  for (const courseDoc of coursesSnap.docs) {
    const subjectsInCourse = await courseDoc.ref.collection('subjects').get();
    if (subjectsInCourse.size === 0) {
      // This course is now empty - unlikely but check
      const data = courseDoc.data();
      console.log(`\n⚠️  Course [${courseDoc.id}] has 0 subjects.`);
    }
  }
  
  console.log('\n✅ Cleanup complete!');
}

findAndDeleteDuplicateMads().catch(console.error);
