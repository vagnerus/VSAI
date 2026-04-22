import fs from 'fs';

const fileContent = fs.readFileSync('C:/Users/Vagner/Desktop/VSAI-main/src/frontend/App.jsx', 'utf-8');
const lines = fileContent.split('\n');

lines.forEach((line, index) => {
  if (line.includes('selectedModel')) {
    console.log(`Linha ${index + 1}: ${line.trim()}`);
  }
});
