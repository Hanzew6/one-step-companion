const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PET_DEMO_URL||'http://tasks.test/index.html';

(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  for(const [width,height,standalone] of [[320,640,false],[1280,800,false],[390,844,true]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   if(!process.env.PET_DEMO_URL)await context.route('http://tasks.test/**',route=>{
    const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
    return route.fulfill({path:path.join(__dirname,'../dist',file)});
   });
   const p=await context.newPage();p.setDefaultTimeout(6500);
   const errors=[];p.on('pageerror',err=>errors.push(err.message));
   await p.goto(standalone?new URL('tasks.html',base).href:base);
   const button=(name)=>p.getByRole('button',{name,exact:true});
   if(!standalone)await button('我的任务').click();
   const heading=p.locator('#work-title');
   async function primaryInView(name){
    const el=button(name);
    await el.waitFor();
    assert(await el.evaluate(node=>{
     const r=node.getBoundingClientRect(),scroll=node.closest('.window-scroll')?.getBoundingClientRect();
     const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
     return r.top>=(scroll?.top||0)-1 && r.bottom<=Math.min(scroll?.bottom||innerHeight,innerHeight)+1 && node.contains(hit);
    }),name+' must already be visible at '+width);
   }
   await p.getByRole('button',{name:/课程阅读.*截止/}).click();
   await primaryInView('开始这一小步 →');
   assert.match(await p.locator('#work-context').innerText(),/课程阅读/);
   await button('换作业').click();
   assert(await p.locator('#today-title').evaluate(el=>el===document.activeElement));
   await p.getByRole('button',{name:/课程阅读.*截止/}).click();
   await button('开始这一小步 →').click();
   await primaryInView('标记这一步完成');
   assert.match(await p.locator('.doing-hint').innerText(),/在作业里/);
   await button('卡住了').click();
   await button('没看懂').click();
   const suggested=await p.locator('.suggestion h3').innerText();
   await primaryInView('开始这个小动作');
   await button('开始这个小动作').click();
   assert.equal(await heading.innerText(),suggested);
   await button('休息一下').click();
   await primaryInView('回到刚才这一步');
   assert.match(await p.locator('.return-context').innerText(),new RegExp(suggested));
   await button('走走 / 舒展').click();
   await primaryInView('回到刚才这一步');
   await button('回到刚才这一步').click();
   assert.equal(await heading.innerText(),suggested);
   assert.match(await p.locator('.resume-feedback').innerText(),/休息前/);
   await primaryInView('标记这一步完成');
   await button('EN').click();
   assert(!/[\u3400-\u9fff]/.test(await p.locator('#app').innerText()));
   await button('Mark this step done').click();
   assert.match(await p.locator('.kicker').innerText(),/Demo step 1\/3/);
   await p.locator('[data-action=help]').click();
   await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await primaryInView('Start this smaller action');
   await button('Start this smaller action').click();
   await p.locator('[data-action=rest]').click();
   const pausedStep=await p.locator('.return-context b').innerText();
   await p.locator('[data-action=return]').click();
   assert.equal(await heading.innerText(),pausedStep);
   await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await primaryInView('Mark this step done');
   assert.deepEqual(errors,[]);
   console.log('PASS visible primary actions, selection, help, break, same-step return and completion at '+width+' '+(standalone?'standalone':'embedded'));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
