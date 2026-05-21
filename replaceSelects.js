const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all files in client/src/pages
const findFiles = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
};

const files = findFiles(path.join(__dirname, 'client/src/pages'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('<select') || content.includes('</select>')) {
    // 1. Replace tags
    content = content.replace(/<select/g, '<CustomSelect');
    content = content.replace(/<\/select>/g, '</CustomSelect>');
    
    // 2. Add import if not present
    if (!content.includes('CustomSelect')) {
       console.log('Skipped adding import manually as it already has it? Wait, I just replaced it above, so it will have it.');
    }
    
    // Determine relative path to client/src/components/CustomSelect
    const componentsDir = path.join(__dirname, 'client/src/components');
    const relativePath = path.relative(path.dirname(file), componentsDir).replace(/\\/g, '/');
    const importStatement = `import CustomSelect from '${relativePath}/CustomSelect';\n`;
    
    // Insert import after the last import statement or at the top
    if (!content.includes('import CustomSelect')) {
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLine = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLine + 1) + importStatement + content.slice(endOfLine + 1);
      } else {
        content = importStatement + content;
      }
    }
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
