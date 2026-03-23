import fs from 'fs';
import path from 'path';

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text: string;
  type: 'multiple_choice' | 'true_false';
  options: Option[];
  imagePath?: string;
  mathSupported: boolean;
  createdAt: string;
}

const DATA_DIR = 'c:/Users/Jesus/Documents/Proyectos/preguntasTestCommunity/resources/data';
const OUTPUT_DIR = path.join(process.cwd(), 'data-migration/output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function parseFile(filename: string) {
  const filePath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  // Use a more robust split that preserves structure
  const blocks = content.split(/\n\s*\n/).map(b => b.trim()).filter(b => b !== '');
  
  const questions: Question[] = [];

  blocks.forEach((block, index) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length < 3) return; // Need at least Question, Index, and 1 Option

    let questionText = '';
    let correctOptionIndex = -1;
    let optionsStartLine = -1;

    // The first line is usually the question, but it could be multiple lines
    // Let's find the correct index line (a single digit)
    for (let i = 0; i < lines.length; i++) {
      if (!isNaN(parseInt(lines[i])) && lines[i].length === 1) {
        correctOptionIndex = parseInt(lines[i]);
        questionText = lines.slice(0, i).join(' ').trim();
        optionsStartLine = i + 1;
        break;
      }
    }

    if (correctOptionIndex !== -1 && optionsStartLine !== -1) {
      const optionsRaw = lines.slice(optionsStartLine);
      const options: Option[] = optionsRaw.map((opt, i) => {
        const text = opt.replace(/^- /, '').trim();
        return {
          id: String.fromCharCode(97 + i),
          text: text,
          isCorrect: (i + 1) === correctOptionIndex
        };
      }).filter(o => o.text.toLowerCase() !== 'no marcar');

      if (options.length > 0) {
        // Detect images in question text
        // Format example: ![Diagrama](/data/images/ppss-p1-1.png){width=200 height=200}
        let imagePath: string | undefined = undefined;
        const imageRegex = /!\[.*?\]\((.*?)\)/;
        const imageMatch = questionText.match(imageRegex);
        
        if (imageMatch) {
          const rawPath = imageMatch[1];
          // Normalize path: /data/images/name.png -> /images/name.png (since we moved them to public/images)
          const imageName = path.basename(rawPath);
          imagePath = `/images/${imageName}`;
          // Remove image tag from text if preferred, or keep it for custom rendering
          questionText = questionText.replace(/!\[.*?\]\(.*?\)(\{.*?\})?/, '').trim();
        }

        questions.push({
          id: `q-${filename.split('.')[0]}-${questions.length + 1}`,
          text: questionText,
          type: 'multiple_choice',
          options: options,
          imagePath: imagePath,
          mathSupported: questionText.includes('$') || options.some(o => o.text.includes('$')),
          createdAt: new Date().toISOString()
        });
      }
    }
  });

  return questions;
}

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.txt'));
const allData: any = {};

files.forEach(file => {
  console.log(`Parsing ${file}...`);
  const questions = parseFile(file);
  allData[file] = questions;
  fs.writeFileSync(path.join(OUTPUT_DIR, `${file.replace('.txt', '.json')}`), JSON.stringify(questions, null, 2));
});

console.log('Migration parse complete!');
