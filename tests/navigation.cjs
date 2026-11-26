const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PET_DEMO_URL || 'http://127.0.0.1:53300/';

(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    for (const [width,height,touch] of [[1280,800,false],[320,640,true],[844,390,true]]) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:touch});
      const p = await context.newPage();
      p.setDefaultTimeout(6000);
      const errors = [];
      p.on('pageerror', error => errors.push(error.message));
      const press = locator => touch ? locator.tap() : locator.click();
      const panel = p.locator('#task-window');
      const launch = p.locator('.top-open');
      const close = panel.getByRole('button',{name:/返回桌宠|Back to Miso/});
      await p.goto(base);
      assert.equal(await p.locator('.pet-brand').getAttribute('href'),null);
      await press(launch);
      await press(p.locator('[data-action="pick:reading"]'));
      await press(p.locator('[data-action="begin"]'));
      await press(p.locator('[data-language=en]'));
      assert.match(await close.innerText(),/Back to Miso/);
      await press(close);
      await panel.waitFor({state:'hidden'});
      assert(await launch.evaluate(el=>document.activeElement===el));
      await p.goForward();
      await panel.waitFor();
      assert(await p.locator('#pet-widget').evaluate(el=>el.inert));
      await p.goBack();
      await panel.waitFor({state:'hidden'});
      const toggle = p.locator('#pet-menu-toggle');
      await press(toggle);
      await press(p.locator('#pet-menu [data-pet=open]'));
      await p.keyboard.press('Escape');
      await panel.waitFor({state:'hidden'});
      assert(await toggle.evaluate(el=>document.activeElement===el));
      await press(launch);
      const backdrop = p.locator('.desk-backdrop');
      await backdrop.click({position:{x:4,y:height-5}});
      await panel.waitFor({state:'hidden'});
      await press(p.locator('#pet-character'));
      assert(await p.locator('#bubble-actions [data-pet=finish]').evaluate(el=>el===document.activeElement));
      await p.keyboard.press('Escape');
      await p.locator('#pet-bubble').waitFor({state:'hidden'});
      await p.goto(new URL('tasks.html',base).href);
      await press(p.locator('[data-action=finish]'));
      await press(p.getByRole('link',{name:'Back to Miso'}));
      await p.waitForFunction(()=>window.OneStepCompanion);
      await press(p.locator('#pet-character'));
      await p.locator('#bubble-content h2').waitFor();
      assert.match(await p.locator('#bubble-content h2').innerText(),/first paragraph of the abstract/);
      await p.goto(new URL('pet.html#tasks',base).href);
      await p.reload();
      await panel.waitFor();
      await press(close);
      await panel.waitFor({state:'hidden'});
      assert.equal(new URL(p.url()).hash,'');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      console.log('PASS task entry, return, browser history, focus, saved progress and direct links at '+width+'×'+height);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
