/* Local fixed-case demo. Legacy storage modes render inside one stable page. */
(function(){
 'use strict';
 const M=window.OneStep,persistence=M.createPersistence(()=>localStorage),loaded=persistence.load();
 let state=loaded.state,storageNotice=loaded.notice,noticeTimer;
 const ui={plan:state.view==='plan',add:state.view==='add',more:state.view==='overview',option:state.view==='overview'?'overview':null,estimate:false,reason:'smaller',resumed:false};
 const drafts=new Map(),app=document.getElementById('app');
 let lastTaskAction='';
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(label,action,cl='quiet',attrs='')=>`<button type="button" class="${cl}" data-action="${action}" ${attrs}>${label}</button>`;
 const date=d=>`${Number(d.slice(5,7))} 月 ${Number(d.slice(8,10))} 日`;
 const resting=()=>['support','activity','recover'].includes(state.view);
 function notify(message){clearTimeout(noticeTimer);document.getElementById('toast').textContent=message;noticeTimer=setTimeout(()=>document.getElementById('toast').textContent='',3500);}
 function persist(){const result=persistence.save(state);if(result.notice)storageNotice=result.notice;const box=document.getElementById('storage-notice');box.hidden=!storageNotice;box.textContent=storageNotice;}
 function disk(range){
  const point=n=>{const a=n/15*Math.PI*2;return `${(30+24*Math.sin(a)).toFixed(3)} ${(30-24*Math.cos(a)).toFixed(3)}`;};
  const sector=(a,b)=>`M30 30 L${point(a)} A24 24 0 ${b-a>7.5?1:0} 1 ${point(b)} Z`;
  return `<svg class="estimate-dial" viewBox="0 0 60 60" role="img" data-range="${range}" aria-label="预计 ${range[0]} 到 ${range[1]} 分钟，一圈 15 分钟，斜纹表示浮动范围"><defs><pattern id="range-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="3" height="3" fill="#ddd2e9"/><path d="M0 0V3" stroke="#ad98c6" stroke-width="1"/></pattern></defs><circle cx="30" cy="30" r="24" fill="#eee9f4"/><path d="${sector(0,range[0])}" fill="#a18bbf"/><path d="${sector(range[0],range[1])}" fill="url(#range-hatch)"/><circle cx="30" cy="30" r="1.2" fill="#776087"/></svg>`;
 }
 function planning(){
  const plan=M.dailyAdvice(state);
  if(!ui.plan)return '';
  return `<section id="plan-panel" class="inline-panel"><h3>今天想留多少时间？</h3><p>先安排一两个工作时段，不用承诺做完作业。</p><div class="chips">${[15,30,60].map(n=>button(n+' 分钟','capacity:'+n,'chip',`aria-pressed="${plan?.capacity===n}"`)).join('')}</div>${plan?`<p>工作 ${plan.blocks.reduce((n,b)=>n+b.minutes,0)} 分钟 · 缓冲 ${plan.buffer} 分钟${plan.free?' · 留白 '+plan.free+' 分钟':''}</p>${plan.excluded.map(t=>`<p class="excluded">${esc(M.CATALOG[t.id].short)}：${t.reason}。${M.deadlineLabel(state,t.id)}，截止时间不变。</p>`).join('')}`:'<p class="small-copy">15 分钟留 5 分缓冲；30 分钟留 5 分；60 分钟留 10 分。时段是尝试工作的时间，不是整份作业的估计。</p>'}<p class="small-copy">建议随任务和停下状态更新，截止时间不变。</p></section>`;
 }
 function taskList(){
  const tasks=M.orderedTasks(state),rec=M.recommendation(state),plan=M.dailyAdvice(state);
  return `<header class="today-heading"><h1 id="today-title" tabindex="-1">我的作业</h1><time datetime="${state.date}">示例日期 · ${date(state.date)} · ${new Intl.DateTimeFormat('zh-CN',{weekday:'short',timeZone:'UTC'}).format(new Date(state.date+'T12:00:00Z'))}</time></header><div class="list-tools"><span>${plan?`今天留 ${plan.capacity} 分钟`:'点作业看步骤，再决定是否开始。'}</span>${button(plan?'调整安排':'安排今天','plan','text-button',`aria-expanded="${ui.plan}" aria-controls="plan-panel"`)}</div>${planning()}<div id="task-list" aria-label="今天的任务">${tasks.map(t=>{const block=plan?.blocks.find(b=>b.id===t.id);return `<button class="task-row ${state.selected===t.id?'selected':''}" data-id="${t.id}" data-action="pick:${t.id}" ${state.selected===t.id?'aria-current="true"':''}><span class="task-dot" aria-hidden="true"></span><span class="task-copy"><b>${esc(t.short)}</b>${state.selected===t.id?'<span class="recommend-tag chosen">已选</span>':rec?.id===t.id?'<span class="recommend-tag">建议先做</span>':''}${t.stoppedOn===state.date?'<small>今天已停下</small>':t.index===3?'<small>示例进度已保留</small>':''}${block?`<small class="block-time">今天先做 ${block.minutes} 分钟</small>`:''}</span><span class="task-date ${state.date>t.due?'overdue':''}">${M.deadlineLabel(state,t.id)}</span><span class="task-chevron" aria-hidden="true">›</span></button>`;}).join('')}</div>${!tasks.length?'<p class="empty-state">还没有作业。先加入一个例子，或休息一会儿。</p>':''}<div class="add-row">${button('＋ 添加示例作业','add','text-button',`aria-expanded="${ui.add}"`)}</div>${ui.add?`<section class="inline-panel sample-panel"><span class="small-copy">固定演示案例</span><h3>1500 字课程论文</h3><p>教育心理学 · 11 月 3 日 23:59 截止<br>题目已选好，还没开始。</p>${tasks.some(t=>t.id==='paper')?'<p>已经加入，进度会保留。</p>':button('加入这份示例作业','confirm-add','small-primary')}${button('收起','add','text-button')}</section>`:''}`;
 }
 function estimate(task){const range=M.estimate(state,task.id);return `<button class="time-summary" data-action="estimate" aria-expanded="${ui.estimate}">${disk(range)}<span><strong>${range.join('–')} 分钟</strong><small>调整预计用时 <span aria-hidden="true">⌄</span></small></span></button>${ui.estimate?`<div class="estimate-editor"><p class="small-copy">按你的节奏调整；圆盘不是倒计时。</p><div class="chips">${M.RANGES.map(r=>button(r.join('–')+' 分','range:'+r,'chip',`aria-pressed="${String(r)===String(range)}"`)).join('')}</div></div>`:''}`;}
 function noteEditor(task){return `<label for="resume-note">留一句话给下次的自己（可选）</label><textarea id="resume-note" maxlength="160" rows="2" placeholder="例如：下次从第二句继续。">${esc(drafts.has(task.id)?drafts.get(task.id):task.note)}</textarea><div class="note-actions"><span class="small-copy">最多 160 字 · 保存在这个浏览器</span>${button('保存便签','save-note','small-primary')}</div>`;}
 function overview(task){const meta=M.CATALOG[task.id];return `<div class="overview"><h3>这份作业的全貌</h3><p><b>最终交付：</b>${{paper:'一篇 1500 字课程论文',stats:'完成并提交统计学练习',reading:'完成指定文章阅读'}[task.id]}</p><p>目前未标记完成或提交。</p><h4>已经走过的小步</h4>${task.index?'<ul>'+meta.steps.slice(0,task.index).map(([t])=>`<li>${esc(t)}</li>`).join('')+'</ul>':'<p>还没有完成原步骤，准备工作也有价值。</p>'}<h4>下一处落点</h4><p>${esc(task.aux?task.remainder||meta.steps[task.index][0]:task.index<3?meta.steps[task.index+1][0]:'已到本轮演示边界，后续任务流程尚未开放。')}</p></div>`;}
 function timerPanel(task){return `<h3>手动记录用时</h3><p class="small-copy">只记录你开启后的经过时间，不代表专注程度。休息、求助、停下或换任务时会暂停。</p><div class="timer-line"><strong id="elapsed-time"></strong>${task.timing.runningSince!==null?button('暂停计时','timer-pause','quiet'):button('开始计时','timer-start','quiet',task.started&&!task.stoppedOn&&state.view==='step'?'':'disabled')}</div>${!task.started||task.stoppedOn?'<p class="small-copy">开始或继续这一步后，可以自行计时。</p>':''}<p id="time-overrun" class="small-copy" hidden>比预计久一些也可以。继续、调整估计或休息，由你决定。</p>`;}
 function options(task){return `<div class="more-area">${button('计时、便签与作业详情','more','text-button',`aria-expanded="${ui.more}"`)}${ui.more?`<div class="option-tabs">${[['timer','用时记录'],['overview','作业全貌'],['note','接续便签']].map(([key,label])=>button(label,'option:'+key,'chip',`aria-pressed="${ui.option===key}"`)).join('')}</div>${ui.option?`<section id="option-panel" class="inline-panel">${ui.option==='timer'?timerPanel(task):ui.option==='overview'?overview(task):noteEditor(task)}</section>`:''}`:''}</div>`;}
 function restPanel(){const kind=state.support?.kind||'rest',linked=state.supportTask?M.currentStep(state,state.supportTask):null;
  const content={rest:['先停一会儿。','放下屏幕，看看远处。<br>这会儿不用做什么。'],walk:['让身体活动一下。','方便的话，起身走一小段。<br>不方便离开，也可以坐着轻轻舒展。'],mindful:['把注意力带回此刻。','不用清空思绪，也不要求立刻平静。']}[kind];
  const returnPlace=linked?`<p class="return-context">休息后接着做<b>${esc(linked.title)}</b></p>`:'<p class="small-copy rest-independent">这次只为自己休息，不需要先选作业。</p>';
  const activities=[['rest','安静休息'],['walk','走走 / 舒展'],['mindful','一分钟正念']].map(([k,label])=>button(label,'activity:'+k,'chip',`aria-pressed="${kind===k}"`)).join('');
  const mindful=kind==='mindful'?'<div class="mindful-lines"><p class="mindful-line">感觉脚底或身体与椅子的接触，睁着眼也可以。</p><p class="mindful-line">留意一次自然呼吸，或者身边的一个声音。</p><p class="mindful-line">发现走神，就轻轻回到刚才的感觉。不舒服时可以直接结束。</p></div>':'';
  return `<section class="rest-panel"><p class="kicker">休息中</p><h2 id="work-title" tabindex="-1">${content[0]}</h2><p class="rest-copy">${content[1]}</p>${returnPlace}${button(linked?'回到刚才这一步':'回到作业列表','return','primary')}<div class="rest-activities"><p class="choice-label">想换个休息方式？</p><div class="activity-choices" aria-label="休息方式">${activities}</div>${mindful}</div><p class="small-copy rest-foot">想多待一会儿也可以。<span id="break-time"></span></p></section>`;
 }
 function helpPanel(task){
  const step=M.currentStep(state,task.id),suggestion=M.suggestion(state,task.id,ui.reason);
  const reasons=[['smaller','拆小一步'],['unclear','没看懂'],['time','时间不多']].map(([reason,label])=>button(label,'reason:'+reason,'chip',`aria-pressed="${ui.reason===reason}"`)).join('');
  const choices=suggestion&&!task.helpAttempts?`<p class="choice-label">可以换一种帮助</p><div class="help-reasons" aria-label="换一种帮助">${reasons}</div>`:'';
  return `<section class="help-panel"><p class="kicker">卡住了</p><h2 id="work-title" tabindex="-1">${suggestion?'先试一个更小的动作':'换一种支持'}</h2><p class="original-step">刚才这步：${esc(step.title)}</p>${choices}<div class="suggestion" aria-live="polite"><h3>${suggestion?esc(suggestion.title):'带着这个问题，找人聊聊。'}</h3><p>${suggestion?esc(suggestion.detail):'已经试过几个起点。可以向老师或同学求助，也可以从上面的列表换件事。'}</p></div>${suggestion?button('开始这个小动作','adopt','primary'):button('先休息一下','rest','primary')}${button('收起建议，回到原步骤','return','text-button')}${button('今天先到这里','stop','text-button stop-link')}</section>`;
 }
 function pausedPanel(task){const saved=!!task.stoppedOn;return `<section class="stopped-panel"><p class="kicker">${saved?'位置已保存':'当前步骤已保留'}</p><h2 id="work-title" tabindex="-1">${saved?'下次，从这里继续。':'准备停下？'}</h2><p class="step-detail">${esc(M.currentStep(state,task.id).title)}</p><p class="small-copy">${saved?'作业还未完成，截止时间不变。':'还没有标记今天停下，可以继续，也可以先到这里。'}</p>${task.index===3&&!task.aux?'<p class="demo-boundary">三个示例动作已体验完。下一步和作业仍然保留。</p>':button('接着这一小步','begin','primary')}${!saved?button('今天先到这里','stop','quiet'):''}<div class="saved-note">${noteEditor(task)}</div></section>`;}
 function work(){const task=M.displayedTask(state),isRest=resting();
  if(!task&&!isRest)return `<section id="work-area" class="work-area empty-work"><h2 id="work-title" tabindex="-1">给今天一个小起点。</h2><p class="step-detail">加入一份示例作业，或先给自己一点空间。</p>${button('先休息一下','rest','quiet')}</section>`;
  const meta=task?M.CATALOG[task.id]:null,linked=isRest?state.supportTask:task?.id;
  const context=linked?(state.selected?'当前作业':'建议先做')+' · '+M.CATALOG[linked].short:'给自己一点空间';
  let content;
  if(isRest)content=restPanel();
  else if(state.view==='help')content=helpPanel(task);
  else if(task.stoppedOn||state.view==='pause')content=pausedPanel(task);
  else {const step=M.currentStep(state,task.id);content=`${task.note?`<p class="resume-note"><b>给自己的便签</b><span data-verbatim>${esc(task.note)}</span></p>`:''}${task.lastDone?`<p class="last-done">刚才已完成：${esc(task.lastDone)}</p>`:''}<p class="kicker">${step.continuation?'三个示例步骤已完成':(task.started?'进行中':'下一步')+' · '+(step.auxiliary?'辅助小动作':'示例步骤 '+(task.index+1)+'/3')}</p><h2 id="work-title" tabindex="-1">${esc(step.title)}</h2><p class="step-detail">${esc(step.detail)}</p>${step.continuation?'<div class="demo-boundary">三个示例动作已体验完。<br>这是后续的起点，不代表整份作业已经完成。</div>':estimate(task)+(task.started?'<p class="doing-hint">在作业里做完上面这件事，再回来标记。</p>':'')+button(task.started?'标记这一步完成':'开始这一小步 →',task.started?'finish':'begin','primary')}<div class="secondary-row">${button('卡住了','help')}${button('休息一下','rest')}</div>${button('今天先到这里','stop','text-button stop-link')}`;}
  return `<section id="work-area" class="work-area"><div id="work-context" class="work-context"><span>${esc(context)}</span>${!isRest&&state.tasks.length>1?button('换作业','choose-task','text-button'):''}</div>${ui.resumed?'<p class="resume-feedback" role="status">已回到休息前的位置。</p>':''}${!isRest&&meta&&state.date>meta.due?`<p class="deadline-warning">原截止时间 ${date(meta.due)} 23:59 已过，请查看课程的补交要求。</p>`:''}${content}${!isRest&&state.view!=='help'&&!(task.stoppedOn||state.view==='pause')?options(task):''}</section>`;
 }
 function render(focusSelector){
  // Former navigation routes are now the same work surface. Preserve the task
  // while making completion/timer intents valid after reload or a date change.
  if(state.selected&&['today','add','plan','overview'].includes(state.view))state=M.companion(state,{type:'RESUME_WORK'});
  persist();
  const shopFrom=document.body.dataset.petDemo?'tasks':'list';
  app.innerHTML=taskList()+work()+'<a class="task-shop-link" href="shop.html?from='+shopFrom+'">Lv.'+M.growth(state).level+' · 宠物商店 →</a>';
  document.getElementById('demo-date').textContent=state.date;document.getElementById('demo-date').dateTime=state.date;
  document.querySelector('[data-action="tomorrow"]').disabled=state.date>='2099-12-31';
  updateClocks();
  if(document.body.dataset.petDemo)window.dispatchEvent(new Event('one-step-change'));
  if(focusSelector){
   const target=document.querySelector(focusSelector);
   if(!target)return;
   target.focus({preventScroll:true});
   const area=target.closest('#work-area');
   if(focusSelector==='#work-title')area.scrollIntoView({block:'start'});
   else target.scrollIntoView({block:'nearest'});
   if(area&&(focusSelector==='#work-title'||target.closest('.help-reasons'))){
    // Localized text can wrap after render. Keep the instruction and its action in view together.
    requestAnimationFrame(()=>{
     if(!target.isConnected||target!==document.activeElement)return;
     const primary=area.querySelector('.primary'), pane=area.closest('.window-scroll');
     if(!primary)return;
     const top=pane?.getBoundingClientRect().top??document.querySelector('.mast')?.getBoundingClientRect().bottom??0;
     const bottom=pane?.getBoundingClientRect().bottom??innerHeight;
     const excess=primary.getBoundingClientRect().bottom-bottom+6;
     const room=target.getBoundingClientRect().top-top-4;
     if(excess>0&&room>0)(pane||window).scrollBy(0,Math.min(excess,room));
    });
   }
  }
 }
 function dispatch(type,extra={},focus='#work-title'){
  const before=M.growth(state);
  ui.resumed=type==='RESUME_WORK'&&resting()&&Boolean(state.supportTask);
  state=M.companion(state,{type,...extra});render(focus);
  if(type==='FINISH'){
   const after=M.growth(state), gain=after.xp-before.xp;
   if(gain>0)notify((after.level>before.level?'小伴升级到 Lv.'+after.level+' · ':'')+'+'+gain+' XP · +'+gain/5+' 爪币');
  }
 }
 function clearWorkOptions(){ui.more=false;ui.option=null;ui.estimate=false;ui.reason='smaller';}
 function updateClocks(){const task=M.displayedTask(state),elapsed=document.getElementById('elapsed-time');if(elapsed&&task){const seconds=Math.floor(M.elapsed(state,task.id)/1000);elapsed.textContent=`${Math.floor(seconds/60)} 分 ${String(seconds%60).padStart(2,'0')} 秒`;document.getElementById('time-overrun').hidden=seconds<=M.estimate(state,task.id)[1]*60;}
  const rest=document.getElementById('break-time');if(rest&&state.support){const mins=Math.floor(Math.max(0,Date.now()-state.support.startedAt)/60000);rest.textContent=mins>0?` 已休息 ${mins} 分钟。`:'';}
 }
 function setResetPrompt(open) {
  const prompt=document.getElementById('reset-confirm');
  prompt.hidden=!open;
  document.querySelector('[data-action="ask-reset"]').setAttribute('aria-expanded',String(open));
  if(open) prompt.querySelector('button').focus();
 }
 document.getElementById('demo-tools').addEventListener('toggle',event=>{
  if(!event.currentTarget.open)setResetPrompt(false);
 });
 app.addEventListener('input',event=>{if(event.target.id==='resume-note')drafts.set(M.displayedTask(state).id,event.target.value);});
 document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');
  if(!el||el.disabled){lastTaskAction='';return;}
  const action=el.dataset.action;
  // Touch browsers may count Pick followed by Start as a double-tap after the view scrolls.
  const startingSelection=action==='begin'&&lastTaskAction.startsWith('pick:')&&event.pointerType==='touch';
  if(event.detail>1&&!startingSelection)return;
  lastTaskAction=action;
  event.preventDefault();
  if(action.startsWith('pick:')){clearWorkOptions();dispatch('PICK',{id:action.slice(5)});return;}
  if(action.startsWith('capacity:')){ui.plan=false;dispatch('SET_CAPACITY',{capacity:Number(action.slice(9))},'[data-action="plan"]');return;}
  if(action.startsWith('reason:')){ui.reason=action.slice(7);render(`[data-action="${action}"]`);return;}
  if(action.startsWith('activity:')){dispatch('REST',{kind:action.slice(9)});return;}
  if(action.startsWith('range:')){ui.estimate=false;dispatch('ESTIMATE',{range:action.slice(6).split(',').map(Number)},'[data-action="estimate"]');return;}
  if(action.startsWith('option:')){ui.option=ui.option===action.slice(7)?null:action.slice(7);render(`[data-action="${action}"]`);return;}
  switch(action){
   case 'choose-task':{const heading=document.getElementById('today-title');heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});break;}
   case 'plan':ui.plan=!ui.plan;ui.add=false;render('[data-action="plan"]');break;
   case 'add':ui.add=!ui.add;ui.plan=false;render('[data-action="add"]');break;
   case 'confirm-add':ui.add=false;dispatch('ADD_SAMPLE',{},'[data-action="add"]');notify('论文示例已加入，任务按原截止时间排序。');break;
   case 'begin':clearWorkOptions();dispatch('START');break;
   case 'finish':clearWorkOptions();drafts.delete(state.selected);dispatch('FINISH');break;
   case 'help':clearWorkOptions();dispatch('ASSIST');break;
   case 'adopt':ui.estimate=false;dispatch('ADOPT_START',{reason:ui.reason});break;
   case 'rest':clearWorkOptions();dispatch('REST');break;
   case 'return':{const focus=resting()&&!state.supportTask?'#today-title':'#work-title';clearWorkOptions();dispatch('RESUME_WORK',{},focus);break;}
   case 'stop':clearWorkOptions();dispatch('STOP_HERE');break;
   case 'save-note':{const id=M.displayedTask(state).id,note=document.getElementById('resume-note').value;drafts.delete(id);dispatch('SAVE_NOTE',{note},'#resume-note');notify('便签已保存。');break;}
   case 'estimate':ui.estimate=!ui.estimate;render('[data-action="estimate"]');break;
   case 'more':ui.more=!ui.more;if(!ui.more)ui.option=null;render('[data-action="more"]');break;
   case 'timer-start':dispatch('TIMER_START',{},'[data-action="timer-pause"]');break;
   case 'timer-pause':dispatch('TIMER_PAUSE',{},'[data-action="timer-start"]');break;
   case 'tomorrow':clearWorkOptions();ui.plan=false;dispatch('ADVANCE',{},'#today-title');notify('已到第二天，进度和原截止时间都保留。');break;
   case 'overdue':clearWorkOptions();ui.plan=false;dispatch('OVERDUE',{},'#today-title');break;
   case 'ask-reset':setResetPrompt(true);break;
   case 'cancel-reset':setResetPrompt(false);el.closest('details').querySelector('[data-action="ask-reset"]').focus();break;
   case 'reset':setResetPrompt(false);clearWorkOptions();ui.plan=false;ui.add=false;drafts.clear();dispatch('RESET',{},'#today-title');notify('已恢复最初的两个示例。');break;
  }
 });
 if(document.body.dataset.petDemo)window.OneStepCompanion=Object.freeze({
  snapshot:()=>JSON.parse(JSON.stringify(state)),
  act(type){if(['START','FINISH','ASSIST','REST','RESUME_WORK','STOP_HERE'].includes(type))dispatch(type,{},null);}
 });
 window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  const saved=persistence.load();
  if (!saved.notice && JSON.stringify(saved.state)!==JSON.stringify(state)) {state=saved.state;render();}
 });
 render();setInterval(updateClocks,1000);document.addEventListener('visibilitychange',updateClocks);
})();
