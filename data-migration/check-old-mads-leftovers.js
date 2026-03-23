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

const OLD_COURSE_CATEGORY = "Asignaturas MADS";
const OLD_COURSE_ID = slugify(OLD_COURSE_CATEGORY);
const SUBJECT_ID = "mads";

async function run() {
  console.log(`=== Check leftovers in old course: courses/${OLD_COURSE_ID}/subjects/${SUBJECT_ID} ===`);

  const modulesSnap = await db
    .collection("courses")
    .doc(OLD_COURSE_ID)
    .collection("subjects")
    .doc(SUBJECT_ID)
    .collection("modules")
    .get();

  console.log(`modules=${modulesSnap.size}`);

  let totalQuestions = 0;
  for (const moduleDoc of modulesSnap.docs) {
    const qSnap = await moduleDoc.ref.collection("questions").get();
    totalQuestions += qSnap.size;
    console.log(`  module=${moduleDoc.id}, questions=${qSnap.size}`);
  }

  console.log(`totalQuestions=${totalQuestions}`);
}

run().catch((e) => {
  console.error("Check failed:", e);
  process.exitCode = 1;
});

