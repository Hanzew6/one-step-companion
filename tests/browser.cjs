const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const M=require('../dist/model.js');
const target=process.env.DEMO_URL||pathToFileURL(path.resolve(__dirname,'../dist/tasks.html')).href;
const output=process.env.SCREENSHOT_DIR||path.resolve(__dirname,'../test-results/screenshots');
const click=async(p,a)=>{if(['tomorrow','overdue','reset'].includes(a)&&!await p.locator('#demo-tools').evaluate(e=>e.open))await p.locator('#demo-tools summary').click();if(a==='reset')await p.locator('[data-action="ask-reset"]').click();await p.locator(`[data-action="${a}"]:visible`).first().click();};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),contexts=[];let count=0;
 fs.mkdirSync(output,{recursive:true});
 async function page(state,clock=false,blocked=false){const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});contexts.push(c);
  if(state)await c.addInitScript(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state,key:M.STORAGE_KEY});
  if(blocked)await c.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));
  const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>{throw e;});if(clock)await p.clock.install();await p.goto(target);await p.locator('#app').waitFor();return p;}
 const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
 const saved=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),M.STORAGE_KEY);
 async function shot(p,name){await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(output,name),fullPage:true});}
 try{
  await check('one task list and stable work area replace routes and duplicate cards',async()=>{
   const p=await page();assert.equal(await p.locator('#task-list').count(),1);assert.equal(await p.locator('.task-row').count(),2);
   assert.equal(await p.locator('#work-area').count(),1);assert.equal(await p.locator('.product-nav,.focus-card,.daily-advice').count(),0);
   assert.equal((await saved(p)).selected,null);assert.equal(await p.locator('[data-action="begin"]').count(),1);
   await shot(p,'single-page-desktop.png');await p.setViewportSize({width:390,height:844});await shot(p,'single-page-mobile.png');
  });
  await check('selecting and starting are separate; native double-click cannot finish',async()=>{
   const p=await page();await click(p,'pick:reading');assert.equal((await saved(p)).tasks.find(t=>t.id==='reading').started,false);
   await p.locator('[data-action="begin"]').dblclick();assert.equal((await saved(p)).tasks.find(t=>t.id==='reading').index,0);
   await click(p,'finish');assert.equal((await saved(p)).tasks.find(t=>t.id==='reading').index,1);
   assert.equal(await p.locator('#task-list').count(),1);assert.match(await p.locator('#work-title').textContent(),/标题/);
  });
  await check('help offers a suggestion immediately and adoption starts without a second confirmation',async()=>{
   const p=await page();await click(p,'help');assert.equal(await p.locator('.suggestion').count(),1);assert.equal(await p.locator('#task-list').count(),1);
   await click(p,'reason:unclear');await click(p,'reason:smaller');await click(p,'adopt');
   assert.equal(await p.locator('[data-action="begin"]').count(),0);assert.equal(await p.locator('[data-action="finish"]').count(),1);
   await click(p,'finish');assert.match(await p.locator('#work-title').textContent(),/已找到/);
   assert.equal((await saved(p)).tasks[0].index,0);
   const titles=[];for(let i=0;i<2;i++){await click(p,'help');titles.push(await p.locator('.suggestion h3').textContent());await click(p,'adopt');await click(p,'finish');}
   assert.notEqual(titles[0],titles[1]);await click(p,'help');assert.equal(await p.locator('[data-action="adopt"]').count(),0);assert.match(await p.locator('#work-area').textContent(),/老师|同学/);
  });
  await check('rest begins inline, returns directly and remains independent for a preview or empty list',async()=>{
   const p=await page();await click(p,'rest');assert.equal(await p.locator('.rest-panel').count(),1);assert.equal((await saved(p)).selected,null);
   await click(p,'activity:mindful');assert.equal(await p.locator('.mindful-line').count(),3);await p.reload();await click(p,'return');
   assert.equal((await saved(p)).selected,null);assert.equal(await p.locator('[data-action="begin"]').count(),1);
   await click(p,'begin');await click(p,'rest');await click(p,'activity:walk');await click(p,'return');assert.equal(await p.locator('[data-action="finish"]').count(),1);
   const q=await page({...M.initialState(),tasks:[]});await click(q,'rest');await click(q,'return');assert.equal(await q.locator('.empty-state').count(),1);
  });
  await check('changing or reselecting a rest activity retains elapsed break time',async()=>{
   const p=await page(undefined,true);await click(p,'begin');await click(p,'rest');await p.clock.fastForward(125000);
   assert.match(await p.locator('#break-time').textContent(),/2 分钟/);
   await click(p,'activity:walk');assert.match(await p.locator('#break-time').textContent(),/2 分钟/);
   await click(p,'activity:walk');assert.match(await p.locator('#break-time').textContent(),/2 分钟/);
   await p.reload();assert.match(await p.locator('#break-time').textContent(),/2 分钟/);
   await click(p,'return');await click(p,'rest');assert.equal(await p.locator('#break-time').textContent(),'');
  });
  await check('stopping is immediate, optional note survives next day and never becomes HTML',async()=>{
   const p=await page();await click(p,'begin');await click(p,'stop');assert.equal(await p.locator('.stopped-panel').count(),1);
   assert.equal((await saved(p)).tasks[0].stoppedOn,'2026-11-01');
   await p.locator('#resume-note').fill('<img src=x onerror=alert(1)> 从第二句继续');await click(p,'save-note');
   await p.reload();await click(p,'tomorrow');assert.match(await p.locator('#work-area').textContent(),/从第二句继续/);assert.equal(await p.locator('#work-area img').count(),0);
   await click(p,'begin');assert.equal((await saved(p)).tasks[0].stoppedOn,null);assert.equal((await saved(p)).tasks[0].index,0);
   await click(p,'pick:reading');await click(p,'pick:stats');assert.match(await p.locator('#work-area').textContent(),/从第二句继续/);
  });
  await check('optional capacity annotates the existing list and adding a task never switches selected work',async()=>{
   const p=await page();await click(p,'pick:reading');await click(p,'begin');
   await click(p,'add');await click(p,'confirm-add');assert.equal((await saved(p)).selected,'reading');assert.match(await p.locator('#work-context').textContent(),/阅读/);
   assert.equal(await p.locator('.task-row').count(),3);assert.equal(await p.locator('.task-row[data-id="paper"] .recommend-tag').count(),1);
   for(const capacity of [15,30,60]){await click(p,'plan');await click(p,'capacity:'+capacity);assert.equal(await p.locator('.block-time').count(),capacity===15?1:2);}
   assert.equal(await p.locator('#task-list').count(),1);await click(p,'plan');assert.match(await p.locator('#plan-panel').textContent(),/截止时间不变/);
   await click(p,'tomorrow');assert.equal(await p.locator('.block-time').count(),0);assert.equal((await saved(p)).selected,'reading');
  });
  await check('range disk changes; manual timer excludes rest and never completes work',async()=>{
   const p=await page(undefined,true);await click(p,'estimate');await click(p,'range:1,2');
   assert.equal(await p.locator('.estimate-dial').getAttribute('data-range'),'1,2');await click(p,'begin');await click(p,'more');await click(p,'option:timer');
   await click(p,'timer-start');await p.clock.fastForward(185000);assert.match(await p.locator('#elapsed-time').textContent(),/3 分/);assert(await p.locator('#time-overrun').isVisible());
   const before=(await saved(p)).tasks[0].index;await click(p,'rest');await p.clock.fastForward(120000);await click(p,'return');await click(p,'more');await click(p,'option:timer');
   assert.match(await p.locator('#elapsed-time').textContent(),/3 分/);assert.equal((await saved(p)).tasks[0].index,before);
   await click(p,'option:note');await p.locator('#resume-note').fill('这段还在编辑');await p.clock.fastForward(65000);assert.equal(await p.locator('#resume-note').inputValue(),'这段还在编辑');
  });
  await check('three actions retain the unfinished assignment and overview is inline',async()=>{
   const p=await page();for(let i=0;i<3;i++){await click(p,'begin');await click(p,'finish');}
   assert.equal(await p.locator('.demo-boundary').count(),1);assert.equal(await p.locator('[data-action="finish"]').count(),0);assert.equal(await p.locator('.task-row').count(),2);
   await click(p,'more');await click(p,'option:overview');assert.match(await p.locator('#option-panel').textContent(),/未标记完成或提交/);
  });
  await check('legacy route states map to inline content without losing notes or task identity',async()=>{
   for(const view of ['today','step','help','pause','overview','support','activity','recover']){
    const s=M.transition(M.initialState(),{type:'OPEN',id:'stats'});s.view=view;s.tasks[0].note='旧便签';
    if(['activity','recover'].includes(view)){s.support={kind:'mindful',stage:2,startedAt:1000};s.supportTask='stats';}
    const p=await page(s);assert.equal(await p.locator('#task-list').count(),1);assert.equal((await saved(p)).tasks[0].note,'旧便签');
    assert.equal((await saved(p)).selected,'stats');assert(!await p.locator('#storage-notice').isVisible());
    if(['support','activity','recover'].includes(view))assert.equal(await p.locator('.rest-panel').count(),1);
    if(view==='help')assert.equal(await p.locator('.suggestion').count(),1);
   }
  });
  await check('an unfinished started step remains completable after day change and an old today reload',async()=>{
   let s=M.transition(M.initialState(),{type:'OPEN',id:'stats'});s=M.transition(s,{type:'BEGIN'});s.view='today';
   const p=await page(s);await click(p,'finish');assert.equal((await saved(p)).tasks[0].index,1);
   await click(p,'begin');await click(p,'tomorrow');await click(p,'finish');assert.equal((await saved(p)).tasks[0].index,2);
  });
  await check('small widths, long assistance, rest and keyboard focus remain reachable',async()=>{
   const p=await page();await click(p,'add');await click(p,'confirm-add');await click(p,'pick:paper');
   for(const width of [320,390,651,1024,1440]){await click(p,'reset');await click(p,'add');await click(p,'confirm-add');await click(p,'pick:paper');await p.setViewportSize({width,height:640});await click(p,'help');await click(p,'adopt');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
    await click(p,'rest');await click(p,'activity:mindful');await click(p,'return');
    await p.keyboard.press('Tab');const focused=await p.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});assert(focused,'focused control out of view');
    await click(p,'finish');if(width===390)await shot(p,'single-page-help-mobile.png');
   }
   await p.setViewportSize({width:320,height:640});await click(p,'rest');await click(p,'activity:mindful');await shot(p,'single-page-rest-320.png');
  });
  await check('blocked and corrupt storage recover visibly; reset preserves unrelated data',async()=>{
   const p=await page(undefined,false,true);assert.match(await p.locator('#storage-notice').textContent(),/无法保存/);await click(p,'begin');await click(p,'finish');assert.match(await p.locator('#work-title').textContent(),/条件/);
   const q=await page({version:100});assert.match(await q.locator('#storage-notice').textContent(),/恢复初始/);
   await q.evaluate(()=>localStorage.setItem('unrelated','keep'));await click(q,'reset');assert.equal(await q.evaluate(()=>localStorage.getItem('unrelated')),'keep');
  });
  console.log(JSON.stringify({passed:count,target,screenshots:output}));
 }finally{for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
