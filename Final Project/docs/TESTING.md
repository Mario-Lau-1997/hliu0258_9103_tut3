# Development checks


## Final audio update

- `unit-results.tap`: 29 passing logic and asset checks. These cover field maths,
  source input, history, scene-file validation, audio mapping and embedded WAV bytes.
- `browser-results.json`: 16 passing regression checks in offline Chromium.
- `audio-results.json`: 14 passing audio and integration checks in offline Chromium.
- `audio-asset.json`: duration, sample rate, peak level and construction method.
- `artwork.png`: an actual PNG downloaded through the artwork's Save image button.

The audio checks decode the real WAV and measure nonzero samples with the browser
analyser. They cover startup, interaction sounds, volume, mute, pause, a full loop
boundary, scene loading, small layouts, reduced motion and unavailable Web Audio.
They do not listen through physical speakers or establish support on every browser.
Tab visibility suspension is implemented but not covered by the automated browser
run. Test this on the device used for the presentation.

`background-results.json` is retained from the preceding background-only revision;
its recorded date identifies that earlier run. The current audio run also checks
native canvas PNG export. Browser layout screenshots were used for internal review
and are not included as artwork exports.

## Repeat

Run `node --test --test-reporter=tap tests/*.test.cjs` for the logic checks.
Install Playwright in your development environment, then set `BROWSER_EXECUTABLE`
to its Chromium executable and run `node tests/revisions.cjs` and
`node tests/audio-browser.cjs`. If Playwright is installed outside this project,
set `NODE_PATH` to that environment's `node_modules` directory.
`RIPPLE_TEST_OUTPUT` optionally selects the report directory.

## Before presenting

Open the extracted folder on the presentation device. Enable sound and set a
comfortable volume. Try adding and moving a source, then pause and resume. Switch
to another browser tab and back. Confirm the painting, source controls and sound
still work. Record the actual device, browser, procedure and results of that check.
