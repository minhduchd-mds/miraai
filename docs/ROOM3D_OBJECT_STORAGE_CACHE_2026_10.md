# MiraAI 3D — storage, cache and reduced memory (12 Oct 2026)

## Decision: don't store GLB binaries in SQL

Large GLB/VRM binary assets belong in **object storage with public CDN delivery**,
not in Neon/Postgres rows. SQL is suitable for asset metadata/version approvals
and user memory, but does not reduce triangles, textures, decode cost or VRAM.

Existing same-origin Vercel static delivery stays functional. The project has
**not** been configured with a new external bucket in this change. There is no
silent third-party upload or newly provisioned paid storage.

## Implemented

1. **Optional external CDN**: build variable `VITE_MIRA_3D_ASSET_BASE_URL`
   can point to an HTTPS folder holding the exact public files from
   `public/avatars/realistic/vitruvian-lab/`. Example:
   `https://<your-public-bucket-domain>/miraai/vitruvian-lab/v1/`.
   The prefix must end at the folder containing `head.glb`, `body.glb`,
   `hair.glb` and the nine actively sampled `vit_*.webp` files.
   - Manifest/license remains verified from the project's trusted local build.
   - Names are allowlisted: no path traversal, query parameters, API keys,
     user-provided filenames or arbitrary external URLs.
   - If any external asset fails, the loader falls back to the local CDN file.
   - External storage must serve WebGL assets with HTTPS and cross-origin
     `Access-Control-Allow-Origin` for the Mira domain, and use versioned
     immutable object names or folders upon asset updates.
   - Model assets are public CC0 research files; never place transcripts,
     face imagery or private user data in the public bucket.

2. **Persistent browser CacheStorage** in `public/sw.js`:
   - Exact allowlist: `head.glb`, `body.glb`, `hair.glb`, same-origin only.
   - Cached **on demand**, only after the 3D loader requests each file.
   - A distinct `mira-room-glb-v1` cache prevents the 30.3 MiB GLB set from
     evicting the small shell's JavaScript, images, CSS and HTML.
   - Enforces successful responses, binary MIME, no `private`/`no-store`
     and max declared file size 18 MiB. Honors browser storage quota.
   - A quota/write error is ignored and the network response is returned.
   - Never caches API traffic, app memory, auth or personal sensor data.
   - Bump `ROOM_3D_CACHE` (v1→v2) whenever the source GLB binaries change.
   - The browser may still evict cache under quota pressure; no guarantee
     of offline first-visit operation.

3. **Leak prevention**: all three decoded GLB roots are tracked even if one
   download fails; successful PBR textures are tracked until all settled.
   Cleanup reclaims mounted and never-mounted geometry, materials and maps.

4. **Existing 3D savings retained**: 43 repetitive room meshes batched into
   two instanced meshes; nine instead of twelve PBR texture requests; dynamic
   DPR ceiling for constrained devices.

## Before connecting object storage

1. Provision a bucket only after reviewing actual provider pricing/limits.
2. Upload verified hashes of those 12 files (3 GLB + 9 WebP).
3. Configure HTTPS CDN response headers, CORS and an immutable version path.
4. Set `VITE_MIRA_3D_ASSET_BASE_URL` as a **build-time**, public asset origin
   in the Vercel project. This is not a credential/secret; do not put keys in
   `VITE_*` variables.
5. Deploy; confirm 3D fallback to local assets, build, Visual QA,
   license integrity, request waterfall and peak device memory.
6. Only after the remote CDN is populated and healthy should the local heavy
   files be excluded from production builds, retaining local source assets
   in Git and a rollback plan. Do not prune the sole working copy.

## Measurements and limitations

- First visit must still download ~30.3 MiB of uncompressed 3D GLB assets.
  The new CacheStorage avoids repeat network downloads **after** an initial
  successful visit on browsers where the Service Worker controls the page.
- Moving the files to a cloud database would **not** reduce first-visit bytes.
- Further meaningful first-load reductions require a separately validated
  mesh compression pipeline (e.g. meshopt) and possibly texture
  transcoding. These must preserve morph targets, skinned rig, iris geometry
  and the five-angle screenshots before shipping.
- No claim is made here about measured FPS, VRAM, first-render latency or
  actual cloud-bucket migration.
