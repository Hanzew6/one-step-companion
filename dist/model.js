(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OneStep = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'one-step-fixed-demo-v1';
  const REASONS = ['smaller', 'unclear', 'time'];
  const CATALOG = {
    paper: {
      id: 'paper', title: '1500 字课程论文', short: '课程论文', course: '教育心理学', due: '2026-11-03', icon: 'paper',
      steps: [
        ['打开课程平台，找到作业要求。', '现在只要找到那份说明，不用开始写论文。'],
        ['找到题目里需要回答的问题。', '读一遍要求，把最关键的那一句单独记下来。'],
        ['写下一句你对这个问题的想法。', '先保留一个粗略的想法，不用写得完整。'],
        ['开始写第一段草稿。', '从刚才那句话往下写。你已经有了一个起点。']
      ],
      help: {
        smaller: ['找到课程平台的入口。', '打开作业要求的第一段。', '新建一份空白笔记。', '打开保存初步想法的文档。'],
        unclear: ['看看课程通知中哪条提到了这份作业。', '圈出题目里最不明白的一句话。', '标出题目里你最熟悉的一个词。', '在已有想法旁标出不确定的地方。'],
        time: ['只找到课程平台的入口，先不读要求。', '只读作业要求的第一句话。', '先记下一个关键词。', '只读一遍已经写下的那句话。']
      }
    },
    stats: {
      id: 'stats', title: '完成统计学练习', short: '统计学练习', course: '统计学基础', due: '2026-11-04', icon: 'stats',
      steps: [
        ['打开练习，找到第一道题。', '先看这一题，不用浏览整份练习。'],
        ['读题，圈出已经给出的条件。', '先把知道的内容记下来，不急着求解。'],
        ['选一个可能用到的公式。', '对照课程笔记，找一找有类似条件的例题。'],
        ['尝试计算第一步。', '先代入一个已知条件，不必一次解出整道题。']
      ],
      help: {
        smaller: ['找到练习文件。', '只读第一道题的第一句话。', '打开统计学课程笔记。', '把准备使用的公式写下来。'],
        unclear: ['看看文件名和课程通知，确认是哪份练习。', '圈出题目中不明白的一个符号。', '标出例题里与你这道题不同的条件。', '在公式里标出还不知道的量。'],
        time: ['只找到练习文件，暂时不用解题。', '先记下题目给出的一个数值。', '只找到一页有关的课程笔记。', '只抄下一个已知条件。']
      }
    },
    reading: {
      id: 'reading', title: '阅读课程文章', short: '课程阅读', course: '学习科学导论', due: '2026-11-06', icon: 'reading',
      steps: [
        ['找到这次要读的文章。', '打开文件，先停在第一页。'],
        ['读标题和摘要的第一段。', '只读这一段，不用一次读完。'],
        ['用一句话记下这段在说什么。', '用自己的话记下来就可以。'],
        ['继续读下一段。', '带着刚才记下的理解，再往下看一点。']
      ],
      help: {
        smaller: ['打开课程阅读清单。', '先读文章的标题。', '打开一份空白阅读笔记。', '找到上次读到的段落。'],
        unclear: ['在阅读清单中找到本周的文章名称。', '标出摘要里不认识的一个词。', '圈出这段里你最能理解的一句话。', '标出下一段里让你困惑的一句话。'],
        time: ['只找到文章文件，暂时不开始读。', '只读摘要的第一句话。', '先记下一个关键词。', '先读下一段的第一句话。']
      }
    }
  };
  const RANGES = [[1,2],[2,4],[5,10],[10,15]];
  const ACTIVITIES = ['mindful','walk','rest'];
  const freshTiming = () => ({ elapsedMs: 0, runningSince: null, visible: false });
  const continuity = () => ({note:'',stoppedOn:null,lastDone:'',remainder:null,helpAttempts:0,auxLevel:0});
  const entry = id => ({ id, index: 0, aux: null, started: false, touched: false, estimate: null, timing: freshTiming(), ...continuity() });
  const validRange = range => Array.isArray(range) && range.length === 2 && RANGES.some(r=>r[0]===range[0]&&r[1]===range[1]);
  const validTime = value => Number.isSafeInteger(value) && value >= 0;
  const LEVEL_XP = [0,10,30,60,90];
  function creditsFor(state) {
    const credits = {};
    for (const id of Object.keys(CATALOG)) {
      const saved = state.petCredits?.[id];
      const fromSteps = (state.tasks.find(task => task.id === id)?.index || 0) * 10;
      credits[id] = Math.max(fromSteps, Number.isInteger(saved) && saved >= 0 && saved <= 30 && saved % 5 === 0 ? saved : 0);
    }
    return credits;
  }
  function growth(state) {
    const xp = Object.values(creditsFor(state)).reduce((total,value)=>total+value,0);
    const level = LEVEL_XP.filter(threshold=>xp>=threshold).length;
    return {xp,level,earned:xp/5,next:LEVEL_XP[level] ?? null};
  }
  const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value>='2026-11-01' && value<='2099-12-31' && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  function estimate(state, id) {
    const task=state.tasks.find(t=>t.id===id);
    if(!task) return [2,4];
    return task.estimate || (task.aux ? [1,2] : [[2,4],[2,4],[5,10],[10,15]][task.index]);
  }
  // Time is manually tracked elapsed time, never proof of attention or completion.
  function elapsed(state, id, now=Date.now()) {
    const timing=state.tasks.find(t=>t.id===id)?.timing;
    if(!timing) return 0;
    return timing.elapsedMs + (timing.runningSince===null ? 0 : Math.max(0,now-timing.runningSince));
  }
  function pauseTiming(task, now) {
    if(task.timing.runningSince!==null) task.timing.elapsedMs += Math.max(0,now-task.timing.runningSince);
    task.timing.runningSince=null;
  }
  function initialState() {
    return { version: 1, date: '2026-11-01', tasks: [entry('stats'), entry('reading')], selected: null, view: 'today', support: null, supportTask:null, dailyPlan:null, petCredits:{paper:0,stats:0,reading:0} };
  }
  function orderedTasks(state) {
    return state.tasks.map((task, order) => ({ ...CATALOG[task.id], ...task, order }))
      .sort((a, b) => a.due.localeCompare(b.due) || a.order - b.order);
  }
  function dailyAdvice(state) {
    const plan=state.dailyPlan;
    if(!plan || plan.date!==state.date) return null;
    const budgets={15:[10],30:[15,10],60:[25,25]}[plan.capacity];
    const ordered=orderedTasks(state),eligible=ordered.filter(t=>t.index<3&&t.stoppedOn!==state.date);
    const blocks=eligible.slice(0,budgets.length).map((t,i)=>({id:t.id,minutes:budgets[i]}));
    const buffer=plan.capacity===60?10:5;
    return {capacity:plan.capacity,blocks,buffer,free:plan.capacity-buffer-blocks.reduce((n,b)=>n+b.minutes,0),
      excluded:ordered.filter(t=>!blocks.some(b=>b.id===t.id)).map(t=>({id:t.id,reason:t.stoppedOn===state.date?'今天已停下':t.index===3?'已到示例边界':'留到之后再安排'}))};
  }
  function recommendation(state) {
    return orderedTasks(state).find(t=>t.index<3&&t.stoppedOn!==state.date) || null;
  }
  function displayedTask(state) {
    return state.tasks.find(t=>t.id===state.selected) || recommendation(state) || orderedTasks(state)[0] || null;
  }
  // Single-page intents compose the existing state transitions atomically.
  // A recommended preview is not a selected or started task.
  function companion(state, action) {
    const now=validTime(action.now)?action.now:Date.now();
    const step=(s,type,extra={})=>transition(s,{type,now,...extra});
    const bind=s=>s.selected?s:displayedTask(s)?step(s,'OPEN',{id:displayedTask(s).id}):s;
    switch(action.type){
      case 'PICK': {
        const old=state.tasks.find(t=>t.id===action.id);if(!old)return state;
        const s=step(state,'OPEN',{id:action.id});
        s.tasks.find(t=>t.id===action.id).stoppedOn=old.stoppedOn;
        return s;
      }
      case 'START': {
        let s=bind(state);const task=s.tasks.find(t=>t.id===s.selected);
        if(!task || (task.index===3&&!task.aux))return state;
        s=step(s,'OPEN',{id:s.selected});return step(s,'BEGIN');
      }
      case 'ASSIST':return step(bind(state),'HELP');
      case 'ADOPT_START': {
        const s=bind(state);if(!suggestion(s,s.selected,action.reason))return state;
        return step(step(s,'ADOPT',{reason:action.reason}),'BEGIN');
      }
      case 'REST': {
        const continuing=['support','activity','recover'].includes(state.view);
        const origin=continuing?state.supportTask:state.selected;
        const s=step(state,'SUPPORT');s.supportTask=origin||null;
        const next=step(s,'ACTIVITY',{kind:action.kind||'rest'});
        if(continuing&&state.support&&next.support)next.support.startedAt=state.support.startedAt;
        return next;
      }
      case 'RESUME_WORK':
        if(['support','activity','recover'].includes(state.view))return step(state,'RETURN_STEP');
        return {...state,view:state.selected?'step':'today'};
      case 'STOP_HERE': {
        const s=bind(state),task=s.tasks.find(t=>t.id===s.selected);if(!task)return state;
        return {...step(s,'STOP',{note:task.note}),view:'pause'};
      }
      case 'SAVE_NOTE': {
        if(typeof action.note!=='string')return state;
        const s=bind(state);return {...s,tasks:s.tasks.map(t=>t.id===s.selected?{...t,note:action.note.trim().slice(0,160)}:t)};
      }
      case 'SET_CAPACITY':return {...step(state,'PLAN_SAVE',{capacity:action.capacity}),view:state.view};
      case 'ADD_SAMPLE':return {...step(state,'ADD_PAPER'),view:state.view};
      case 'ESTIMATE':case 'TIMER_SHOW':return step(bind(state),action.type,action);
      case 'TIMER_START':
        if(state.tasks.find(t=>t.id===state.selected)?.stoppedOn)return state;
        return step(state,'TIMER_START');
      default:return transition(state,action);
    }
  }
  function suggestion(state, id, reason, appliedLevel) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || !REASONS.includes(reason)) return null;
    const level=appliedLevel ?? task.helpAttempts ?? 0;
    if(level>=3) return null;
    if(level===1) return {title:'在当前材料中，标出一句让你卡住的话。',detail:'换一种办法：如果找不到材料，就写下你缺少什么。先明确障碍，不必解决它。',auxiliary:true,continuation:false};
    if(level===2) return {title:'把刚才的困难写成一句求助问题。',detail:'例如：“我已经找到这份材料，但不确定接下来要做什么。”可以带给老师或同学，也可以先停下。',auxiliary:true,continuation:false};
    const detail = {
      smaller: '先做到这里就可以，之后再接回原来的步骤。',
      unclear: '先找到具体不清楚的地方。需要解释时，可以带着这句话向老师或同学求助。',
      time: '这次只尝试一个小动作。时间到了可以暂停，位置会保留。'
    }[reason];
    return { title: CATALOG[id].help[reason][task.index], detail, auxiliary: true, continuation: false };
  }
  function currentStep(state, id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return null;
    if (task.aux) return suggestion(state, id, task.aux,task.auxLevel || 0);
    const [title, detail] = CATALOG[id].steps[task.index];
    return { title:task.remainder || title, detail, auxiliary: false, continuation: task.index === 3 };
  }
  function deadlineLabel(state, id) {
    const days = Math.round((Date.parse(CATALOG[id].due + 'T12:00:00Z') - Date.parse(state.date + 'T12:00:00Z')) / 86400000);
    if (days < 0) return '已逾期 ' + -days + ' 天';
    if (days === 0) return '今天截止';
    if (days === 1) return '明天截止';
    const [, m, d] = CATALOG[id].due.split('-');
    return Number(m) + ' 月 ' + Number(d) + ' 日截止';
  }
  function transition(state, action) {
    if (action.type === 'RESET') return {...initialState(),petCredits:creditsFor(state)};
    const now=validTime(action.now) ? action.now : Date.now();
    const s = { ...state, support: state.support ? {...state.support} : null,
      tasks: state.tasks.map(t => ({ ...continuity(), ...t, timing: {...(t.timing || freshTiming())} })) };
    let task = s.tasks.find(t => t.id === s.selected);
    if(['OPEN','TODAY','ADD_PAGE','HELP','SUPPORT','ADVANCE','OVERDUE','PLAN_PAGE','PAUSE_PAGE','OVERVIEW','STOP'].includes(action.type)) {
      s.tasks.forEach(t=>pauseTiming(t,now));
      s.support=null;
    }
    switch (action.type) {
      case 'ESTIMATE':
        if(!task || !validRange(action.range)) return state;
        task.estimate=[...action.range]; break;
      case 'TIMER_SHOW': if(!task) return state; task.timing.visible=true; break;
      case 'TIMER_START':
        if(!task || !task.started || s.view!=='step') return state;
        task.timing.visible=true;
        if(task.timing.runningSince===null) task.timing.runningSince=now;
        break;
      case 'TIMER_PAUSE':
      case 'TIMER_HIDE':
        if(!task) return state;
        pauseTiming(task,now);
        if(action.type==='TIMER_HIDE') task.timing.visible=false;
        break;
      case 'PLAN_PAGE': s.view='plan'; break;
      case 'PLAN_SAVE':
        if(![15,30,60].includes(action.capacity)) return state;
        s.dailyPlan={date:s.date,capacity:action.capacity};s.view='today';break;
      case 'OVERVIEW': if(!task) return state;s.view='overview';break;
      case 'PAUSE_PAGE': if(!task) return state;s.view='pause';break;
      case 'STOP':
        if(!task || typeof action.note!=='string') return state;
        task.note=action.note.trim().slice(0,160);task.stoppedOn=s.date;task.touched=true;
        s.view='today';s.supportTask=null;break;
      case 'SUPPORT':
        if(!['support','activity','recover'].includes(state.view)) s.supportTask=['step','help','overview','pause'].includes(state.view)?s.selected:null;
        s.view='support'; break;
      case 'ACTIVITY':
        if(!ACTIVITIES.includes(action.kind) || !['support','activity','recover'].includes(s.view)) return state;
        s.support={kind:action.kind,stage:0,startedAt:now}; s.view='activity'; break;
      case 'BREAK_NEXT':
        if(s.view!=='activity' || s.support?.kind!=='mindful') return state;
        s.support.stage=Math.min(2,s.support.stage+1); break;
      case 'BREAK_DONE':
        if(s.view!=='activity') return state;
        s.view='recover'; break;
      case 'RETURN_STEP':
        s.support=null; s.view=s.supportTask?'step':'today';
        if(s.supportTask) s.selected=s.supportTask;
        s.supportTask=null;break;
      case 'OPEN':
        if (!s.tasks.some(t => t.id === action.id)) return state;
        s.selected = action.id; s.view = 'step';
        s.tasks.find(t=>t.id===action.id).stoppedOn=null; s.supportTask=null;break;
      case 'TODAY': s.view = 'today'; break;
      case 'ADD_PAGE': s.view = 'add'; break;
      case 'ADD_PAPER':
        if (!s.tasks.some(t => t.id === 'paper')) s.tasks.push(entry('paper'));
        s.view = 'today'; break;
      case 'HELP': if (!task) return state; s.view = 'help'; break;
      case 'ADOPT':
        if (!task || !REASONS.includes(action.reason) || task.helpAttempts>=3) return state;
        task.auxLevel=task.helpAttempts;task.helpAttempts++;
        task.aux = action.reason; task.started = false; task.touched = true;
        task.timing=freshTiming(); task.estimate=null; s.support=null; s.view = 'step'; break;
      case 'BEGIN':
        if (!task || (task.index === 3 && !task.aux)) return state;
        task.started = true; task.touched = true; break;
      case 'FINISH':
        if (!task || !task.started || s.view!=='step') return state;
        s.petCredits=creditsFor(state);
        s.petCredits[task.id]=Math.max(s.petCredits[task.id],Math.min(30,task.index*10+(task.aux?5:10)));
        task.lastDone=currentStep(s,task.id).title;task.note='';
        if (task.aux) {
          if(task.auxLevel===0 && task.index===0 && ['smaller','time'].includes(task.aux))
            task.remainder={paper:'进入课程页面，找到作业要求。',stats:'打开已找到的练习，定位第一道题。',reading:task.aux==='time'?'打开已找到的文章，停在第一页。':'在阅读清单中找到文章，打开第一页。'}[task.id];
          if(task.auxLevel===0 && task.id==='reading' && task.index===1 && task.aux==='smaller')
            task.remainder='接着读摘要的第一段。';
          task.aux = null;
        }
        else if (task.index < 3) {task.index++;task.remainder=null;task.helpAttempts=0;task.auxLevel=0;}
        task.started = false; task.touched = true; task.timing=freshTiming(); task.estimate=null; break;
      case 'ADVANCE': {
        if (s.date >= '2099-12-31') return state;
        const next = new Date(s.date + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
        s.date = next.toISOString().slice(0, 10); s.view = 'today'; break;
      }
      case 'OVERDUE': s.date = '2026-11-05'; s.view = 'today'; break;
      default: return state;
    }
    return s;
  }
  function validState(s) {
    if (!s || typeof s !== 'object' || s.version !== 1 || typeof s.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || s.date < '2026-11-01' || s.date > '2099-12-31') return false;
    const date = new Date(s.date + 'T12:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== s.date) return false;
    if (!Array.isArray(s.tasks) || s.tasks.length > 3 || !['today', 'step', 'add', 'help','support','activity','recover','plan','pause','overview'].includes(s.view)) return false;
    if(s.dailyPlan!=null && (!validDate(s.dailyPlan.date) || ![15,30,60].includes(s.dailyPlan.capacity))) return false;
    if(s.support!==undefined && s.support!==null &&
      (!ACTIVITIES.includes(s.support.kind) || !Number.isInteger(s.support.stage) || s.support.stage<0 || s.support.stage>2 || !validTime(s.support.startedAt))) return false;
    if(['activity','recover'].includes(s.view) && !s.support) return false;
    const seen = new Set();
    for (const t of s.tasks) {
      if (!t || typeof t.id !== 'string' || !Object.hasOwn(CATALOG, t.id) || seen.has(t.id) || !Number.isInteger(t.index) || t.index < 0 || t.index > 3 ||
          !(t.aux === null || REASONS.includes(t.aux)) || typeof t.started !== 'boolean' || typeof t.touched !== 'boolean' ||
          (t.index === 3 && !t.aux && t.started)) return false;
      seen.add(t.id);
      for(const field of ['note','lastDone']) if(t[field]!==undefined && (typeof t[field]!=='string'||t[field].length>160)) return false;
      if(t.remainder!=null && (typeof t.remainder!=='string'||t.remainder.length>160)) return false;
      if(t.stoppedOn!=null && !validDate(t.stoppedOn)) return false;
      if(t.helpAttempts!==undefined && (!Number.isInteger(t.helpAttempts)||t.helpAttempts<0||t.helpAttempts>3)) return false;
      if(t.auxLevel!==undefined && (!Number.isInteger(t.auxLevel)||t.auxLevel<0||t.auxLevel>2)) return false;
      if(t.estimate!==undefined && t.estimate!==null && !validRange(t.estimate)) return false;
      if(t.timing!==undefined && (!t.timing || !validTime(t.timing.elapsedMs) ||
        !(t.timing.runningSince===null || validTime(t.timing.runningSince)) || typeof t.timing.visible!=='boolean' ||
        (t.timing.runningSince!==null && (!t.started || !t.timing.visible || s.view!=='step' || s.selected!==t.id)))) return false;
    }
    if(s.supportTask!=null && (!seen.has(s.supportTask)||s.supportTask!==s.selected)) return false;
    return (s.selected === null || seen.has(s.selected)) && (!['step','help','pause','overview'].includes(s.view) || seen.has(s.selected));
  }
  function createPersistence(getStorage) {
    let mode = 'local';
    const memoryNotice = '浏览器暂时无法保存进度，本次仍可体验；刷新或关闭后可能丢失进度。';
    return {
      load() {
        let raw;
        try { raw = getStorage().getItem(STORAGE_KEY); }
        catch { mode = 'memory'; return { state: initialState(), mode, notice: memoryNotice }; }
        if (raw === null) return { state: initialState(), mode, notice: '' };
        try {
          const parsed = JSON.parse(raw);
          if (!validState(parsed)) throw Error('Invalid state');
          // Keep known fields only; never render arbitrary saved content.
          const state = { version: 1, date: parsed.date, selected: parsed.selected, view: parsed.view, petCredits:creditsFor(parsed),
            supportTask:parsed.supportTask===undefined&&['support','activity','recover'].includes(parsed.view)?parsed.selected:(parsed.supportTask||null),
            dailyPlan:parsed.dailyPlan?{date:parsed.dailyPlan.date,capacity:parsed.dailyPlan.capacity}:null,
            support: parsed.support ? {kind:parsed.support.kind,stage:parsed.support.stage,startedAt:parsed.support.startedAt} : null,
            tasks: parsed.tasks.map(t => ({ ...continuity(),note:t.note||'',lastDone:t.lastDone||'',remainder:t.remainder||null,stoppedOn:t.stoppedOn||null,helpAttempts:t.helpAttempts||0,auxLevel:t.auxLevel||0,id: t.id, index: t.index, aux: t.aux, started: t.started, touched: t.touched,
              estimate: t.estimate ? [...t.estimate] : null, timing: t.timing ? {
                elapsedMs:t.timing.elapsedMs,runningSince:t.timing.runningSince,visible:t.timing.visible
              } : freshTiming() })) };
          return { state, mode, notice: '' };
        } catch { return { state: initialState(), mode, notice: '上次的演示记录无法读取，已恢复初始示例。' }; }
      },
      save(state) {
        if (mode === 'memory') return { mode, notice: memoryNotice };
        try {
          const storage=getStorage(), raw=storage.getItem(STORAGE_KEY);
          let previous;
          try { previous=JSON.parse(raw); } catch {}
          if(validState(previous)){
            const old=creditsFor(previous), current=creditsFor(state);
            for(const id of Object.keys(CATALOG)) current[id]=Math.max(current[id],old[id]);
            state.petCredits=current;
          }
          storage.setItem(STORAGE_KEY, JSON.stringify(state)); return { mode, notice: '' };
        }
        catch { mode = 'memory'; return { mode, notice: memoryNotice }; }
      }
    };
  }
  return { STORAGE_KEY, CATALOG, RANGES, growth, companion, displayedTask, recommendation, dailyAdvice, estimate, elapsed, initialState, transition, orderedTasks, currentStep, suggestion, deadlineLabel, createPersistence };
});
