# Development record



## Initial setup

- Added a local HTML entry point and responsive control layout.
- Planned one script per functional responsibility.

## Feature development

1. Implemented damped radial waves, additive superposition and interpolated
   marching-squares contours. Added six mathematical tests.
2. Added seeded Perlin drift, randomised particle starting data and alpha-fading
   particle trails. The wave grid is shared by rendering and particle motion.
3. Connected pointer capture, direct source manipulation, phase reversal,
   sliders, keyboard controls and responsive resizing.
4. Checked the local application in a real browser engine, fixed restore-drag
   cancellation, added reduced-motion handling and wrote submission documentation.

## Recorded verification

- Six mathematical tests passed.
- Fifteen automated browser checks passed, including direct offline opening,
  image export and responsive layout.
- Separate touch emulation checked adding and dragging a source.
- The PNG in `docs/artwork.png` is a native export of the running canvas.
- Browser screenshots used during QA are not included as deliverables.

## 26 October 2026 — stage 1

Fixed drag ownership after reproducing the failure in a regression test. Added
keyboard creation and explicit source selection. Ten unit tests and six browser
checks passed. The automated touch check uses browser-emulated touch input.
These changes and tests were completed with AI and Mario.
