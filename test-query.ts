import { getQuestionsForModule } from './src/lib/firebase/service';

async function check() {
    const questions = await getQuestionsForModule('ac-ct1-2');
    console.log(`Questions found for ac-ct1-2: ${questions.length}`);
}

check().catch(console.error);
