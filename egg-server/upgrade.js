const path = require('path');
const fs = require('fs');

const dirs = fs.readdirSync(path.resolve(__dirname, 'workspace'));
dirs.forEach(dir => {
  const varFile = fs.readFileSync(
    path.resolve(__dirname, 'workspace', dir, 'vars.ini'),
    'utf-8'
  );
  console.log(varFile);
  const newContent = varFile.replaceAll(':', '>>');
  fs.writeFileSync(
    path.resolve(__dirname, 'workspace', dir, 'vars.ini'),
    newContent,
    'utf-8'
  );
});
