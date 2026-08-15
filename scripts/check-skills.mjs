import { readdirSync, readFileSync } from 'node:fs';

const dir = 'src/intelligence/skills';
const files = readdirSync(dir).filter((file) => file.endsWith('-skill.ts'));
const failures = [];

if (!files.length) failures.push('no native Mira skills found');

for (const file of files) {
  const source = readFileSync(`${dir}/${file}`, 'utf8');
  for (const token of ['id:', 'description:', 'risk:', 'requiresNetwork:', 'supportsVoice:', 'match(', 'execute(']) {
    if (!source.includes(token)) failures.push(`${file} missing skill contract field: ${token}`);
  }
}

const types = readFileSync(`${dir}/types.ts`, 'utf8');
for (const token of ['SkillRisk', 'risk:', 'requiresNetwork:', 'supportsVoice:']) {
  if (!types.includes(token)) failures.push(`skills/types.ts missing metadata contract: ${token}`);
}

if (failures.length) {
  console.error('\nMira skill contract guard failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Mira skill contract guard passed (${files.length} skills).`);
