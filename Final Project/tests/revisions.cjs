/* Browser checks for the three development stages.
 * Run with NODE_PATH, BROWSER_EXECUTABLE and RIPPLE_TEST_OUTPUT as in browser.cjs.
 * The report records automated checks, not work performed by the student.
 */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true,hasTouch:true});
    const page = await context.newPage(), errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route(/^https?:/, route => route.abort());
    const out = process.env.RIPPLE_TEST_OUTPUT || path.resolve(__dirname,'../test-results');
    await fs.mkdir(out,{recursive:true});
    const state = () => page.evaluate(() => window.rippleDiagnostics());
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(() => window.rippleDiagnostics && window.rippleDiagnostics().sceneTime > .1);
    await page.locator('#pause-button').click();
    await page.locator('#clear-button').click();
    await page.locator('#add-button').focus(); await page.keyboard.press('Enter');
    assert.equal((await state()).sourceCount,1);
    await page.locator('#ripple-canvas').focus(); await page.keyboard.press('a');
    assert.equal((await state()).sourceCount,2);
    checks.push('Create sources with the Add button and A key, including an empty scene');
    let d = await state();
    await page.locator('#source-select').selectOption(String(d.sources[0].id));
    await page.locator('#ripple-canvas').focus(); await page.keyboard.press('ArrowRight');
    assert.ok((await state()).sources[0].nx > d.sources[0].nx);
    assert.equal((await state()).sources[1].nx,d.sources[1].nx);
    checks.push('Source list selects the intended source for keyboard movement');
    await page.locator('#ripple-canvas').focus();
    for(let i=0;i<7;i++) await page.keyboard.press('a');
    assert.equal((await state()).sourceCount,6);
    assert.equal(await page.locator('#add-button').isDisabled(),true);
    checks.push('Keyboard addition respects the six-source limit');
    await page.locator('#remove-button').click();
    assert.equal(await page.locator('#add-button').isDisabled(),false);
    await page.locator('#reset-button').click();
    d=await state();
    const box=await page.locator('#ripple-canvas').boundingBox();
    const x=box.x+d.sources[0].nx*box.width, y=box.y+d.sources[0].ny*box.height;
    const cdp=await context.newCDPSession(page);
    const point=(id,x,y)=>({id,x,y,radiusX:3,radiusY:3,force:.5});
    const first=point(1,x,y), second=point(2,x+90,y+70);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,second]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[second]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,x+50,y+20)]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok((await state()).sources[0].nx>d.sources[0].nx+.02);
    checks.push('Real browser touch events: lifting a second finger preserves the first drag');
    await page.locator('#reset-button').click();
    const before=(await state()).sources.map(s=>[s.nx,s.ny]);
    for(const [w,h] of [[820,1080],[390,844]]) {
      await page.setViewportSize({width:w,height:h});
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual((await state()).sources.map(s=>[s.nx,s.ny]),before);
    }
    checks.push('Added controls fit tablet and phone widths without changing source positions');
    await page.setViewportSize({width:1440,height:1100});
    // Stage 2: group a gesture, restore scene settings and discard stale redo.
    const restoreBefore=await state();
    await page.locator('#phase-button').click();
    const reversed=(await state()).sources;
    await page.locator('#undo-button').click();
    assert.deepEqual((await state()).sources,restoreBefore.sources);
    await page.locator('#redo-button').click();assert.deepEqual((await state()).sources,reversed);
    checks.push('Undo/redo restores source phase and selection');
    await page.locator('#undo-button').click();
    let count=(await state()).history.undoCount;
    const dragBefore=await state(), moving=dragBefore.sources[0];
    const dragBox=await page.locator('#ripple-canvas').boundingBox();
    await page.mouse.move(dragBox.x+moving.nx*dragBox.width,dragBox.y+moving.ny*dragBox.height);
    await page.mouse.down();
    await page.mouse.move(dragBox.x+(moving.nx+.09)*dragBox.width,dragBox.y+(moving.ny+.05)*dragBox.height,{steps:16});
    await page.mouse.up();
    assert.equal((await state()).history.undoCount,count+1);
    assert.equal((await state()).history.redoCount,0);
    await page.locator('#ripple-canvas').focus();await page.keyboard.press('Control+z');
    assert.deepEqual((await state()).sources,dragBefore.sources);
    await page.keyboard.press('Control+Shift+z');
    assert.ok((await state()).sources[0].nx>moving.nx);
    checks.push('One drag produces one history step; shortcuts undo and redo it');
    count=(await state()).history.undoCount;
    await page.locator('#spacing').evaluate(el=>{
      for(const value of [21,22,23,24]){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    assert.equal((await state()).history.undoCount,count+1);
    await page.locator('#undo-button').click();assert.equal((await state()).spacing,.18);
    checks.push('A multi-value slider gesture is one edit');
    const beforeClear=await state();
    await page.locator('#clear-button').click();assert.equal((await state()).sourceCount,0);
    await page.locator('#undo-button').click();assert.deepEqual((await state()).sources,beforeClear.sources);
    await page.locator('#seed-button').click();
    await page.locator('#undo-button').click();assert.equal((await state()).seed,beforeClear.seed);
    checks.push('Clear and seeded drift changes can be reversed');
    assert.equal(await page.locator('#redo-button').isDisabled(),false);
    await page.locator('#phase-button').click();
    assert.equal(await page.locator('#redo-button').isDisabled(),true);
    checks.push('A new edit after undo invalidates the previous redo branch');
    // Stage 3: real JSON download, atomic validation and reversible import.
    const beforeSave=await state();
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save-scene-button').click()]);
    const scenePath=path.join(out,'round-trip-scene.json');await download.saveAs(scenePath);
    const savedFile=JSON.parse(await fs.readFile(scenePath,'utf8'));
    assert.equal(savedFile.version,1);assert.deepEqual(savedFile.scene.sources,beforeSave.sources);
    await page.locator('#clear-button').click();
    await page.locator('#scene-file').setInputFiles(scenePath);
    await page.waitForFunction(()=>document.getElementById('file-status').textContent.startsWith('Scene loaded'));
    let loaded=await state();
    assert.deepEqual(loaded.sources,beforeSave.sources);assert.equal(loaded.spacing,beforeSave.spacing);
    assert.equal(loaded.seed,beforeSave.seed);assert.equal(loaded.drift,beforeSave.drift);
    assert.equal(loaded.selectedId,beforeSave.selectedId);assert.equal(loaded.paused,true);assert.equal(loaded.sceneTime,0);
    checks.push('Downloaded scene reopens with matching settings, paused at time zero');
    await page.locator('#undo-button').click();assert.equal((await state()).sourceCount,0);
    await page.locator('#redo-button').click();assert.deepEqual((await state()).sources,beforeSave.sources);
    checks.push('Loading a scene participates in undo and redo');
    const safe=await state();
    for(const [name,buffer] of [
      ['broken.json',Buffer.from('{bad')],
      ['version.json',Buffer.from(JSON.stringify({...savedFile,version:2}))],
      ['range.json',Buffer.from(JSON.stringify({...savedFile,scene:{...savedFile.scene,spacing:0}}))],
      ['large.json',Buffer.from(' '.repeat(65537))]
    ]) {
      await page.locator('#scene-file').setInputFiles({name,mimeType:'application/json',buffer});
      await page.waitForFunction(()=>document.getElementById('file-status').textContent.startsWith('Could not load:') && !document.getElementById('load-scene-button').disabled);
      const after=await state();
      for(const key of ['sources','seed','spacing','drift','selectedId','history']) assert.deepEqual(after[key],safe[key]);
    }
    checks.push('Malformed, unsupported, out-of-range and oversized files preserve scene and history');
    await page.locator('#scene-file').setInputFiles(scenePath);
    await page.waitForFunction(()=>document.getElementById('file-status').textContent.startsWith('Scene loaded'));
    assert.equal(await page.locator('#scene-file').inputValue(),'');
    assert.equal(await page.locator('#file-status').getAttribute('class'),'hint');
    checks.push('A valid file loads after an error and the input can select the same file again');
    await page.locator('#clear-button').click();
    const [emptyDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#save-scene-button').click()]);
    const emptyPath=path.join(out,'empty-scene.json');await emptyDownload.saveAs(emptyPath);
    await page.locator('#reset-button').click();
    await page.locator('#scene-file').setInputFiles(emptyPath);
    await page.waitForFunction(()=>window.rippleDiagnostics().sourceCount===0 && !document.getElementById('load-scene-button').disabled);
    assert.equal((await state()).selectedId,null);
    await page.locator('#add-button').click();assert.equal((await state()).sourceCount,1);
    checks.push('Empty scenes can be saved, loaded and rebuilt through accessible controls');
    await page.locator('#reset-button').click();
    assert.deepEqual(errors,[]); checks.push('No uncaught JavaScript errors in the tested flow');
    await page.screenshot({path:path.join(out,'layout-review.png'),fullPage:true});
    const report={checkedAt:new Date().toISOString(),stage:Number(process.env.RIPPLE_STAGE||1),browser:await browser.version(),checks,errors,
      note:'Automated local-browser checks; not a classroom user study.'};
    await fs.writeFile(path.join(out,'revisions-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
    await context.close();
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
