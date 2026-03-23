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

// Source/destination based on the app's `subject.category` -> course slug convention.
const FROM_COURSE_CATEGORY = "Asignaturas MADS";
const TO_COURSE_CATEGORY = "Cuarto Curso";

const FROM_COURSE_ID = slugify(FROM_COURSE_CATEGORY);
const TO_COURSE_ID = slugify(TO_COURSE_CATEGORY);

// Safety:
// - By default we COPY to the destination but do NOT DELETE the source.
// - Set DELETE_SOURCE=1 to actually remove old documents once you're confident.
const DELETE_SOURCE = process.env.DELETE_SOURCE === "1";

async function moveMads() {
  console.log(`=== Move MADS to Cuarto Curso ===`);
  console.log(`DELETE_SOURCE: ${DELETE_SOURCE ? "1 (deletes will happen)" : "0 (no deletes)"}`);
  console.log(`FROM: courses/${FROM_COURSE_ID}/subjects/*`);
  console.log(`TO:   courses/${TO_COURSE_ID}/subjects/*`);

  const ONLY_MODULE_ID = process.env.ONLY_MODULE_ID || "";

  const sourceCourseRef = db.collection("courses").doc(FROM_COURSE_ID);
  const destCourseRef = db.collection("courses").doc(TO_COURSE_ID);

  // Create destination course doc (optional, but helps keep structure consistent).
  if (true) {
    await destCourseRef.set(
      {
        id: TO_COURSE_ID,
        name: TO_COURSE_CATEGORY,
        order: 99
      },
      { merge: true }
    );
  }

  const sourceSubjectsSnap = await sourceCourseRef.collection("subjects").get();
  if (sourceSubjectsSnap.empty) {
    console.log(`No subjects found under courses/${FROM_COURSE_ID}. Nothing to do.`);
    return;
  }

  // Only move MADS subject(s) - but if your Firestore has multiple, we handle them all.
  const subjectsToMove = sourceSubjectsSnap.docs.filter((d) => d.id === "mads");
  console.log(`Subjects to move (id="mads"): ${subjectsToMove.length}`);

  for (const subjectDoc of subjectsToMove) {
    const subjectId = subjectDoc.id;
    const subjectData = subjectDoc.data() || {};

    const destSubjectRef = destCourseRef.collection("subjects").doc(subjectId);
    const destSubjectData = {
      ...subjectData,
      // Update UI grouping category.
      category: TO_COURSE_CATEGORY,
      courseId: TO_COURSE_ID
    };

    console.log(`\n--- Subject: ${subjectId} ---`);
    console.log(`Copying modules/questions...`);

    const modulesSnap = await subjectDoc.ref.collection("modules").get();
    console.log(`Modules found: ${modulesSnap.size}`);

    await destSubjectRef.set(destSubjectData, { merge: true });

    for (const moduleDoc of modulesSnap.docs) {
      const moduleId = moduleDoc.id;
      const moduleData = moduleDoc.data() || {};

      if (ONLY_MODULE_ID && moduleId !== ONLY_MODULE_ID) {
        console.log(`Skipping module ${moduleId} (ONLY_MODULE_ID=${ONLY_MODULE_ID})`);
        continue;
      }

      const destModuleRef = destSubjectRef.collection("modules").doc(moduleId);
      const destModuleData = {
        ...moduleData,
        courseId: TO_COURSE_ID
      };

      const questionsSnap = await moduleDoc.ref.collection("questions").get();
      console.log(`Module ${moduleId}: questions=${questionsSnap.size}`);

      await destModuleRef.set(destModuleData, { merge: true });

      // Copy questions with batched writes to reduce round-trips/timeouts.
      let batch = db.batch();
      let ops = 0;
      for (const qDoc of questionsSnap.docs) {
        const qRef = destModuleRef.collection("questions").doc(qDoc.id);
        batch.set(qRef, qDoc.data(), { merge: true });
        ops++;

        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();

      if (DELETE_SOURCE) {
        // Delete questions first, then module.
        let batch = db.batch();
        let ops = 0;

        for (const qDoc of questionsSnap.docs) {
          batch.delete(qDoc.ref);
          ops++;
          if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        }
        if (ops > 0) await batch.commit();

        await moduleDoc.ref.delete();
      }
    }

    if (DELETE_SOURCE) {
      await subjectDoc.ref.delete();
    } else {
      console.log(`(No delete) Would delete source subject if DELETE_SOURCE=1: ${subjectDoc.ref.path}`);
    }
  }

  console.log(`\n✅ Done.`);
}

moveMads().catch((e) => {
  console.error("Migration failed:", e);
  process.exitCode = 1;
});

