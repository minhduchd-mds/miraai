import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import ts from 'typescript';

async function importDeviceLabRuntime() {
  const path = 'src/runtime/device-lab.ts';
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    fileName: path,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function parseArgs(argv) {
  const options = {
    dir: 'artifacts/device-lab',
    require: 0,
    write: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--dir=')) options.dir = arg.slice('--dir='.length);
    else if (arg.startsWith('--require=')) options.require = Number(arg.slice('--require='.length)) || 0;
    else if (arg === '--no-write') options.write = false;
  }
  return options;
}

function markdownStatus(status) {
  if (status === 'pass') return 'PASS';
  if (status === 'warn') return 'WARN';
  if (status === 'fail') return 'FAIL';
  return 'N/A';
}

function safeJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const options = parseArgs(process.argv.slice(2));
const dir = resolve(options.dir);
const runtime = await importDeviceLabRuntime();

if (!existsSync(dir)) {
  if (options.require > 0) {
    console.error(`Device Lab: missing directory ${dir}; require=${options.require}`);
    process.exit(1);
  }
  console.log(`Device Lab: no empirical directory at ${dir}; contract-only mode.`);
  process.exit(0);
}

const candidates = readdirSync(dir)
  .filter((name) => extname(name).toLowerCase() === '.json')
  .filter((name) => !['matrix.json'].includes(name))
  .map((name) => join(dir, name));

const results = [];
const failures = [];

for (const path of candidates) {
  const value = safeJson(path);
  if (value?.format !== 'mira.device-lab-result' || value?.schemaVersion !== 1) {
    failures.push(`${basename(path)}: unsupported format/schema`);
    continue;
  }
  if (!runtime.isPrivateDeviceLabResult(value)) {
    failures.push(`${basename(path)}: privacy contract failed`);
    continue;
  }
  try {
    assert.equal(value.privacy?.mediaCaptured, false);
    assert.equal(value.privacy?.rawInputIncluded, false);
    assert.equal(value.privacy?.identifiersIncluded, false);
    assert.equal(value.privacy?.locationIncluded, false);
    assert.equal(value.source?.format, 'mira.device-report');
    assert.equal(value.source?.schemaVersion, 1);
    const assessment = runtime.assessDeviceLabResult(value);
    results.push({ file: basename(path), result: value, assessment });
  } catch (error) {
    failures.push(`${basename(path)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (results.length < options.require) {
  failures.push(`expected at least ${options.require} empirical device result(s), found ${results.length}`);
}

const counts = {
  pass: results.filter((item) => item.assessment.overall === 'pass').length,
  warn: results.filter((item) => item.assessment.overall === 'warn').length,
  fail: results.filter((item) => item.assessment.overall === 'fail').length,
};

const matrix = {
  format: 'mira.device-matrix',
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceCount: results.length,
  counts,
  devices: results.map(({ file, result, assessment }) => ({
    file,
    label: result.label,
    productMode: result.source.device.productMode,
    voiceHealth: result.source.voice.health,
    webxr: result.source.device.webxr,
    immersiveAr: result.source.device.immersiveAr,
    overall: assessment.overall,
    blockers: assessment.blockers,
    warnings: assessment.warnings,
    checks: assessment.checks,
  })),
};

const markdown = [
  '# Mira Real-device Matrix',
  '',
  `Generated: ${matrix.generatedAt}`,
  '',
  `Devices: **${matrix.sourceCount}** · PASS **${counts.pass}** · WARN **${counts.warn}** · FAIL **${counts.fail}**`,
  '',
  '| Device | Mode | Voice | XR AR | Overall | Blockers | Warnings |',
  '|---|---|---|---|---|---|---|',
  ...matrix.devices.map((device) => [
    device.label.replaceAll('|', '/'),
    device.productMode,
    device.voiceHealth,
    device.immersiveAr === true ? 'yes' : device.immersiveAr === false ? 'no' : 'unknown',
    markdownStatus(device.overall),
    device.blockers.join(', ') || '—',
    device.warnings.join(', ') || '—',
  ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')),
  '',
  '## Acceptance',
  '',
  '- FAIL means at least one applicable required check failed.',
  '- WARN means no hard blocker was found, but one or more empirical checks are missing or above latency target.',
  '- XR checks are N/A unless immersive-AR support is reported.',
  '- No raw camera/audio/transcript/device identifier is accepted by the matrix contract.',
  '',
].join('\n');

console.log(markdown);

if (options.write) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'matrix.json'), JSON.stringify(matrix, null, 2), 'utf8');
  writeFileSync(join(dir, 'matrix.md'), markdown, 'utf8');
}

if (failures.length) {
  console.error('\nDevice Lab validation failed:\n');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('Device Lab matrix validation passed.');
