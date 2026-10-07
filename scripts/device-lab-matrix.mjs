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
    releaseSha: '',
  };
  for (const arg of argv) {
    if (arg.startsWith('--dir=')) options.dir = arg.slice('--dir='.length);
    else if (arg.startsWith('--require=')) {
      options.require = Number(arg.slice('--require='.length));
      if (!Number.isSafeInteger(options.require) || options.require < 0) {
        throw new Error('--require must be a non-negative integer');
      }
    }
    else if (arg.startsWith('--release-sha=')) {
      options.releaseSha = arg.slice('--release-sha='.length);
      if (!/^[a-f0-9]{40}$/.test(options.releaseSha)) throw new Error('--release-sha must be a full commit SHA');
    }
    else if (arg === '--no-write') options.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
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
    if (options.require > 0) {
      if (value.source.device.secureContext !== true || value.source.device.mediaDevices !== true ||
          typeof value.source.device.immersiveAr !== 'boolean') {
        failures.push(`${basename(path)}: release requires valid capability fields and a resolved XR preflight`);
      }
      if (assessment.overall !== 'pass') {
        failures.push(`${basename(path)}: release requires PASS, found ${assessment.overall}`);
      }
      if (!Number.isFinite(value.observation.cameraStartMs) || value.observation.cameraStartMs < 0 ||
          !Number.isFinite(value.observation.voiceFirstAudioMs) || value.observation.voiceFirstAudioMs < 0) {
        failures.push(`${basename(path)}: release requires measured camera and voice latency`);
      }
      if (value.source.voice.health === 'unhealthy' || value.source.voice.health === 'unknown' || !value.source.voice.health) {
        failures.push(`${basename(path)}: voice health is not release-ready`);
      }
      if (!value.label?.trim() || value.label === 'Unnamed device') failures.push(`${basename(path)}: device label required`);
      if (options.releaseSha && value.releaseSha !== options.releaseSha) {
        failures.push(`${basename(path)}: evidence does not match release commit ${options.releaseSha}`);
      }
    }
    results.push({ file: basename(path), result: value, assessment });
  } catch (error) {
    failures.push(`${basename(path)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (results.length < options.require) {
  failures.push(`expected at least ${options.require} empirical device result(s), found ${results.length}`);
}

if (options.require > 0) {
  const labels = new Set(results.map(({ result }) => result.label.trim().toLowerCase()));
  if (labels.size !== results.length) failures.push('release evidence must use distinct device/profile labels');
  const captures = new Set(results.map(({ result }) => JSON.stringify({ source: result.source, observation: result.observation })));
  if (captures.size !== results.length) failures.push('duplicate captures cannot count as separate devices');
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
