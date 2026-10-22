// Cross-package Linux x64 using the existing, verified Linux runtime and native modules.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const runtime = path.join(root, 'dist/IMGC-linux-x64');
const nativeRoot = path.join(runtime, 'resources/app/node_modules');
const output = path.join(root, 'dist', pkg.version, 'IMGC-linux-x64');
const appDir = path.join(output, 'resources/app');
const modules = path.join(appDir, 'node_modules');
function read(file) { return JSON.parse(fs.readFileSync(file)); }
function elf(file) {
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(20);
  try { fs.readSync(fd, header, 0, header.length, 0); } finally { fs.closeSync(fd); }
  assert.equal(header.subarray(0, 4).toString('hex'), '7f454c46', file);
  assert.equal(header[4], 2, 'Expected ELF64: ' + file);
  assert.equal(header.readUInt16LE(18), 62, 'Expected x86-64: ' + file);
}
assert.equal(fs.readFileSync(path.join(runtime, 'version'), 'utf8').trim(), require('electron/package.json').version);
elf(path.join(runtime, 'IMGC'));
if (fs.existsSync(output)) throw new Error('O destino já existe. Preserve ou mova o pacote anterior antes de reconstruir: ' + output);
fs.mkdirSync(output, { recursive: true });
// Only the runtime comes from the old build. Application code is always copied from src.
for (const entry of fs.readdirSync(runtime)) {
  if (['resources', 'start.sh', 'IMGC.desktop'].includes(entry)) continue;
  fs.cpSync(path.join(runtime, entry), path.join(output, entry), { recursive: true });
}
fs.mkdirSync(appDir, { recursive: true });
for (const entry of ['src', 'assets', 'README.md']) {
  fs.cpSync(path.join(root, entry), path.join(appDir, entry), { recursive: true, filter: file => !file.endsWith('.log') });
}
// Platform modules belong to sharp, not to the app. Never include an unrelated sharp ABI.
const distributedPackage = { ...pkg };
delete distributedPackage.devDependencies;
delete distributedPackage.optionalDependencies;
delete distributedPackage.scripts;
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(distributedPackage, null, 2) + '\n');
const copied = new Set();
function copyDependency(name, from, optional = false) {
  let packageFile;
  try { packageFile = require.resolve(name + '/package.json', { paths: [from] }); }
  catch (error) { if (optional) return; throw error; }
  const source = path.dirname(packageFile);
  if (copied.has(source)) return;
  const metadata = read(packageFile);
  if (metadata.os && !metadata.os.includes('linux')) { if (optional) return; throw new Error('Wrong platform: ' + name); }
  if (metadata.cpu && !metadata.cpu.includes('x64')) { if (optional) return; throw new Error('Wrong CPU: ' + name); }
  if (name.startsWith('@img/')) return; // Added below with exact, verified versions.
  copied.add(source);
  const relative = path.relative(path.join(root, 'node_modules'), source);
  assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative));
  fs.cpSync(source, path.join(modules, relative), {
    recursive: true,
    filter: file => path.relative(source, file).split(path.sep)[0] !== 'node_modules' && !/\.(?:exe|dll|exe\.LICENSE|exe\.README)$/i.test(file),
  });
  for (const child of Object.keys(metadata.dependencies || {})) copyDependency(child, source);
  for (const child of Object.keys(metadata.optionalDependencies || {})) copyDependency(child, source, true);
}
for (const name of Object.keys(pkg.dependencies)) copyDependency(name, root);
const sharp = read(path.join(modules, 'sharp/package.json'));
for (const name of ['@img/sharp-linux-x64', '@img/sharp-libvips-linux-x64']) {
  const source = path.join(nativeRoot, name);
  assert.equal(read(path.join(source, 'package.json')).version, sharp.optionalDependencies[name], 'Native sharp version mismatch');
  fs.cpSync(source, path.join(modules, name), { recursive: true });
}
assert.equal(read(path.join(nativeRoot, 'ffmpeg-static/package.json')).version, read(path.join(modules, 'ffmpeg-static/package.json')).version);
fs.copyFileSync(path.join(nativeRoot, 'ffmpeg-static/ffmpeg'), path.join(modules, 'ffmpeg-static/ffmpeg'));
for (const file of ['IMGC', 'chrome-sandbox', 'chrome_crashpad_handler', 'resources/app/node_modules/ffmpeg-static/ffmpeg', 'resources/app/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64.node', 'resources/app/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.42']) elf(path.join(output, file));
fs.writeFileSync(path.join(output, 'start.sh'), '#!/bin/sh\nset -eu\nDIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\ncd "$DIR"\nexec "$DIR/IMGC" "$@"\n');
fs.writeFileSync(path.join(output, 'LEIA-ME.txt'), `IMGC ${pkg.version} — Linux x86-64 (glibc)\n\nExtraia o arquivo tar.gz e execute ./start.sh na pasta extraída.\nNão execute como root. As permissões de execução já estão no arquivo tar.gz.\n\nEste pacote inclui Electron, FFmpeg e Sharp/libvips para Linux.\nRequer um ambiente gráfico Linux e as bibliotecas de sistema necessárias ao Electron.\nO isolamento do Chromium permanece ativado; a distribuição precisa permitir seu sandbox.\nNão é um pacote para ARM64 nem para Alpine/musl.\n\nMontado e verificado no Windows; a execução em Linux não foi testada neste computador.\n`);
for (const file of fs.readdirSync(output, { recursive: true })) {
  assert.ok(!/\.(exe|dll)$/i.test(file), 'Windows binary leaked into Linux package: ' + file);
}
console.log('Linux package assembled and native ELF64 x86-64 modules verified: ' + output);
