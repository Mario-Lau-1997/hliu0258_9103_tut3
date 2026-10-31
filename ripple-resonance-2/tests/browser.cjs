/* Run with: NODE_PATH=/path/to/node_modules BROWSER_EXECUTABLE=/path/to/chrome node tests/browser.cjs
 * Requires Playwright for development tests only. The artwork has no npm dependency.
 * All browser sessions in this test load local project files with external requests blocked.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({
    ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {}),
    headless:true,args:['--no-sandbox']
  });
  const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page = await context.newPage();
  const errors=[], checks=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/, route=>route.abort());
  const output=process.env.RIPPLE_TEST_OUTPUT || path.resolve(__dirname,'../test-results');
  await fs.mkdir(output,{recursive:true});
  const diagnostics=()=>page.evaluate(()=>window.rippleDiagnostics());
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForFunction(()=>window.rippleDiagnostics && window.rippleDiagnostics().sceneTime>1);
  assert.equal((await diagnostics()).sourceCount,2);checks.push('Open directly from index.html with external network blocked');
  await page.waitForTimeout(1800);
  await page.screenshot({path:path.join(output,'desktop-review.png'),fullPage:true});

  await page.locator('#pause-button').click();
  const frozen=await diagnostics();await page.waitForTimeout(250);
  assert.equal((await diagnostics()).sceneTime,frozen.sceneTime);checks.push('Pause freezes the simulation clock');
  await page.locator('#phase-button').click();
  assert.equal((await diagnostics()).sources.find(s=>s.id===frozen.selectedId).phase,0);
  assert.equal((await diagnostics()).sceneTime,frozen.sceneTime);checks.push('Phase editing works while time is paused');
  await page.locator('#strength').fill('1.25');
  assert.equal((await diagnostics()).sources.at(-1).amplitude,1.25);
  await page.locator('#spacing').fill('24');
  assert.equal((await diagnostics()).spacing,.24);
  await page.locator('#drift').fill('0');assert.equal((await diagnostics()).drift,0);
  checks.push('Strength, wavelength and noise controls update the shared state');

  await page.locator('#ripple-canvas').focus();
  const original=(await diagnostics()).sources.at(-1).nx;
  await page.keyboard.press('ArrowRight');assert.ok((await diagnostics()).sources.at(-1).nx>original);
  await page.keyboard.press('p');assert.equal((await diagnostics()).sources.at(-1).phase,Math.PI);
  checks.push('Keyboard source movement and phase controls');

  let box=await page.locator('#ripple-canvas').boundingBox();
  let d=await diagnostics(), selected=d.sources.at(-1);
  await page.mouse.move(box.x+selected.nx*box.width,box.y+selected.ny*box.height);
  await page.mouse.down();await page.mouse.move(box.x+box.width+35,box.y+box.height*.8,{steps:8});await page.mouse.up();
  d=await diagnostics();assert.equal(d.sources.at(-1).nx,.975);
  const released=JSON.stringify(d.sources);await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
  assert.equal(JSON.stringify((await diagnostics()).sources),released);
  checks.push('Dragging beyond the canvas clamps position and ends on release');

  await page.locator('#clear-button').click();assert.equal((await diagnostics()).sourceCount,0);
  assert.equal(await page.locator('#phase-button').isDisabled(),true);
  box=await page.locator('#ripple-canvas').boundingBox();
  for (const [nx,ny] of [[.1,.2],[.3,.2],[.5,.2],[.7,.2],[.9,.2],[.2,.7],[.8,.7]]) {
    await page.mouse.click(box.x+nx*box.width,box.y+ny*box.height);
  }
  assert.equal((await diagnostics()).sourceCount,6);checks.push('Clear, new sources and six-source limit');
  await page.locator('#remove-button').click();assert.equal((await diagnostics()).sourceCount,5);
  checks.push('Removing a source updates selection');
  const previousSeed=(await diagnostics()).seed;await page.locator('#seed-button').click();
  assert.notEqual((await diagnostics()).seed,previousSeed);checks.push('A new seed changes the noise and particle starting state');
  await page.locator('#reset-button').click();d=await diagnostics();
  assert.equal(d.sourceCount,2);assert.equal(d.seed,7321);assert.equal(d.spacing,.18);assert.equal(d.drift,.28);
  checks.push('Restore resets sources, spacing, noise seed and drift');
  await page.locator('#pause-button').click();await page.waitForTimeout(2200);
  const twoSourceFps=(await diagnostics()).fps;

  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save-button').click()]);
  await download.saveAs(path.join(output,'artwork-export.png'));
  assert.ok((await fs.stat(path.join(output,'artwork-export.png'))).size>1000);checks.push('Save image exports the running p5 canvas');

  // Check layout and relative source positions at tablet and phone widths.
  const positions=(await diagnostics()).sources.map(s=>[s.nx,s.ny]);
  for (const [width,height] of [[820,1080],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(450);
    d=await diagnostics();assert.equal(d.canvasCount,1);
    assert.deepEqual(d.sources.map(s=>[s.nx,s.ny]),positions);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    await page.screenshot({path:path.join(output,`layout-${width}.png`),fullPage:true});
  }
  checks.push('Tablet and phone layouts retain source positions with no horizontal overflow');
  await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(200);
  await page.locator('#reset-button').click();
  box=await page.locator('#ripple-canvas').boundingBox();
  for(const [nx,ny] of [[.15,.2],[.8,.8],[.15,.8],[.85,.15]])await page.mouse.click(box.x+nx*box.width,box.y+ny*box.height);
  assert.equal((await diagnostics()).sourceCount,6);
  await page.waitForTimeout(1800);const sixSourceFps=(await diagnostics()).fps;
  await page.screenshot({path:path.join(output,'six-source-review.png'),fullPage:true});
  checks.push('Six-source scene runs with finite state and bounded particle count');
  assert.ok((await diagnostics()).particleCount<=1500);
  assert.deepEqual(errors,[]);checks.push('No JavaScript page errors during the tested interactions');
  await context.close();

  const reduced=await browser.newContext({reducedMotion:'reduce'});
  const reducedPage=await reduced.newPage();await reducedPage.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await reducedPage.waitForFunction(()=>window.rippleDiagnostics);
  assert.equal(await reducedPage.evaluate(()=>window.rippleDiagnostics().paused),true);
  checks.push('Reduced-motion preference starts with time paused');
  await reduced.close();await browser.close();
  const report={checkedAt:new Date().toISOString(),browser:'Chrome Headless Shell',checks,errors,
    sampledFps:{twoSources:Number(twoSourceFps.toFixed(1)),sixSources:Number(sixSourceFps.toFixed(1))},
    note:'Automated local-browser checks, not a student user study or a guarantee for other hardware.'};
  await fs.writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
