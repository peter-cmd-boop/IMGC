const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', require('../package.json').version, 'IMGC-win32-x64');
const appDir = path.join(output, 'resources', 'app');
if (process.platform !== 'win32') throw new Error('Este empacotamento local exige Windows.');
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, 'node_modules/electron/dist'), output, { recursive: true });
fs.renameSync(path.join(output, 'electron.exe'), path.join(output, 'IMGC.exe'));
fs.rmSync(path.join(output, 'resources/default_app.asar'), { force: true });
fs.mkdirSync(appDir, { recursive: true });
for (const name of ['src', 'assets', 'package.json', 'README.md']) {
 fs.cpSync(path.join(root, name), path.join(appDir, name), { recursive: true, filter: file => !file.endsWith('.log') });
}
const visited = new Set();
function compatible(pkg) {
 return (!pkg.os || (pkg.os.includes('win32') && !pkg.os.includes('!win32'))) && (!pkg.cpu || pkg.cpu.includes('x64'));
}
function copyDependency(name, from, optional = false) {
 let packageFile;
 try { packageFile = require.resolve(name + '/package.json', { paths: [from] }); }
 catch (error) {
  if (optional) return;
  let dir = path.dirname(require.resolve(name, { paths: [from] }));
  while (dir !== path.dirname(dir)) {
   const candidate = path.join(dir, 'package.json');
   if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate)).name === name) { packageFile = candidate; break; }
   dir = path.dirname(dir);
  }
  if (!packageFile) throw error;
 }
 const source = path.dirname(packageFile);
 if (visited.has(source)) return;
 const pkg = JSON.parse(fs.readFileSync(packageFile));
 if (!compatible(pkg)) { if(optional)return; throw new Error('Dependência incompatível: ' + name); }
 visited.add(source);
 const relative = path.relative(path.join(root, 'node_modules'), source);
 if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Dependência fora do projeto: ' + name);
 const destination = path.join(appDir, 'node_modules', relative);
 fs.cpSync(source, destination, { recursive: true, filter: file => path.relative(source, file).split(path.sep)[0] !== 'node_modules' });
 for (const child of Object.keys(pkg.dependencies || {})) copyDependency(child, source, false);
 for (const child of Object.keys(pkg.optionalDependencies || {})) copyDependency(child, source, true);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
for (const name of Object.keys(pkg.dependencies)) copyDependency(name, root);
console.log('Pacote criado: ' + output);
console.log('Dependências de produção: ' + visited.size);
