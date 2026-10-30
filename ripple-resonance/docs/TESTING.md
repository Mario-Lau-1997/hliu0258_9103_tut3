# Recorded checks


## Mathematical checks

`node --test tests/field.test.cjs` passed all six tests:

1. Equal opposite sources cancel at sampled positions and times.
2. Phase reversal changes the sign while keeping position and amplitude.
3. The six-source cap and normalised position bounds hold.
4. A simple contour crosses the expected cell edges.
5. A saddle cell creates finite in-bounds segments.
6. Interpolation remains finite at several viewport sizes and boundary samples.

## Browser checks

The executable was Chrome Headless Shell 131.0.6778.204 on Linux. The checked
viewport sizes were 1440×1000, 820×1080 and 390×844. See `browser-report.json`
for the full recorded checks. External HTTP requests were blocked during the
direct local-file run.

Checks included pause and editing, phase reversal, source strength, spacing,
drift, keyboard movement, dragging out of the canvas, clear/remove/restore,
source capacity, seed changes, native PNG download, resize behaviour and
reduced motion. No JavaScript page errors occurred in that test sequence.
Separate touch emulation checked adding and dragging a source.

The report sampled approximately 30 frames per second with two and six sources
in this headless environment. These are brief samples, not a controlled
performance benchmark or a promise for another computer. A real projector,
Safari, Firefox and physical touch hardware were not tested.

## Sensible next checks for the student

- Check the work on the actual presentation laptop and projector.
- Ask a classmate to add, move and reverse a source without explaining it first.
- Record their real confusion or feedback, then make a small justified change.
- Compare three sources with six sources. Decide whether the denser pattern
  still communicates the intended relationship.
- Keep screenshots or notes only for tests you actually perform.
