# MiraAI Human Lab — Meshopt compression research (12 Oct 2026)

## Goal
Reduce initial **public CC0** Human Lab 3D model transfer while preserving
FACS facial morph targets, Mixamo/skin bindings, eye geometry and the established
five-view screenshot experience. Do not store mesh binaries in PostgreSQL.

## First measured candidate build
glTF Transform CLI 4.5.1 `meshopt --level medium`, no simplification, 
no mesh join, no texture conversion and **no replacement of original assets**.

| GLB | Original bytes | Candidate bytes | Approx size saving |
| --- | ---: | ---: | ---: |
| head.glb | 10,183,676 | 1,743,144 | 82.9% |
| body.glb | 6,745,272 | 1,500,508 | 77.8% |
| hair.glb | 14,838,736 | 3,464,924 | 76.7% |
| **Total** | **31,767,684** | **6,708,576** | **78.9%** |

This table is file-size measurement from GitHub Actions, not real browser
first-contentful-paint or FPS. Server-side Brotli may further reduce transfer
size, depending on CDN Content-Encoding behavior.

## Guardrails
- `scripts/compress-vitruvian-meshopt.mjs` writes only to ignored research
  output `artifacts/meshopt-research/`.
- `scripts/verify-vitruvian-meshopt.mjs` validates:
  required `EXT_meshopt_compression`, named hierarchy, skin joint names,
  inverse bind counts, mesh primitive/attribute/morph layout, facial shape
  names and at least 5% Brotli-proxy reduction.
- Source has one skin with 52 joints; the Meshopt encoder emits three
  equivalent skins sharing the **same named bone hierarchy and inverse binds**.
  This is allowed only after strict duplicate signature validation.
- The opt-in Three.js loader registers `MeshoptDecoder`. Only
  `?room3d=1&humanLab=1&meshopt=1` requests trial assets in
  `vitruvian-lab/meshopt/`. Default routes continue using original GLBs.
- GitHub Actions research workflow generates candidates, structurally validates
  them, temporarily stages them for the real-browser five-angle Playwright
  checks, then stores candidates, report and images in a 14-day artifact.
  It does **not** publish them to the production CDN.
- Model morphs, skinning, head/gaze orientation, seated pose, lighting and
  appearance must not be weakened just to gain compression ratio.

## Acceptance required before production replacement
1. Candidate workflow completes successfully and delivers all five rendered
   screenshots, no WebGL/decoder errors, all assets actually served from
   `/meshopt/`.
2. Compare face, eyes, iris depth, mouth, hair, feet and chair position to the
   same revision of the uncompressed model.
3. Measure wall-clock model-ready time, network transferred bytes and GPU
   memory on at least desktop Chromium and representative laptop/mobile GPU.
4. Only after visual acceptance, replace source GLBs in the production build,
   **bump Service Worker room-GLB cache version** to avoid stale original bytes,
   and retain rollback via prior Git commit.
5. Re-run complete CI, release and production smoke. A successful
   metadata/CI gate alone does not authorize visual promotion.

## Why not the database?
A database bytea/blob column would still send the same GLB content over
the network and may cost more for delivery. A static versioned CDN/Blob store
is appropriate when migration is actually needed; Meshopt lowers download
size regardless of the source.
