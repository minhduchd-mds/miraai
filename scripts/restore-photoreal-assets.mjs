import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PART_COUNT = 11;
const EXPECTED_SHA256 = 'ee079d175ddd4920d161d56cd8ce79fdb3dac078d492a814bc380cd7faab2d61';
const SOURCE_DIR = 'assets-source';
const OUTPUT_DIR = 'public/scenes';
const OUTPUT_PATH = join(OUTPUT_DIR, 'mira-bedroom.webp');

let encoded = '';
for (let index = 0; index < PART_COUNT; index += 1) {
  const name = `mira-bedroom.part${String(index).padStart(2, '0')}`;
  encoded += readFileSync(join(SOURCE_DIR, name), 'utf8').replace(/\s+/g, '');
}

const bytes = Buffer.from(encoded, 'base64');
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== EXPECTED_SHA256) {
  throw new Error(`Mira bedroom asset checksum mismatch: ${sha256}`);
}
if (bytes.length < 40_000) {
  throw new Error(`Mira bedroom asset unexpectedly small: ${bytes.length} bytes`);
}
if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
  throw new Error('Mira bedroom asset is not a valid RIFF/WebP container');
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, bytes);
console.log(`Restored ${OUTPUT_PATH} · ${bytes.length} bytes · sha256=${sha256.slice(0, 12)}…`);
