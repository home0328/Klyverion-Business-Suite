import fs from 'node:fs';
import path from 'node:path';
import { buildZipArchive, type ZipEntryInput } from './zip.ts';

const ROOT_DIR = process.cwd();
const WP_DIR = path.resolve(ROOT_DIR, 'wp-ecosystem');

const ALLOWED_TOP_FILES = [
  '.env.example',
  '.gitignore',
  'index.html',
  'metadata.json',
  'package.json',
  'server.ts',
  'tsconfig.json',
  'vite.config.ts',
];

const ALLOWED_TOP_DIRS = ['src', 'wp-ecosystem'];

function collectDir(absDir: string, archivePrefix: string, out: ZipEntryInput[]): void {
  if (!fs.existsSync(absDir)) return;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const full = path.resolve(absDir, entry.name);
    if (!full.startsWith(absDir + path.sep)) continue;
    const relName = archivePrefix ? `${archivePrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      collectDir(full, relName, out);
    } else {
      out.push({
        name: relName,
        content: fs.readFileSync(full),
      });
    }
  }
}

export function buildWordPressBundleZip(): Buffer {
  const entries: ZipEntryInput[] = [];
  collectDir(WP_DIR, 'klyverion-wp-suite', entries);
  return buildZipArchive(entries);
}

export function buildCompleteProjectZip(): Buffer {
  const entries: ZipEntryInput[] = [];

  for (const fileName of ALLOWED_TOP_FILES) {
    const full = path.resolve(ROOT_DIR, fileName);
    if (full.startsWith(ROOT_DIR + path.sep) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      entries.push({
        name: `klyverion-business-suite/${fileName}`,
        content: fs.readFileSync(full),
      });
    }
  }

  for (const dirName of ALLOWED_TOP_DIRS) {
    const fullDir = path.resolve(ROOT_DIR, dirName);
    if (fullDir.startsWith(ROOT_DIR + path.sep)) {
      collectDir(fullDir, `klyverion-business-suite/${dirName}`, entries);
    }
  }

  return buildZipArchive(entries);
}
