# Spatial Presence v37 — native 3D room (no photo reveal)
Updated 2026-10-09

## What changed
- The former transparent face photograph and full-screen `mira_concept_front.webp` reveal layer have been removed from the 3D scene entirely.
- First frame renders an actual Three.js/WebGL perspective scene. On desktop >=1024px it is selected automatically; `?room3d=1` forces an attempt (subject to reduced-motion, data saver and lite-quality safety gates), `?room3d=0` explicitly opts out.
- Loads the **already owned rigged VRM asset** `public/avatars/female/mira_female_02_lavender_lounge.vrm` in the same room, with seated bone pose and physical depth. If VRM cannot be decoded, only a simple geometric 3D figure is shown until model availability is repaired. No face photo billboard is presented. The model's face/clothing is not a photogrammetric match to the concept: it is an existing stylized VRM.
- New dedicated `RoomLuxuryInterior.tsx` is real geometry, not a panorama: rounded upholstery, shaped duvet, cushions, marble-procedural physical desktop, two monitors, glass/window frame and outside city geometry, wardrobe, plants, ceiling ring, soft area lights, polished/rough physical materials. Furnishings have independent positions and respond to camera translation.
- Lazy VRM decoder via `RoomMiraVRM.tsx`; separate from AppV2 core. One Canvas; demand redraw while moving, soft shadows, ACES Filmic tone mapping, DPR cap 1–1.5.
- Existing keyboard behavior retained (WASD and numeric views 1–5), and chat fields are not intercepted.

## Validation and boundaries
- Unit + build + performance CI gate must pass before accepting this revision.
- Chromium test must verify rotation, translation, continuous canvas and no photo reveal.
- The single concept photo cannot prove hidden surfaces, materials or exact likeness. This implementation is an editable, independently modeled 3D environment; it does **not** claim 100% visual likeness or photorealistic scans.
- Fine-grained model likeness requires a licensed custom VRM/GLB and authored PBR interior assets. For safety, reduced-motion/Lite/data saver retains original WebP.
