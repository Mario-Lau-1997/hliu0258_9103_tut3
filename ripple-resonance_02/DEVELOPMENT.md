# Development record

This repository records work completed with OpenAI ChatGPT/Codex assistance.
Commits use an AI-assistance identity. They are not evidence of unaided student
authorship. The student should read, test and change the project, and make
their own genuine development commits before submitting it.

## Initial setup

- Added a local HTML entry point and responsive control layout.
- Planned one script per functional responsibility.
- No remote GitHub repository has been created or uploaded.

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
- No classmate user study or remote GitHub upload is claimed.

## 26 October 2026 — stage 1

Fixed drag ownership after reproducing the failure in a regression test. Added
keyboard creation and explicit source selection. Ten unit tests and six browser
checks passed. The automated touch check uses browser-emulated touch input.
These changes and tests were completed with AI assistance, not independently by Mario.

## 26 October 2026 — stage 2

Added data snapshots and a capped undo/redo stack. Grouped each pointer or slider
gesture into one edit, kept selection-only navigation out of history, and cleared
redo after a new branch. Sixteen unit tests and eleven browser checks passed.
Completed with AI assistance; personal student tests are not claimed.
