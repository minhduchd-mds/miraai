import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
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

function parseBool(value) {
  if (value == null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'pass'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'fail'].includes(normalized)) return false;
  return undefined;
}

function parseArgs(argv) {
  const out = {
    report: '',
    label: '',
    output: '',
    observation: {},
  };

  for (const arg of argv) {
    if (arg.startsWith('--report=')) out.report = arg.slice('--report='.length);
    else if (arg.startsWith('--label=')) out.label = arg.slice('--label='.length);
    else if (arg.startsWith('--output=')) out.output = arg.slice('--output='.length);
    else if (arg.startsWith('--camera-started=')) out.observation.cameraStarted = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--camera-start-ms=')) out.observation.cameraStartMs = Number(arg.split('=')[1]);
    else if (arg.startsWith('--face-detected=')) out.observation.faceDetected = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--hand-detected=')) out.observation.handDetected = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--gesture-stable=')) out.observation.gestureStable = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--voice-playback=')) out.observation.voicePlayback = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--voice-first-audio-ms=')) out.observation.voiceFirstAudioMs = Number(arg.split('=')[1]);
    else if (arg.startsWith('--interruption-worked=')) out.observation.interruptionWorked = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--desktop-launch=')) out.observation.desktopLaunch = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--xr-session-started=')) out.observation.xrSessionStarted = parseBool(arg.split('=')[1]);
    else if (arg.startsWith('--xr-anchor-stable=')) out.observation.xrAnchorStable = parseBool(arg.split('=')[1]);
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.report) {
  console.error('Usage: npm run device:lab:capture -- --report=path/to/mira-device-report.json --label="Device label" [observation flags]');
  process.exit(2);
}

const reportPath = resolve(args.report);
if (!existsSync(reportPath)) {
  console.error(`Device report not found: ${reportPath}`);
  process.exit(1);
}

let source;
try {
  source = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
  console.error(`Invalid device report JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (source?.format !== 'mira.device-report' || source?.schemaVersion !== 1) {
  console.error('Expected mira.device-report schema v1.');
  process.exit(1);
}

const runtime = await importDeviceLabRuntime();
const label = args.label || basename(reportPath, '.json');
const result = runtime.buildDeviceLabResult(label, source, args.observation);

if (!runtime.isPrivateDeviceLabResult(result)) {
  console.error('Refusing to write Device Lab result because privacy contract failed.');
  process.exit(1);
}

const outputPath = resolve(
  args.output || `artifacts/device-lab/${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'device'}.json`,
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

const assessment = runtime.assessDeviceLabResult(result);
console.log(`Device Lab result: ${outputPath}`);
console.log(`Overall: ${assessment.overall.toUpperCase()}`);
if (assessment.blockers.length) console.log(`Blockers: ${assessment.blockers.join(', ')}`);
if (assessment.warnings.length) console.log(`Warnings: ${assessment.warnings.join(', ')}`);
