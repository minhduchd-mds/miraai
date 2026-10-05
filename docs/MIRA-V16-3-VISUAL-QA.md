# Mira v16.3 — Visual QA & Device Profile Lab

This workflow gives Mira a repeatable visual product gate without exposing manual scene controls to users.

## Coverage

Eight screenshots are captured on every relevant main-branch change:

- daytime · desktop 1366×768
- welcome-home · desktop 1366×768
- home-evening · desktop 1366×768
- bedtime · desktop 1366×768
- daytime · mobile 390×844
- welcome-home · mobile 390×844
- home-evening · mobile 390×844
- bedtime · mobile 390×844

## Hard gates

For every scene/profile:

- the requested presence scene must render;
- the scene image must decode;
- voice primary control must remain visible and inside the viewport;
- no manual scene selector may exist;
- camera preview must remain absent while vision is disconnected;
- no horizontal overflow is allowed;
- runtime scene/expression requests must use WebP, never PNG source;
- presence runtime media loaded during the initial QA window must stay <= 420 KiB;
- scene/expression asset requests may not fail.

## Telemetry output

`visual-qa-report.json` records:

- navigation timing;
- Long Animation Frame count and worst duration when supported;
- runtime WebP request count and bytes;
- maximum media request duration;
- viewport/overflow;
- voice-control and stage geometry.

LoAF timing is report-only because shared GitHub runners are not a real-device latency benchmark.

## Test-only scene override

The URL form:

`?visual-test=1&scene=welcome-home`

is accepted only as an automation override. It does not add a scene selector or user-facing control.

## Artifacts

The Visual QA workflow uploads:

- 8 PNG screenshots;
- JSON report;
- Playwright HTML report;
- trace/screenshots on failure.

This is a browser/device-profile lab, not a substitute for physical iPhone/Android/macOS/Windows measurement.


## Mobile compositor optimization

The first device-profile run showed more Long Animation Frames on the mobile
profile than desktop. v16.3 therefore removes nonessential mobile
`backdrop-filter` layers, disables the scene tint blend mode and reduces
shadow/vignette cost. LoAF remains telemetry rather than a hard CI gate because
GitHub runners are not physical phones.
