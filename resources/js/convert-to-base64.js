const fs = require('fs');
const path = require('path');

const files = [
  'ac_CP-F2_Preguntas.txt',
  'ac_CP-F3_Preguntas.txt',
  'ac_CT3-4_Preguntas.txt',
  'ac_CT1-2_Preguntas.txt',
  'dssPreguntas.txt',
  'gpiPreguntas.txt',
  'adaPreguntas.txt',
  'ada_descartadasPreguntas.txt',
  'ada-p2Preguntas.txt',
  'ada-p1Preguntas.txt',
  'redesPreguntas.txt',
  'redesEnero2324Preguntas.txt',
  'hadaPreguntas.txt',
  'pedPreguntas.txt',
  'stiPreguntas.txt',
  'siPreguntas.txt'
];

files.forEach((file) => {
  const filePath = path.resolve(__dirname, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const base64Content = Buffer.from(content).toString('base64');
  console.log(`"${file}": "${base64Content}",`);
});
