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
const FROM_COURSE_ID = slugify(FROM_COURSE_CATEGORY);

const DELETE_COURSE_DOC = process.env.DELETE_COURSE_DOC === "1";

async function run() {
  const courseRef = db.collection("courses").doc(FROM_COURSE_ID);
  const subjectsSnap = await courseRef.collection("subjects").get();
  console.log(`Old course: courses/${FROM_COURSE_ID}`);
  console.log(`Subjects count under old course: ${subjectsSnap.size}`);

  if (subjectsSnap.empty) {
    console.log("Old course has no subjects.");
    if (DELETE_COURSE_DOC) {
      await courseRef.delete();
      console.log("Deleted old course doc.");
    } else {
      console.log("DELETE_COURSE_DOC not enabled; not deleting course doc.");
    }
  } else {
    console.log("Old course still has subjects; skipping delete.");
  }
}

run().catch((e) => {
  console.error("Check failed:", e);
  process.exitCode = 1;
});

