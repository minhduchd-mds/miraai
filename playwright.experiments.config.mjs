import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

// Research experiments (docs/MIRA-RESEARCH-EXPERIMENTS.md); kept out of the Visual QA gate.
export default defineConfig({ ...base, testMatch: ['camera-e2e.spec.mjs'], reporter: [['line']], use: { ...base.use, reducedMotion: 'no-preference' } });
