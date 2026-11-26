(() => {
  'use strict';
  const W=window.PetWardrobe, M=window.OneStep;
  const $=id=>document.getElementById(id);
  const progress=M.createPersistence(()=>localStorage);
  let selected=null, busy=false, preview=false, mood='idle', noticeTimer;
  function notice(message){
    clearTimeout(noticeTimer);$('shop-notice').textContent=message;
    noticeTimer=setTimeout(()=>{$('shop-notice').textContent='';},3500);
  }
  const from=new URLSearchParams(location.search).get('from');
  if(from==='tasks'||from==='list'){
    $('shop-back').href=from==='list'?'tasks.html':'index.html#tasks';
    $('shop-back').textContent='← 返回我的任务';
  }
  function stock(item,growth,closet){
    if(closet.worn[item.slot]===item.id)return '已穿戴';
    if(closet.owned.includes(item.id))return '已拥有';
    if(growth.level<item.level)return 'Lv.'+item.level+' 解锁';
    return item.price+' 爪币';
  }
  function read(){
    const {state,mode}=progress.load();
    if(mode==='memory') throw Error('storage');
    return {growth:M.growth(state),closet:W.read()};
  }
  function draw(){
    let growth,closet,available=true;
    try { ({growth,closet}=read()); }
    catch { available=false;growth=M.growth(M.initialState());closet={owned:[],worn:{}}; }
    const coins=W.balance(growth,closet), item=selected;
    $('level').textContent='小伴 · Lv.'+growth.level;
    $('wallet').textContent='◈ '+coins+' 爪币';
    $('xp-bar').max=growth.next||90; $('xp-bar').value=growth.xp;
    const upcoming=W.goods.find(g=>g.level>growth.level);
    $('next-unlock').textContent=upcoming?growth.xp+' / '+growth.next+' XP · 再得 '+(growth.next-growth.xp)+' XP 解锁「'+upcoming.name+'」':growth.xp+' XP · 全部装扮已解锁';
    const worn=item&&closet.worn[item.slot]===item.id, owned=item&&closet.owned.includes(item.id), locked=item&&growth.level<item.level;
    const trying=Boolean(item&&preview&&!worn);
    const equipped=W.goods.filter(g=>closet.worn[g.slot]===g.id).map(g=>g.name);
    W.decorate(document.querySelector('.mirror .wardrobe-layer'),trying?{...closet.worn,[item.slot]:item.id}:closet.worn,mood);
    $('mirror-mode').textContent=trying?'仅试穿':'当前穿戴';
    $('item-title').textContent=trying?item.name:equipped.join(' · ')||'原版小伴';
    $('item-status').textContent=!available?'浏览器无法保存装扮，可继续试穿。':!trying?(worn?'正在桌宠上使用':'从货架选一件，看看穿戴效果。'):owned?'已拥有，随时可以换上。':locked?'Lv.'+item.level+' 解锁 · '+item.price+' 爪币':coins<item.price?'还差 '+(item.price-coins)+' 爪币':'兑换需要 '+item.price+' 爪币';
    const action=$('shop-action');
    action.hidden=!item||(!trying&&!worn)||(!owned&&(locked||coins<item.price));
    action.disabled=busy||!item||!available||(!owned&&(locked||coins<item.price));
    $('earn-link').hidden=!trying||!available||owned||(!locked&&coins>=item.price);
    action.textContent=worn?'卸下装扮':owned?'穿戴到桌宠':locked?'尚未解锁':item&&coins<item.price?'爪币不足':'兑换并穿戴';
    $('compare').hidden=!item||worn;
    $('compare').textContent=trying?'看当前穿戴':'继续试穿';
    for(const g of W.goods){
      const card=document.getElementById('pick-'+g.id);
      card.setAttribute('aria-pressed',String(item?.id===g.id));
      card.querySelector('small').textContent=stock(g,growth,closet);
      card.querySelector('.try-label').textContent=closet.worn[g.slot]===g.id?'管理':trying&&item===g?'试穿中':'试穿';
    }
  }
  for(const item of W.goods){
    const card=document.createElement('button');
    card.id='pick-'+item.id;card.className='stock-card';
    card.innerHTML='<span class="swatch swatch-'+item.id+'" aria-hidden="true"></span><span class="stock-copy"><b>'+item.name+'</b><small></small></span><span class="try-label">试穿</span>';
    card.addEventListener('click',()=>{
      selected=item; preview=true; $('shop-notice').textContent='';draw();
      if(matchMedia('(max-width:680px)').matches){$('fitting').focus({preventScroll:true});$('fitting').scrollIntoView({block:'start'});}
    });
    $('goods').append(card);
  }
  $('compare').addEventListener('click',()=>{preview=!preview;draw();});
  document.querySelector('.pose-options').addEventListener('click',event=>{
    const control=event.target.closest('[data-pose]');
    if(!control)return;
    mood=control.dataset.pose;
    for(const button of control.parentElement.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button===control));
    draw();
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',draw);
  $('shop-action').addEventListener('click',async()=>{
    if(busy||!selected)return;
    const item=selected;
    let before;
    try { before=read(); } catch { notice('装扮没有保存成功，请重试。');draw();return; }
    const wasWorn=before.closet.worn[item.slot]===item.id;
    busy=true;draw();
    function commit(){
      const {growth,closet}=read();
      if(wasWorn){
        if(closet.worn[item.slot]===item.id)delete closet.worn[item.slot];
      }else{
        if(!closet.owned.includes(item.id)){
          if(growth.level<item.level||W.balance(growth,closet)<item.price)return;
          closet.owned.push(item.id);
        }
        closet.worn[item.slot]=item.id;
      }
      localStorage.setItem(W.key,JSON.stringify(closet));
      if(item===selected)preview=!wasWorn;
      notice((wasWorn?'已卸下':'已穿戴')+' · '+item.name);
    }
    try { if(navigator.locks)await navigator.locks.request(W.key,commit);else commit(); }
    catch { notice('装扮没有保存成功，请重试。'); }
    finally {busy=false;draw();}
  });
  draw();window.addEventListener('pageshow',draw);
  window.addEventListener('storage',e=>{if(!e.key||e.key===M.STORAGE_KEY||e.key===W.key)draw();});
})();
