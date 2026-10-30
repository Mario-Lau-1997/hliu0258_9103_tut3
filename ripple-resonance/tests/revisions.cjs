 //* Run with NODE_PATH, BROWSER_EXECUTABLE and RIPPLE_TEST_OUTPUT as in browser.cjs.
// */
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
    // Further-stage checks are inserted here as those features are developed.
    assert.deepEqual(errors,[]); checks.push('No uncaught JavaScript errors in the tested flow');
    await page.screenshot({path:path.join(out,'layout-review.png'),fullPage:true});
    const report={checkedAt:new Date().toISOString(),stage:Number(process.env.RIPPLE_STAGE||1),browser:await browser.version(),checks,errors,
      note:'AI-assisted automated tests. Not student-run tests or a user study.'};
    await fs.writeFile(path.join(out,'revisions-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
    await context.close();
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
