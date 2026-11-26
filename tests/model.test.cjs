const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/model.js');
const act = (s, type, extra = {}) => M.transition(s, { type, ...extra });
const paper = () => act(M.initialState(), 'ADD_PAPER');
const opened = () => act(paper(), 'OPEN', { id: 'paper' });
const use = (s,type,extra={}) => M.companion(s,{type,...extra});
test('changing rest content preserves the same break clock and origin',()=>{
  let s=use(use(M.initialState(),'START'),'REST',{now:1000});
  s=use(s,'REST',{kind:'walk',now:121000});assert.equal(s.support.startedAt,1000);assert.equal(s.supportTask,'stats');
  s=use(s,'REST',{kind:'walk',now:181000});assert.equal(s.support.startedAt,1000);
  s=use(use(s,'RESUME_WORK'),'REST',{now:241000});assert.equal(s.support.startedAt,241000);
});
test('single-page preview stays unselected until start; rest is independent',()=>{
  let s=M.initialState();assert.equal(M.displayedTask(s).id,'stats');
  s=use(s,'REST',{now:1000});assert.equal(s.selected,null);assert.equal(s.supportTask,null);assert.equal(s.view,'activity');
  s=use(s,'RESUME_WORK');assert.equal(s.selected,null);
  s=use(s,'START');assert.equal(s.selected,'stats');assert.equal(s.tasks[0].started,true);
});
test('single-page assistance adopts and starts in one action; no extra completion',()=>{
  let s=use(M.initialState(),'ASSIST');assert.equal(s.view,'help');
  s=use(s,'ADOPT_START',{reason:'smaller'});
  assert.equal(s.tasks[0].started,true);assert.equal(s.tasks[0].aux,'smaller');assert.equal(s.tasks[0].index,0);
  s=use(s,'FINISH');assert.equal(s.tasks[0].index,0);assert.equal(s.tasks[0].aux,null);
});
test('stopping is immediate, saving notes and selecting never resume work',()=>{
  let s=use(use(M.initialState(),'START'),'TIMER_START',{now:1000});
  s=use(s,'STOP_HERE',{now:61000});assert.equal(s.view,'pause');assert.equal(s.selected,'stats');
  assert.equal(M.elapsed(s,'stats',200000),60000);
  s=use(s,'SAVE_NOTE',{note:'下次从这里继续'});assert.equal(s.tasks[0].note,'下次从这里继续');
  s=use(s,'PICK',{id:'reading'});s=use(s,'PICK',{id:'stats'});
  assert.equal(s.tasks[0].stoppedOn,s.date);
  assert.equal(use(s,'TIMER_START',{now:200000}).tasks[0].timing.runningSince,null);
  s=use(s,'START');assert.equal(s.tasks[0].stoppedOn,null);assert.equal(s.tasks[0].index,0);
});
test('capacity and adding sample preserve current task and valid running timer on reload',()=>{
  let s=use(use(M.initialState(),'START'),'TIMER_START',{now:1000});
  s=use(s,'SET_CAPACITY',{capacity:30});s=use(s,'ADD_SAMPLE');
  assert.equal(s.selected,'stats');assert.equal(M.recommendation(s).id,'paper');
  const loaded=M.createPersistence(()=>memory(JSON.stringify(s))).load();
  assert.equal(loaded.notice,'');assert.equal(loaded.state.tasks[0].timing.runningSince,1000);
});
test('legacy help, stop and rest modes restore progress for inline rendering',()=>{
  for(const view of ['step','help','overview','pause','support','activity','recover']){
    const old=opened();old.view=view;old.tasks.find(t=>t.id==='paper').note='之前的便签';
    if(['activity','recover'].includes(view)){old.support={kind:'mindful',stage:2,startedAt:1000};old.supportTask='paper';}
    const loaded=M.createPersistence(()=>memory(JSON.stringify(old))).load();
    assert.equal(loaded.notice,'');assert.equal(loaded.state.view,view);assert.equal(loaded.state.selected,'paper');
    assert.equal(loaded.state.tasks.find(t=>t.id==='paper').note,'之前的便签');
  }
});
test('daily advice fits capacity, excludes excess work and preserves deadlines',()=>{
  for(const capacity of [15,30,60]){
    let s=act(paper(),'PLAN_SAVE',{capacity});
    const plan=M.dailyAdvice(s);
    assert(plan.blocks.length>=1&&plan.blocks.length<=2);
    assert.equal(plan.blocks[0].id,'paper');
    assert.equal(plan.blocks.reduce((n,b)=>n+b.minutes,0)+plan.buffer+plan.free,capacity);
    assert.equal(plan.excluded.length,3-plan.blocks.length);
    assert.equal(M.CATALOG.paper.due,'2026-11-03');
    assert.equal(M.dailyAdvice(act(s,'ADVANCE')),null);
    assert.deepEqual(act(s,'PLAN_SAVE',{capacity:17}),s);
  }
});
test('stopping preserves a note and excludes today work until explicitly reopened',()=>{
  let s=act(act(opened(),'BEGIN'),'TIMER_START',{now:1000});
  s=act(s,'PAUSE_PAGE',{now:61000});
  assert.equal(M.elapsed(s,'paper',100000),60000);
  s=act(s,'STOP',{note:'从第二句继续'});
  s=act(s,'PLAN_SAVE',{capacity:30});
  assert(!M.dailyAdvice(s).blocks.some(b=>b.id==='paper'));
  let restored=M.createPersistence(()=>memory(JSON.stringify(s))).load().state;
  assert.equal(restored.tasks.find(t=>t.id==='paper').note,'从第二句继续');
  restored=act(restored,'OPEN',{id:'paper'});
  assert(M.dailyAdvice(restored).blocks.some(b=>b.id==='paper'));
  assert.equal(restored.tasks.find(t=>t.id==='paper').index,0);
});
test('repeated help changes strategy and is bounded without advancing the original',()=>{
  let s=opened();const seen=new Set();
  for(let i=0;i<3;i++){
    const proposed=M.suggestion(s,'paper','smaller');seen.add(proposed.title);
    s=act(s,'ADOPT',{reason:'smaller'});
    assert.equal(M.currentStep(s,'paper').title,proposed.title);
    s=act(act(s,'BEGIN'),'FINISH');
    assert.equal(s.tasks.find(t=>t.id==='paper').index,0);
  }
  assert.equal(seen.size,3);
  assert.equal(M.suggestion(s,'paper','smaller'),null);
  assert.equal(s.tasks.find(t=>t.id==='paper').lastDone.length>0,true);
});
test('known completed reading title is not requested again after assistance',()=>{
  let s=act(M.initialState(),'OPEN',{id:'reading'});
  s=act(act(s,'BEGIN'),'FINISH');
  s=act(s,'ADOPT',{reason:'smaller'});
  assert.match(M.currentStep(s,'reading').title,/标题/);
  s=act(act(s,'BEGIN'),'FINISH');
  assert.equal(s.tasks.find(t=>t.id==='reading').index,1);
  assert.match(M.currentStep(s,'reading').title,/摘要/);
  assert.doesNotMatch(M.currentStep(s,'reading').title,/标题/);
});
test('independent rest works without tasks and does not silently select work',()=>{
  for(const tasks of [[],M.initialState().tasks]){
    let s={...M.initialState(),tasks};
    s=act(s,'SUPPORT');assert.equal(s.view,'support');assert.equal(s.selected,null);
    s=act(s,'ACTIVITY',{kind:'rest',now:1000});
    const loaded=M.createPersistence(()=>memory(JSON.stringify(s))).load();
    assert.equal(loaded.notice,'');s=loaded.state;
    s=act(act(s,'BREAK_DONE'),'RETURN_STEP');
    assert.equal(s.view,'today');assert.equal(s.selected,null);
  }
});
test('support from today keeps old selection separate from a task-bound break',()=>{
  let s=act(opened(),'TODAY');
  s=act(s,'SUPPORT');assert.equal(s.supportTask,null);
  s=act(s,'RETURN_STEP');assert.equal(s.view,'today');
  s=act(s,'OPEN',{id:'paper'});s=act(s,'SUPPORT');
  assert.equal(s.supportTask,'paper');
  s=act(s,'RETURN_STEP');assert.equal(s.view,'step');
});
test('estimates are per action, adjustable, and independent across tasks', () => {
  let s=opened();
  assert.deepEqual(M.estimate(s,'paper'),[2,4]);
  s=act(s,'ESTIMATE',{range:[5,10]});
  assert.deepEqual(M.estimate(s,'paper'),[5,10]);
  assert.deepEqual(M.estimate(s,'reading'),[2,4]);
  s=act(s,'ADOPT',{reason:'smaller'});
  assert.deepEqual(M.estimate(s,'paper'),[1,2]);
  const unchanged=act(s,'ESTIMATE',{range:[-1,Infinity]});
  assert.deepEqual(unchanged,s);
});
test('timing excludes breaks and navigation, and never advances a task', () => {
  let s=act(opened(),'BEGIN');
  s=act(s,'TIMER_START',{now:1000});
  assert.equal(M.elapsed(s,'paper',61000),60000);
  s=act(s,'SUPPORT',{now:61000});
  s=act(s,'ACTIVITY',{kind:'mindful',now:61000});
  s=act(s,'BREAK_DONE',{now:181000});
  s=act(s,'RETURN_STEP',{now:181000});
  assert.equal(M.elapsed(s,'paper',181000),60000);
  assert.equal(s.tasks.find(t=>t.id==='paper').index,0);
  assert.equal(s.tasks.find(t=>t.id==='paper').started,true);
  s=act(s,'TIMER_START',{now:181000});
  s=act(s,'OPEN',{id:'reading',now:241000});
  assert.equal(M.elapsed(s,'paper',999000),120000);
  assert.equal(M.elapsed(s,'reading',999000),0);
});
test('support survives reload without completing auxiliary; changing activity resets guidance',()=>{
  let s=act(opened(),'ADOPT',{reason:'smaller'});
  s=act(s,'SUPPORT',{now:1000});
  s=act(s,'ACTIVITY',{kind:'mindful',now:1000});
  s=act(s,'BREAK_NEXT');
  const p=M.createPersistence(()=>memory(JSON.stringify(s)));
  assert.equal(p.load().state.support.stage,1);
  s=act(s,'ACTIVITY',{kind:'walk',now:9000});
  assert.equal(s.support.stage,0);
  s=act(act(s,'BREAK_DONE'),'RETURN_STEP');
  assert.equal(s.tasks.find(t=>t.id==='paper').aux,'smaller');
  assert.equal(s.tasks.find(t=>t.id==='paper').index,0);
});
test('timer hides by pausing and reset clears all timing/support',()=>{
  let s=act(act(opened(),'BEGIN'),'TIMER_START',{now:1000});
  s=act(s,'TIMER_HIDE',{now:61000});
  assert.equal(M.elapsed(s,'paper',900000),60000);
  assert.equal(s.tasks.find(t=>t.id==='paper').timing.visible,false);
  s=act(s,'RESET');
  assert.equal(s.support,null);
  assert.equal(M.elapsed(s,'stats',900000),0);
});
test('old storage migrates without losing progress and invalid new fields recover',()=>{
  const old=opened();delete old.support;
  old.tasks.forEach(t=>{delete t.timing;delete t.estimate;});
  old.tasks[0].index=1;
  const p=M.createPersistence(()=>memory(JSON.stringify(old)));
  const loaded=p.load();
  assert.equal(loaded.notice,'');
  assert.equal(loaded.state.tasks[0].index,1);
  assert.equal(M.elapsed(loaded.state,'stats',1000),0);
  for(const change of [s=>s.tasks[0].timing={elapsedMs:-1,runningSince:null,visible:true},
    s=>s.support={kind:'injected',stage:0,startedAt:1},
    s=>s.tasks[0].estimate=[4,2]]){
    const invalid=opened();change(invalid);
    assert.ok(M.createPersistence(()=>memory(JSON.stringify(invalid))).load().notice);
  }
});
function memory(raw) {
  const values = new Map([['unrelated', 'keep']]);
  if (raw !== undefined) values.set(M.STORAGE_KEY, raw);
  return { values, getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
}
test('adding paper changes recommendation without duplicating it', () => {
  const initial = M.initialState();
  assert.deepEqual(M.orderedTasks(initial).map(t => t.id), ['stats', 'reading']);
  const state = act(act(initial, 'ADD_PAPER'), 'ADD_PAPER');
  assert.deepEqual(M.orderedTasks(state).map(t => t.id), ['paper', 'stats', 'reading']);
  assert.equal(initial.tasks.length, 2);
});
test('unstarted and repeated completion cannot skip steps', () => {
  let s = opened();
  s = act(s, 'FINISH'); assert.equal(s.tasks.find(t => t.id === 'paper').index, 0);
  s = act(act(s, 'BEGIN'), 'FINISH'); s = act(s, 'FINISH');
  assert.equal(s.tasks.find(t => t.id === 'paper').index, 1);
});
test('auxiliary completion restores original step rather than skipping it', () => {
  let s = act(opened(), 'ADOPT', { reason: 'smaller' });
  assert.match(M.currentStep(s, 'paper').title, /入口/);
  s = act(act(s, 'BEGIN'), 'FINISH');
  assert.equal(s.tasks.find(t => t.id === 'paper').index, 0);
  assert.match(M.currentStep(s, 'paper').title, /作业要求/);
});
test('replacing help does not nest auxiliaries or erase another task', () => {
  let s = act(opened(), 'ADOPT', { reason: 'smaller' });
  s = act(s, 'ADOPT', { reason: 'time' });
  s = act(s, 'OPEN', { id: 'reading' });
  s = act(act(s, 'BEGIN'), 'FINISH');
  s = act(s, 'OPEN', { id: 'paper' });
  assert.equal(s.tasks.find(t => t.id === 'paper').aux, 'time');
  assert.equal(s.tasks.find(t => t.id === 'reading').index, 1);
});
test('three demo steps retain an unfinished, non-completable continuation', () => {
  let s = opened();
  for (let i=0;i<3;i++) s=act(act(s,'BEGIN'),'FINISH');
  assert.equal(M.currentStep(s,'paper').continuation,true);
  assert.equal(M.orderedTasks(s)[0].id,'paper');
  s=act(act(s,'BEGIN'),'FINISH');
  assert.equal(s.tasks.find(t=>t.id==='paper').index,3);
});
test('day changes preserve original deadlines and independent progress', () => {
  let s=act(opened(),'ADOPT',{reason:'smaller'});
  s=act(act(s,'BEGIN'),'ADVANCE');
  assert.equal(s.date,'2026-11-02');
  assert.equal(s.tasks.find(t=>t.id==='paper').started,true);
  assert.equal(M.deadlineLabel(s,'paper'),'明天截止');
  s=act(s,'OVERDUE');
  assert.equal(M.deadlineLabel(s,'paper'),'已逾期 2 天');
  assert.equal(M.orderedTasks(s)[0].due,'2026-11-03');
  s.date='2026-11-30';
  assert.equal(act(s,'ADVANCE').date,'2026-12-01');
});
test('help remains relevant to all tasks and all original actions', () => {
  let s=paper();
  for(const id of ['paper','stats','reading']){
    s=act(s,'OPEN',{id});
    for(let i=0;i<4;i++){
      for(const reason of ['smaller','unclear','time']){
        const suggestion=M.suggestion(s,id,reason);
        assert.ok(suggestion.title.length>3);
        if(id!=='paper') assert.doesNotMatch(suggestion.title,/课程平台|论文/);
      }
      s=act(act(s,'BEGIN'),'FINISH');
    }
  }
});
test('reload roundtrips active auxiliary and date; reset keeps other storage', () => {
  const store=memory(),p=M.createPersistence(()=>store);
  let s=act(act(opened(),'ADOPT',{reason:'smaller'}),'BEGIN');
  s=act(s,'ADVANCE');p.save(s);
  assert.deepEqual(p.load().state,s);
  p.save(act(s,'RESET'));
  assert.equal(store.values.get('unrelated'),'keep');
  assert.deepEqual(p.load().state.tasks.map(t=>t.id),['stats','reading']);
});
test('corrupt and wrong-shape state recover to a usable default', () => {
  const bad=['{', 'null', '[]', JSON.stringify({...opened(),date:'2026-02-30'}),
    JSON.stringify({...opened(),tasks:[{id:'unknown',index:0,aux:null,started:false,touched:false}]}),
    JSON.stringify({...opened(),tasks:[{id:'paper',index:4,aux:null,started:false,touched:false}]}),
    JSON.stringify({...opened(),tasks:[{id:'paper',index:0,aux:{},started:false,touched:false}]}),
    JSON.stringify({...opened(),selected:'__proto__'})];
  for(const raw of bad){
    const result=M.createPersistence(()=>memory(raw)).load();
    assert.deepEqual(result.state.tasks.map(t=>t.id),['stats','reading']);
    assert.ok(result.notice);
  }
});
test('unavailable reads or writes degrade to memory with a visible notice', () => {
  const p=M.createPersistence(()=>{throw Error('blocked');});
  assert.equal(p.load().mode,'memory');
  assert.ok(p.save(paper()).notice);
  const q=M.createPersistence(()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}}));
  q.load();assert.equal(q.save(paper()).mode,'memory');
});
test('unknown actions and ids cannot inject new tasks or change selection', () => {
  const s=opened();
  assert.deepEqual(act(s,'OPEN',{id:'__proto__'}),s);
  assert.deepEqual(act(s,'ADOPT',{reason:'unknown'}),s);
  assert.deepEqual(act(s,'ANYTHING'),s);
});
test('valid empty task state supports an empty list instead of corruption', () => {
  const s={...M.initialState(),tasks:[],selected:null};
  const p=M.createPersistence(()=>memory(JSON.stringify(s)));
  assert.deepEqual(M.orderedTasks(p.load().state),[]);
  assert.equal(p.load().notice,'');
});
test('coercible or duplicate restored ids recover instead of creating unopenable tasks', () => {
  const entry = id => ({id,index:0,aux:null,started:false,touched:false});
  for(const tasks of [[entry(['stats'])],[entry([['reading']])],[entry('stats'),entry('stats')]]){
    const raw=JSON.stringify({...M.initialState(),tasks});
    const loaded=M.createPersistence(()=>memory(raw)).load();
    assert.ok(loaded.notice,'malformed task IDs must trigger visible recovery');
    const state=act(loaded.state,'OPEN',{id:'stats'});
    assert.equal(state.view,'step');
  }
});
