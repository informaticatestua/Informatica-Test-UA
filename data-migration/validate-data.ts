import fs from 'fs';
import path from 'path';

const FIRESTORE_DIR = path.join(process.cwd(), 'data-migration/firestore');
const OUTPUT_DIR = path.join(process.cwd(), 'data-migration/output');

const subjects = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'subjects.json'), 'utf-8'));
const modules = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'modules.json'), 'utf-8'));
const questions = JSON.parse(fs.readFileSync(path.join(FIRESTORE_DIR, 'questions.json'), 'utf-8'));

console.log('\n=== VALIDATION REPORT ===\n');
console.log(`Total subjects: ${subjects.length}`);
console.log(`Total modules:  ${modules.length}`);
console.log(`Total questions: ${questions.length}`);

// Check required fields on subjects
console.log('\n--- SUBJECT FIELDS CHECK ---');
const subjectRequiredFields = ['id', 'name', 'category', 'icon', 'color', 'createdAt'];
subjects.forEach((s: any) => {
  const missing = subjectRequiredFields.filter(f => !s[f]);
  if (missing.length > 0) {
    console.log(`⚠️  Subject [${s.id}] missing fields: ${missing.join(', ')}`);
  } else {
    console.log(`✅ Subject [${s.id}] - name:"${s.name}" - category:"${s.category}"`);
  }
});

// Check required fields on modules
console.log('\n--- MODULE FIELDS CHECK ---');
const moduleRequiredFields = ['id', 'subjectId', 'name', 'createdAt'];
modules.forEach((m: any) => {
  const missing = moduleRequiredFields.filter(f => !m[f]);
  // Check that parent subject exists
  const parentSubject = subjects.find((s: any) => s.id === m.subjectId);
  if (missing.length > 0 || !parentSubject) {
    console.log(`⚠️  Module [${m.id}] issues: missing fields: [${missing.join(', ')}], parent exists: ${!!parentSubject}`);
  } else {
    const qCount = questions.filter((q: any) => q.moduleId === m.id).length;
    console.log(`✅ Module [${m.id}] (subject:${m.subjectId}) - ${qCount} questions`);
  }
});

// Check required fields on a sample of questions
console.log('\n--- QUESTION FIELDS SAMPLE CHECK ---');
const questionRequiredFields = ['id', 'text', 'type', 'options', 'subjectId', 'moduleId'];
let questionIssues = 0;
questions.forEach((q: any) => {
  const missing = questionRequiredFields.filter(f => !q[f]);
  const parentModule = modules.find((m: any) => m.id === q.moduleId);
  const parentSubject = subjects.find((s: any) => s.id === q.subjectId);
  if (missing.length > 0 || !parentModule || !parentSubject) {
    questionIssues++;
    if (questionIssues <= 20) { // Only show first 20 issues
      console.log(`⚠️  Question [${q.id}] - missing: [${missing.join(', ')}], module exists: ${!!parentModule}, subject exists: ${!!parentSubject}`);
    }
  }
});
if (questionIssues === 0) {
  console.log('✅ All questions have required fields and valid references');
} else {
  console.log(`⚠️  Total questions with issues: ${questionIssues}`);
}

// Summary per subject
console.log('\n--- QUESTIONS PER SUBJECT ---');
subjects.forEach((s: any) => {
  const subjectModules = modules.filter((m: any) => m.subjectId === s.id);
  const subjectQuestions = questions.filter((q: any) => q.subjectId === s.id);
  console.log(`📚 ${s.id.toUpperCase().padEnd(10)} | ${String(subjectModules.length).padStart(2)} modules | ${String(subjectQuestions.length).padStart(5)} questions`);
});

console.log('\n=== END OF VALIDATION ===\n');
