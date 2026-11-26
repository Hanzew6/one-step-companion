(() => {
  const key = 'one-step-language';
  const dictionary = window.OneStepEnglish;
  const labels = Object.keys(dictionary).sort((a,b) => b.length-a.length);
  const phrases = new RegExp(labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
  const originals = new WeakMap();
  let language = 'zh';
  try { if(localStorage.getItem(key)==='en') language='en'; } catch {}
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function english(value) {
    return value.replace(/再得 (\d+) XP 解锁「([^」]+)」/g,(_,xp,name)=>'Earn '+xp+' XP to unlock '+(dictionary[name]||name))
      .replace(/Lv\.(\d+) 解锁/g,(_,level)=>'Unlocks at Lv.'+level)
      .replace(/(\d+) 月 (\d+) 日(截止)?/g, (_,m,d,due) => (due?'Due ':'')+months[Number(m)-1]+' '+d)
      .replace(/已逾期 (\d+) 天/g, (_,d)=>d+' '+(d==='1'?'day':'days')+' overdue')
      .replace(phrases, match => dictionary[match]).replace(/\b1 paw coins\b/g,'1 paw coin').replace(/。/g,'. ').replace(/：/g,': ').replace(/；/g,'; ');
  }
  function localize(node, field, current, write) {
    let record = originals.get(node);
    if(!record) originals.set(node,record=new Map());
    let pair = record.get(field);
    if(!pair || (current!==pair.zh && current!==pair.en)) {
      if(!/[\u3400-\u9fff]/.test(current)) return;
      pair={zh:current,en:english(current)}; record.set(field,pair);
    }
    if(current!==pair[language]) write(pair[language]);
  }
  function visit(node) {
    if(node.nodeType===3) {
      if(node.parentElement?.closest('textarea,script,style,[data-verbatim],[data-language]')) return;
      localize(node,'text',node.data,value=>node.data=value); return;
    }
    if(node.nodeType!==1 || node.matches('script,style,[data-language],[data-verbatim]')) return;
    for(const field of ['aria-label','placeholder','title']) if(node.hasAttribute(field)) localize(node,field,node.getAttribute(field),v=>node.setAttribute(field,v));
    if(!node.matches('textarea')) for(const child of node.childNodes) visit(child);
  }
  function apply() {
    document.documentElement.lang=language==='en'?'en':'zh-CN';
    for(const button of document.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed',String(button.dataset.language===language));
    visit(document.title ? document.querySelector('title') : document.head);
    visit(document.body);
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-language]');
    if(!button) return;
    language=button.dataset.language;
    try {localStorage.setItem(key,language);} catch {}
    apply();
  });
  new MutationObserver(changes=>{
    for(const change of changes) {
      if(change.type==='characterData') visit(change.target);
      else for(const child of change.addedNodes) visit(child);
    }
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
  apply();
})();
