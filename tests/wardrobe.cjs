const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const M=require('../dist/model.js');
const base=process.env.PET_DEMO_URL||'http://wardrobe.test/';
const act=(s,type,extra={})=>M.companion(s,{type,...extra});
let state=M.initialState();
state=act(act(state,'ASSIST'),'ADOPT_START',{reason:'smaller'});
state=act(state,'FINISH');
assert.equal(M.growth(state).xp,5);
state=act(act(act(state,'ASSIST'),'ADOPT_START',{reason:'unclear'}),'FINISH');
assert.equal(M.growth(state).xp,5);
state=act(act(state,'START'),'FINISH');
assert.deepEqual(M.growth(state),{xp:10,earned:2,level:2,next:30});
state=act(state,'RESET');
state=act(act(state,'START'),'FINISH');
assert.equal(M.growth(state).xp,10);
console.log('PASS split-step credit and reset replay protection');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try {
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  if(!process.env.PET_DEMO_URL)await ctx.route('http://wardrobe.test/**',route=>{
   const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
   return route.fulfill({path:path.join(__dirname,'../dist',file)});
  });
  const p=await ctx.newPage();p.setDefaultTimeout(6000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);await p.locator('.desk-shop-link').click();
  await p.locator('#pick-beret').waitFor();
  assert(await p.locator('#shop-action').isDisabled());
  assert.equal(await p.locator('#mirror-mode').innerText(),'当前穿戴');
  await p.locator('#pick-cape').click();
  assert.equal(await p.locator('.mirror .wardrobe-layer').getAttribute('data-outfit'),'cape');
  for(const mood of ['wave','stretch','sleep','idle']){
    await p.locator('[data-pose='+mood+']').click();
    await p.locator('.mirror img').evaluate(el=>el.decode());
    assert.equal(await p.locator('.mirror img').getAttribute('src'),'kitten/cape-'+mood+'.webp');
  }
  await p.locator('#compare').click();
  assert.equal(await p.locator('.mirror img').getAttribute('src'),'kitten/idle.webp');
  await p.locator('#compare').click();
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.waitForFunction(()=>document.querySelector('.mirror img').getAttribute('src')==='kitten/cape-idle-still.webp');
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.locator('#shop-back').click();
  await p.waitForFunction(()=>window.PetWardrobe);
  await p.locator('#pet-character').click();
  await p.locator('#bubble-actions [data-pet=begin]').click();
  await p.locator('#bubble-actions [data-pet=finish]').click();
  assert.match(await p.locator('#toast').innerText(),/Lv.2/);
  await p.locator('#pet-menu-toggle').click();await p.locator('[data-pet=shop]').click();
  await p.locator('#pick-beret').click();
  await p.getByRole('button',{name:'兑换并穿戴',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('#item-status').textContent.includes('正在桌宠'));
  assert.match(await p.locator('#wallet').innerText(),/0 爪币/);
  await p.locator('#shop-back').click();
  await p.waitForFunction(()=>document.querySelector('#pet-character .wardrobe-layer')?.dataset.outfit==='beret');
  assert.equal(await p.locator('#kitten-art').getAttribute('src'),'kitten/beret-idle.webp');
  assert.equal(await p.locator('#pet-character .wardrobe-layer').getAttribute('data-outfit'),'beret');
  await p.reload();
  await p.waitForFunction(()=>document.querySelector('#pet-character .wardrobe-layer')?.dataset.outfit==='beret');
  assert.equal(await p.locator('#pet-character .wardrobe-layer').getAttribute('data-outfit'),'beret');
  await p.locator('.top-open').click();
  for(let i=0;i<2;i++){await p.locator('[data-action=begin]').click();await p.locator('[data-action=finish]').click();}
  await p.locator('.task-shop-link').click();await p.locator('#pick-fireflies').click();await p.locator('#shop-action').click();
  await p.waitForFunction(()=>document.querySelector('#item-status').textContent.includes('正在桌宠'));
  await p.locator('[data-language=en]').click();
  assert(!/[\u3400-\u9fff]/.test(await p.locator('main').innerText()));
  await p.locator('#shop-back').click();await p.locator('#task-window').waitFor();
  await p.locator('[data-pet=close]').click();await p.locator('#task-window').waitFor({state:'hidden'});
  assert.equal(await p.locator('#pet-character .wardrobe-layer').getAttribute('data-effect'),'fireflies');
  await p.locator('.desk-shop-link').click();await p.locator('#pick-beret').click();
  await p.locator('#shop-action').click();
  await p.waitForFunction(()=>document.querySelector('.mirror .wardrobe-layer').dataset.outfit==='');
  assert.match(await p.locator('#wallet').innerText(),/1 paw coin\b/);
  await p.locator('#shop-back').click();await p.locator('.top-open').click();
  await p.locator('[data-action="pick:reading"]').click();
  const finishThree=async()=>{for(let i=0;i<3;i++){await p.locator('[data-action=begin]').click();await p.locator('[data-action=finish]').click();}};
  await finishThree();
  await p.locator('[data-action=add]').click();await p.locator('[data-action=confirm-add]').click();
  await p.locator('[data-action="pick:paper"]').click();await finishThree();
  await p.locator('.task-shop-link').click();
  await p.locator('#pick-stars').waitFor();
  assert.match(await p.locator('#level').innerText(),/Lv.5/);
  for(const id of ['cape','stars']){
    await p.locator('#pick-'+id).click();await p.locator('#shop-action').click();
    await p.waitForFunction(()=>document.querySelector('#item-status').textContent==='Equipped on Miso');
  }
  assert.match(await p.locator('#wallet').innerText(),/0 paw coins/);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  await ctx.close();console.log('PASS locked preview, earn in both interfaces, buy, equip, stack effect, reload, remove, language and return');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
