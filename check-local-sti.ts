import * as fs from 'fs';

const questions = JSON.parse(fs.readFileSync('data-migration/firestore/questions.json', 'utf-8'));
const stiQuestions = questions.filter((q: any) => q.subjectId === 'sti');

console.log(`STI Questions inside local questions.json: ${stiQuestions.length}`);
if (stiQuestions.length > 0) {
    console.log(`First STI Question:`);
    console.log(JSON.stringify(stiQuestions[0], null, 2));
}
