const fs = require('fs');
const questions = JSON.parse(fs.readFileSync('data-migration/firestore/questions.json', 'utf8'));
const stiQuestions = questions.filter(q => q.subjectId === 'sti');
console.log('STI Questions count:', stiQuestions.length);
if (stiQuestions.length > 0) {
    console.log('Sample moduleId:', stiQuestions[0].moduleId);
}
