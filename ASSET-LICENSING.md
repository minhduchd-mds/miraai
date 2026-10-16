# Asset Licensing / Media Provenance

**Code**: The repository root `LICENSE` contains Apache License 2.0. It applies only to code and other works for which the repository owner actually holds sublicensing rights.

**Media**: `public/` and `assets-source/` contain 3D meshes, VRM/GLB files, Gaussian Splat, textures, concept portraits, rendered scenes, expressions and UI artwork. Their underlying copyrights/creator permissions **have not all been verified**. Do not assume these files are Apache-2.0, CC0 or suitable for independent redistribution just because the repository is public.

See:
- [Current IP audit](docs/MIRA-IP-RIGHTS-AUDIT-2026-10-16.md)
- [File-by-file media inventory](docs/MIRA-ASSET-RIGHTS-INVENTORY.json)
- [Dependency license inventory](docs/MIRA-DEPENDENCY-LICENSE-INVENTORY.json)

**Special cases**
- The `vitruvian-lab` data references an upstream CC0 character and textures, but the local derivative provenance and all animation components require an individual check. Upstream Mixamo animations are **not** CC0.
- VRoid Studio's standard mesh/presets are licensed by pixiv and are **not** CC0. Original creator texture/hair/wardrobe or third-party materials may have separate restrictions.
- Screenshots, generated portraits and audio service outputs can have rights attached to inputs, likeness, commercial plans and third-party materials; no rights are presumed.
- Third-party libraries are covered by their respective MIT, BSD, Apache, ISC, MPL or other terms, not by a replacement Mira license.

**Production handling**: Until source verification, standard compiled releases exclude experimental legacy avatar VRMs, Gaussian Splat, Vitruvian Lab assets and concept-reference portraits. Core WebP scenes still need provenance review. This policy changes future build artifacts; it does not remove files from public Git history.

Before using any media outside the current project, obtain and record the relevant rights directly from the copyright owner. This document is a transparency statement, not legal advice and not a claim of worldwide copyright clearance.
