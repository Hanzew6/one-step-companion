const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const target = process.env.PET_DEMO_URL || 'http://kitten.test/index.html';
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const p=await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];
    p.on('pageerror',err=>errors.push(err.message));
    if(!process.env.PET_DEMO_URL) await p.route('http://kitten.test/**',route=>{
      const filename=new URL(route.request().url()).pathname;
      return route.fulfill({path:path.join(__dirname,'../dist',filename)});
    });
    await p.goto(target);
    const pet=p.locator('#pet-character'), art=p.locator('#kitten-art');
    const click=action=>p.locator('[data-pet="'+action+'"]:visible').first().click();
    for(const mood of ['idle','wave','stretch','sleep']) {
      if(mood!=='idle'){await pet.click({button:'right'});await click(mood==='sleep'?'rest':mood);}
      await art.evaluate(el=>el.decode());
      assert((await art.getAttribute('src')).endsWith(mood+'.webp'));
      const first=await art.screenshot(); await p.waitForTimeout(285);
      assert(!first.equals(await art.screenshot()),mood+' frames must change in the browser');
    }
    await p.locator('[data-language=en]').click();
    await click('resume'); await click('begin');
    assert.match(await p.locator('#bubble-content').innerText(),/first question/);
    assert.equal(await p.locator('[data-pet=finish]').innerText(),'Mark this step done');
    const before=await p.evaluate(()=>window.OneStepCompanion.snapshot());
    await p.locator('[data-language=zh]').click();
    assert.match(await p.locator('#bubble-content').innerText(),/第一道题/);
    await p.locator('[data-language=en]').click(); await p.reload();
    assert.equal(await p.locator('html').getAttribute('lang'),'en');
    assert.deepEqual(await p.evaluate(()=>window.OneStepCompanion.snapshot()),before);
    await pet.click(); await click('help');
    assert(!/[\u3400-\u9fff]/.test(await p.locator('#app').innerText()),'task and help panel must be translated');
    await p.locator('[data-action=adopt]').click();
    await p.locator('[data-action=stop]').click();
    await p.locator('#resume-note').fill('今天安静 — my own note');
    await p.locator('[data-action=save-note]').click();
    assert.equal(await p.locator('#resume-note').inputValue(),'今天安静 — my own note');
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.waitForFunction(()=>document.querySelector('#kitten-art').getAttribute('src').endsWith('-still.webp'));
    await click('close');
    await p.setViewportSize({width:360,height:680}); await pet.click({button:'right'});
    assert(await p.locator('#pet-menu').isVisible());
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS original watercolor poses, reduced motion and bilingual task flow');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
