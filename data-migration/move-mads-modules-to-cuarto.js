import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), "data-migration", "service-account.json");
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const FROM_COURSE_CATEGORY = "Asignaturas MADS";
const TO_COURSE_CATEGORY = "Cuarto Curso";
const SUBJECT_ID = "mads";

const FROM_COURSE_ID = slugify(FROM_COURSE_CATEGORY);
const TO_COURSE_ID = slugify(TO_COURSE_CATEGORY);

// Set DELETE_SOURCE=1 to delete source modules/questions after successful copy.
const DELETE_SOURCE = process.env.DELETE_SOURCE === "1";
const ONLY_MODULE_ID = process.env.ONLY_MODULE_ID || "";

async function copyCollectionBatched({ srcRef, destRef, opName, batchSize = 400 }) {
  const snap = await srcRef.get();
  let batch = db.batch();
  let ops = 0;

  console.log(`${opName}: ${snap.size}`);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    batch.set(destRef.doc(docSnap.id), data, { merge: true });
    ops++;
    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
}

async function deleteCollectionBatched(colRef, batchSize = 400) {
  const snap = await colRef.get();
  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    ops++;
    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

async function run() {
  console.log(`=== Move MADS modules to Cuarto Curso (robust) ===`);
  console.log(`DELETE_SOURCE: ${DELETE_SOURCE ? "1" : "0"}`);
  console.log(`FROM: courses/${FROM_COURSE_ID}/subjects/${SUBJECT_ID}/modules/*`);
  console.log(`TO:   courses/${TO_COURSE_ID}/subjects/${SUBJECT_ID}/modules/*`);

  const sourceSubjectRef = db
    .collection("courses")
    .doc(FROM_COURSE_ID)
    .collection("subjects")
    .doc(SUBJECT_ID);

  const destSubjectRef = db
    .collection("courses")
    .doc(TO_COURSE_ID)
    .collection("subjects")
    .doc(SUBJECT_ID);

  // Try to fetch subject data (may not exist if only subcollections remain).
  const sourceSubjectSnap = await sourceSubjectRef.get();
  const destSubjectSnap = await destSubjectRef.get();

  const fallbackSubjectData =
    destSubjectSnap.exists && destSubjectSnap.data()
      ? destSubjectSnap.data()
      : {
          id: SUBJECT_ID,
          name: "MADS",
          icon: "🔧",
          color: "#212121",
          category: TO_COURSE_CATEGORY
        };

  const subjectData = sourceSubjectSnap.exists ? sourceSubjectSnap.data() : fallbackSubjectData;

  await destSubjectRef.set(
    {
      ...subjectData,
      category: TO_COURSE_CATEGORY,
      courseId: TO_COURSE_ID
    },
    { merge: true }
  );

  const modulesSnap = await sourceSubjectRef.collection("modules").get();
  console.log(`Modules found in source: ${modulesSnap.size}`);

  if (modulesSnap.empty) {
    console.log("Nothing to migrate (source modules are empty).");
    return;
  }

  for (const moduleDoc of modulesSnap.docs) {
    const moduleId = moduleDoc.id;
    if (ONLY_MODULE_ID && moduleId !== ONLY_MODULE_ID) {
      console.log(`Skipping module ${moduleId} (ONLY_MODULE_ID=${ONLY_MODULE_ID})`);
      continue;
    }

    console.log(`\n--- Module: ${moduleId} ---`);

    const sourceModuleRef = moduleDoc.ref;
    const destModuleRef = destSubjectRef.collection("modules").doc(moduleId);

    const moduleData = moduleDoc.data() || {};
    await destModuleRef.set({ ...moduleData, courseId: TO_COURSE_ID }, { merge: true });

    // Copy questions
    await copyCollectionBatched({
      srcRef: sourceModuleRef.collection("questions"),
      destRef: destModuleRef.collection("questions"),
      opName: `Copy questions for ${moduleId}`
    });

    if (DELETE_SOURCE) {
      console.log(`Deleting source module/questions for ${moduleId}...`);
      await deleteCollectionBatched(sourceModuleRef.collection("questions"));
      await sourceModuleRef.delete();
    }
  }

  if (DELETE_SOURCE) {
    // Best effort: if subject doc exists, delete it (doesn't delete subcollections).
    try {
      await sourceSubjectRef.delete();
    } catch {}
  }

  console.log(`\n✅ Migration finished.`);
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exitCode = 1;
});

