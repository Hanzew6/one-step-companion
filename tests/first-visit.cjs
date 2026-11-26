const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PET_DEMO_URL || 'http://first-visit.test/index.html';

(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  try {
    for (const [width,height] of [[1280,800],[390,844]]) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:width<500});
      const p = await context.newPage();
      p.setDefaultTimeout(7000);
      const errors = [];
      p.on('pageerror',e=>errors.push(e.message));
      if (!process.env.PET_DEMO_URL) await p.route('http://first-visit.test/**', route =>
        route.fulfill({path:path.join(__dirname,'../dist',new URL(route.request().url()).pathname)}));
      await p.goto(url);
      const button = (name,scope=p) => scope.getByRole('button',{name,exact:true});
      const press = async el => {
        if (width>=500) return el.click();
        // Deliberate touches. The UI ignores a native double-tap on Start/Done.
        await p.waitForTimeout(550);
        await el.tap();
      };
      const click = async (name,scope) => press(button(name,scope));
      const bubble = p.locator('#pet-bubble'), menu = p.locator('#pet-menu');
      const reminder = () => p.locator('#reminder-status').innerText();
      const scheduled = await reminder();
      await click('预览提醒');
      assert.match(await bubble.innerText(),/提醒预览/);
      await click('收起提示',bubble);
      assert.equal(await reminder(),scheduled);
      await p.reload();
      assert.equal(await reminder(),scheduled);
      await click('查看下一步');
      assert.match(await bubble.innerText(),/示例步骤 1\/3/);
      await click('开始这一小步',bubble);
      assert.match(await bubble.innerText(),/进行中/);
      await click('标记这一步完成',bubble);
      assert.match(await bubble.innerText(),/上一步已完成 · 示例步骤 2\/3/);
      await click('卡住了',bubble);
      await click('没看懂');
      await click('开始这个小动作');
      assert.match(await p.locator('#work-area').innerText(),/进行中 · 辅助小动作/);
      await click('休息一下');
      await click('走走 / 舒展');
      await click('回到刚才这一步');
      await click('今天先到这里');
      await p.locator('#resume-note').fill('下次圈出条件');
      await click('保存便签');
      await p.locator('#demo-tools summary').click();
      await click('重置任务演示');
      assert.match(await p.locator('#reset-confirm').innerText(),/清除.*便签/);
      await click('保留进度');
      await click('← 返回桌宠');
      await click('我的任务');
      assert.equal(await p.locator('#resume-note').inputValue(),'下次圈出条件');
      await click('← 返回桌宠');
      await press(p.locator('#pet-menu-toggle'));
      await press(menu.getByRole('button',{name:/和小猫击掌/}));
      assert.match(await bubble.innerText(),/击掌/);
      await click('收起提示',bubble);
      await press(p.locator('#pet-menu-toggle'));
      await press(menu.getByRole('button',{name:/今天暂停提醒/}));
      assert.match(await reminder(),/今天安静/);
      await click('知道啦',bubble);
      await click('EN');
      await click('My tasks');
      await press(p.locator('[data-action="pick:reading"]'));
      await press(p.locator('[data-action=begin]'));
      assert.match(await p.locator('#work-area').innerText(),/In progress · Demo step 1\/3/);
      await click('Mark this step done');
      assert.match(await p.locator('#work-area').innerText(),/Next step · Demo step 2\/3/);
      assert.deepEqual(errors,[]);
      console.log('PASS first visit, reminder preview, start to completion, help, rest, saved note, cancel reset, social menu and English at '+width);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
