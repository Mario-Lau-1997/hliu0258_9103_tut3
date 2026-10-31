/* Run with Playwright, BROWSER_EXECUTABLE and RIPPLE_TEST_OUTPUT as in browser.cjs.
 * Checks actual browser audio data; does not claim a human listening test.
 */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,
    headless:true, args:['--no-sandbox']});
  const checks = [], errors = [];
  const out = process.env.RIPPLE_TEST_OUTPUT || path.resolve(__dirname, '../test-results');
  await fs.mkdir(out, {recursive:true});
  const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
  const context = await browser.newContext({viewport:{width:1440,height:1100}, acceptDownloads:true});
  await context.route(/^https?:/, route => route.abort());
  try {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const state = () => page.evaluate(() => window.rippleDiagnostics());
    const audioState = () => page.evaluate(() => window.rippleDiagnostics().audio);
    const volume = async value => page.locator('#volume').evaluate((el, value) => {
      el.value = value; el.dispatchEvent(new Event('input', {bubbles:true}));
    }, value);
    await page.goto(url);
    await page.waitForFunction(() => window.rippleDiagnostics);
    assert.equal((await audioState()).contextState, 'not-created');
    assert.equal((await state()).audioBoost, 1);
    checks.push('Offline page starts silently without creating an AudioContext');

    await page.locator('#sound-button').click();
    await page.waitForFunction(() => {
      const a = window.rippleDiagnostics().audio;
      return a.contextState === 'running' && a.duration === 24 && a.rms > 0 && a.boost > 1;
    });
    let a = await audioState();
    assert.equal(a.looping, true);
    assert.ok(a.boost <= 1.3);
    checks.push('Explicit click decodes the embedded WAV, starts the loop and measures nonzero audio');

    const played = a.effectsPlayed;
    await page.locator('#add-button').click();
    await page.locator('#ripple-canvas').focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('#phase-button').click();
    assert.ok((await audioState()).effectsPlayed >= played + 3);
    checks.push('Adding, keyboard movement and reversing phase generate short sounds');

    const d = await state();
    const source = d.sources.find(s => s.id === d.selectedId);
    await page.locator('#ripple-canvas').scrollIntoViewIfNeeded();
    const box = await page.locator('#ripple-canvas').boundingBox();
    const prior = (await audioState()).effectsPlayed;
    await page.mouse.move(box.x + source.nx*box.width, box.y + source.ny*box.height);
    await page.mouse.down();
    await page.mouse.move(box.x + (source.nx+.05)*box.width, box.y + (source.ny+.05)*box.height, {steps:40});
    await page.mouse.up();
    a = await audioState();
    assert.ok(a.effectsPlayed > prior && a.effectsPlayed < prior + 41);
    assert.ok(a.activeVoices <= 6);
    checks.push('Dragging produces throttled drops with a bounded voice count');

    await volume(0);
    await page.waitForFunction(() => window.rippleDiagnostics().audioBoost === 1);
    assert.equal((await audioState()).pulse, 0);
    const mutedEffects = (await audioState()).effectsPlayed;
    await page.locator('#phase-button').click();
    assert.equal((await audioState()).effectsPlayed, mutedEffects);
    await volume(65);
    await page.waitForFunction(() => window.rippleDiagnostics().audio.rms > 0);
    checks.push('Volume zero removes the sound response; raising volume restores it');

    await page.locator('#pause-button').click();
    await page.waitForFunction(() => window.rippleDiagnostics().audio.contextState === 'suspended');
    const paused = await state();
    await page.waitForTimeout(250);
    assert.equal((await state()).sceneTime, paused.sceneTime);
    assert.equal((await audioState()).currentTime, paused.audio.currentTime);
    await page.locator('#pause-button').click();
    await page.waitForFunction(() => window.rippleDiagnostics().audio.contextState === 'running');
    checks.push('Pause suspends the audio clock and animation; Resume restarts both');

    // Wait across one real loop boundary while the browser processes audio.
    await page.waitForFunction(() => window.rippleDiagnostics().audio.currentTime > 24.15, null, {timeout:35000});
    assert.ok((await audioState()).rms > 0);
    checks.push('The ambience continues after its first 24-second loop boundary');

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save-button').click()]);
    const png = path.join(out, 'artwork.png'); await download.saveAs(png);
    const pngBytes = await fs.readFile(png);
    assert.equal(pngBytes.toString('ascii', 1, 4), 'PNG');
    assert.ok(pngBytes.length > 100000);
    checks.push('Native canvas PNG export still includes the rendered artwork');

    await page.locator('#scene-file').setInputFiles(path.resolve(__dirname, '../examples/01-reinforcement.json'));
    await page.waitForFunction(() => document.getElementById('file-status').textContent.startsWith('Scene loaded'));
    await page.waitForFunction(() => window.rippleDiagnostics().audio.contextState === 'suspended');
    assert.equal((await state()).paused, true);
    checks.push('Loading a scene pauses audio with the scene and keeps sound settings in this session');

    await page.locator('#sound-button').click();
    assert.equal((await audioState()).enabled, false);
    await page.locator('#pause-button').click();
    await page.waitForTimeout(150);
    assert.equal((await audioState()).contextState, 'suspended');
    assert.equal((await state()).audioBoost, 1);
    await page.locator('#sound-button').click();
    await page.waitForFunction(() => window.rippleDiagnostics().audio.rms > 0);
    checks.push('Mute remains silent through Resume; enabling sound works again');

    for (const width of [820, 390]) {
      await page.setViewportSize({width, height:1000});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    checks.push('Sound controls fit tablet and phone widths');
    await page.setViewportSize({width:1440,height:1100});
    await page.screenshot({path:path.join(out,'audio-layout-review.png'),fullPage:true});

    const reduced = await context.newPage();
    reduced.on('pageerror', error => errors.push(error.message));
    await reduced.emulateMedia({reducedMotion:'reduce'});
    await reduced.goto(url); await reduced.waitForFunction(() => window.rippleDiagnostics);
    assert.equal(await reduced.evaluate(() => window.rippleDiagnostics().paused), true);
    await reduced.locator('#sound-button').click();
    await reduced.waitForFunction(() => {
      const a = window.rippleDiagnostics().audio;
      return a.enabled && !a.loading && a.duration === 24 && a.contextState === 'suspended';
    });
    await reduced.locator('#pause-button').click();
    await reduced.waitForFunction(() => window.rippleDiagnostics().audio.rms > 0);
    checks.push('Reduced-motion start stays paused after enabling audio until Resume');
    await reduced.close();

    const unsupported = await context.newPage();
    unsupported.on('pageerror', error => errors.push(error.message));
    await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    await unsupported.goto(url); await unsupported.waitForFunction(() => window.rippleDiagnostics);
    assert.equal(await unsupported.locator('#sound-button').isDisabled(), true);
    await unsupported.locator('#add-button').click();
    assert.equal(await unsupported.evaluate(() => window.rippleDiagnostics().sourceCount), 3);
    checks.push('Without Web Audio support, source editing still works and sound is unavailable');
    await unsupported.close();

    assert.deepEqual(errors, []);
    checks.push('No uncaught JavaScript errors in the tested audio flows');
    const report = {checkedAt:new Date().toISOString(),browser:await browser.version(),checks,errors,
      note:'Automated offline Chromium checks with actual decoded audio and analyser data. No human listening or physical speaker test; other browsers and devices remain unverified.'};
    await fs.writeFile(path.join(out,'audio-results.json'), JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
