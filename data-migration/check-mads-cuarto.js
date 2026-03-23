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

const TO_COURSE_CATEGORY = "Cuarto Curso";
const TO_COURSE_ID = slugify(TO_COURSE_CATEGORY);
const SUBJECT_ID = "mads";

const moduleIds = ["mads-parte-1-no-oficial", "mads-parte-2-no-oficial"];

async function run() {
  console.log(`=== Check MADS in ${TO_COURSE_CATEGORY} ===`);

  for (const moduleId of moduleIds) {
    const modRef = db
      .collection("courses")
      .doc(TO_COURSE_ID)
      .collection("subjects")
      .doc(SUBJECT_ID)
      .collection("modules")
      .doc(moduleId);

    const modSnap = await modRef.get();
    console.log(`Module ${moduleId}: exists=${modSnap.exists}`);

    if (modSnap.exists) {
      const qSnap = await modRef.collection("questions").get();
      console.log(`  questions=${qSnap.size}`);
    }
  }
}

run().catch((e) => {
  console.error("Check failed:", e);
  process.exitCode = 1;
});

