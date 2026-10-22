"""Build and inspect the Linux archive with explicit POSIX permissions."""
from pathlib import Path
import hashlib
import json
import tarfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
source = root / 'dist' / version / 'IMGC-linux-x64'
archive = root / f'IMGC-Linux-x64-{version}.tar.gz'
executables = {
    'IMGC', 'start.sh', 'chrome-sandbox', 'chrome_crashpad_handler',
    'resources/app/node_modules/ffmpeg-static/ffmpeg',
}

def attributes(info):
    relative = info.name.removeprefix(source.name + '/')
    info.uid = info.gid = 0
    info.uname = info.gname = 'root'
    info.mode = 0o755 if info.isdir() or relative in executables else 0o644
    return info

with tarfile.open(archive, 'w:gz', compresslevel=6) as output:
    output.add(source, arcname=source.name, filter=attributes)

with tarfile.open(archive, 'r:gz') as check:
    members = {entry.name: entry for entry in check.getmembers()}
    for file in executables:
        assert members[f'{source.name}/{file}'].mode == 0o755, file
    for name, entry in members.items():
        assert not Path(name).is_absolute() and '..' not in Path(name).parts
        assert not name.lower().endswith(('.exe', '.dll'))
        if entry.isfile():
            # Read every member to detect truncated or corrupt archive data.
            with check.extractfile(entry) as content:
                digest = hashlib.file_digest(content, 'sha256').hexdigest()
            local = source / name.removeprefix(source.name + '/')
            with local.open('rb') as content:
                assert digest == hashlib.file_digest(content, 'sha256').hexdigest(), name

with archive.open('rb') as content:
    checksum = hashlib.file_digest(content, 'sha256').hexdigest()
archive.with_name(archive.name + '.sha256').write_text(f'{checksum}  {archive.name}\n', encoding='ascii')
print(f'Archive verified: {archive}')
print(f'Size: {archive.stat().st_size / 1024 / 1024:.1f} MiB')
print(f'SHA-256: {checksum}')
