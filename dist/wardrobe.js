(() => {
  'use strict';
  const key = 'one-step-pet-closet-v1';
  const goods = [
    {id:'beret',name:'莓果贝雷帽',slot:'outfit',level:2,price:2},
    {id:'fireflies',name:'萤火微光',slot:'effect',level:3,price:3},
    {id:'cape',name:'林间小斗篷',slot:'outfit',level:4,price:5},
    {id:'stars',name:'星河环绕',slot:'effect',level:5,price:8}
  ];
  function read() {
    const data=JSON.parse(localStorage.getItem(key)||'{}') || {};
    const owned=goods.filter(g=>Array.isArray(data.owned)&&data.owned.includes(g.id)).map(g=>g.id);
    const worn={};
    for(const item of goods) if(owned.includes(item.id)&&data.worn?.[item.slot]===item.id) worn[item.slot]=item.id;
    return {owned,worn};
  }
  function balance(growth,closet) {
    return growth.earned-goods.filter(g=>closet.owned.includes(g.id)).reduce((sum,g)=>sum+g.price,0);
  }
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function paint(image,mood,outfit) {
    const prefix=outfit==='beret'||outfit==='cape'?outfit+'-':'';
    const source='kitten/'+prefix+mood+(motion.matches?'-still':'')+'.webp';
    if(image.getAttribute('src')!==source)image.src=source;
  }
  function decorate(layer,worn,mood='idle') {
    layer.dataset.outfit=worn.outfit||'';
    layer.dataset.effect=worn.effect||'';
    if(!layer.firstElementChild) layer.innerHTML='<i class="glints"><b></b><b></b><b></b><b></b><b></b></i>';
    paint(layer.previousElementSibling,mood,worn.outfit);
  }
  window.PetWardrobe={key,goods,read,balance,decorate,paint};
  if (!document.body.dataset.petDemo) return;
  function refresh(){
    const pet=window.OneStepCompanion;
    const state=pet.snapshot(), task=OneStep.displayedTask(state);
    document.getElementById('desk-level').textContent='Lv.'+OneStep.growth(state).level;
    const deskTask=document.getElementById('desk-task');
    deskTask.textContent=['activity','support','recover'].includes(state.view)?'正在休息，随时可以回来。':task?'当前作业 · '+OneStep.CATALOG[task.id].short:'';
    let worn={};
    try { worn=read().worn; } catch {}
    decorate(document.querySelector('#pet-character .wardrobe-layer'),worn,document.getElementById('pet-widget').dataset.mood||'idle');
  }
  refresh();
  window.addEventListener('one-step-change',refresh);
  window.addEventListener('pageshow',refresh);
  window.addEventListener('storage',e=>{if(!e.key||e.key===key)refresh();});
})();
