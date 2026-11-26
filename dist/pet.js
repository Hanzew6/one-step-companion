/* Throwaway interaction prototype: one live task state, local page reminders. */
(() => {
  'use strict';
  const M = window.OneStep, app = window.OneStepCompanion;
  const $ = id => document.getElementById(id);
  const widget = $('pet-widget'), character = $('pet-character'), bubble = $('pet-bubble'), menu = $('pet-menu');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prefsKey = 'one-step-pet-preferences-v1';
  const today = () => new Date().toLocaleDateString('en-CA');
  const fiveMinutes = 5 * 60 * 1000;
  const taskWindow = $('task-window'), taskLauncher = document.querySelector('.top-open');
  const scene = document.querySelector('.desktop-scene'), menuToggle = $('pet-menu-toggle');
  let taskOpener = taskLauncher, menuOpener = menuToggle, lastStatus = '', returning = false;
  let prefs = { quietDate: '', remindAt: Date.now() + fiveMinutes }, temporary = false, mode = 'step', moodTimer, drag = null, dragged = false;
  try {
    const saved = JSON.parse(localStorage.getItem(prefsKey));
    if (saved && typeof saved.quietDate === 'string') prefs.quietDate = saved.quietDate;
    if (saved && Number.isFinite(saved.remindAt) && saved.remindAt >= 0) prefs.remindAt = saved.remindAt;
  } catch { temporary = true; }
  const quiet = () => prefs.quietDate === today();
  const resting = state => ['support', 'activity', 'recover'].includes(state.view);
  function savePrefs() { try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch { temporary = true; } status(); }
  function status() {
    const active = prefs.remindAt > 0;
    const paused = remindersPaused(app.snapshot());
    const statusKey = [quiet(), paused, prefs.remindAt, temporary].join('|');
    if (lastStatus === statusKey) return;
    lastStatus = statusKey;
    $('reminder-status').textContent = (quiet() ? '今天安静陪伴 · 仍然可以点我' : paused ? '任务提醒已暂停，仍可点小猫看进度。' : active ? '下次轻提醒：' + new Date(prefs.remindAt).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'}) + ' · 页面打开时有效' : '这次提醒已送达 · 可以选择稍后再提醒') + (temporary ? ' · 设置仅本次有效' : '');
    $('quiet-toggle').innerHTML = '<span>◌</span>' + (quiet() ? '恢复轻提醒' : '今天暂停提醒');
  }
  function closeMenu() { menu.hidden = true; character.setAttribute('aria-expanded', 'false'); $('pet-menu-toggle').setAttribute('aria-expanded', 'false'); }
  function buttons(items) { $('bubble-actions').innerHTML = items.map(([label, action]) => `<button data-pet="${action}">${esc(label)}</button>`).join(''); }
  function say(title, detail, items = [], context = '我在这里。', progress = '') {
    closeMenu(); bubble.hidden = false;
    $('bubble-content').innerHTML = `<p class="bubble-context">${esc(context)}</p>${progress ? '<strong class="step-status">'+esc(progress)+'</strong>' : ''}<h2>${esc(title)}</h2><p>${esc(detail)}</p>`;
    buttons(items); clampPosition();
  }
  function showStep(reminder = false, preview = false) {
    mode = reminder ? 'reminder' : 'step';
    const state = app.snapshot(), task = M.displayedTask(state);
    if (resting(state)) {
      say('先歇一会儿，我陪着你。', state.supportTask ? '刚才的位置已经留好，准备好了再回来。' : '这会儿不用挑一件事来做。', [[state.supportTask ? '回到刚才这一步' : '结束休息', 'resume'], ['继续休息', 'dismiss']]); return;
    }
    if (!task) { say('还没有要做的事。', '打开主界面，加入一份示例作业吧。', [['打开主界面', 'open']]); return; }
    const step = M.currentStep(state, task.id), context = `${M.CATALOG[task.id].short} · ${M.deadlineLabel(state, task.id)}`;
    if (task.stoppedOn || state.view === 'pause') {
      say('停在这里也很好。', '下次从这里继续：' + step.title, [[step.continuation ? '查看进度' : '我想继续', step.continuation ? 'open' : 'begin']], context); return;
    }
    if (state.view === 'help') { say('卡住了，我们换个起点。', '主界面里留着刚才的步骤和一个更小的建议。', [['看看小建议', 'open'], ['先休息', 'rest']], context); return; }
    if (step.continuation) { say('已经走过三个小步骤。', '后续起点：' + step.title + ' 作业仍未完成，这是本轮演示的边界。', [['查看进度', 'open'], ['休息一下', 'rest']], context); return; }
    const progress = task.started ? '进行中' : task.lastDone ? '上一步已完成' : '下一步';
    const stage = step.auxiliary ? '辅助小动作' : '示例步骤 ' + (task.index + 1) + '/3';
    const detail = reminder ? '轻轻提醒一下。' + step.detail : step.detail;
    const feedback = preview ? '提醒预览' : progress;
    say(step.title, detail, reminder ? [['看看这一步', 'step'], ['5 分钟后提醒', 'snooze'], ['今天暂停提醒', 'quiet']] : [[task.started ? '标记这一步完成' : '开始这一小步', task.started ? 'finish' : 'begin'], ['卡住了', 'help']], context + ' · 约 ' + M.estimate(state,task.id).join('–') + ' 分钟', feedback + ' · ' + stage);
  }
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const art = $('kitten-art');
  function pose(mood) {
    widget.dataset.mood = mood;
    window.PetWardrobe.paint(art,mood,character.querySelector('.wardrobe-layer').dataset.outfit);
  }
  function animate(mood) {
    clearTimeout(moodTimer);
    pose(mood);
    if (mood !== 'sleep') moodTimer = setTimeout(syncMood, mood === 'stretch' ? 2200 : 2450);
  }
  function syncMood() { pose(resting(app.snapshot()) || quiet() ? 'sleep' : 'idle'); }
  motionPreference.addEventListener('change', () => pose(widget.dataset.mood));
  function displayTasks(open) {
    if (taskWindow.hidden === !open) return;
    closeMenu();
    bubble.hidden = true;
    taskWindow.hidden = !open;
    widget.inert = scene.inert = open;
    taskLauncher.hidden = open;
    if (open) taskWindow.querySelector('[data-pet="close"]').focus();
    else {
      if (!$('reset-confirm').hidden) $('demo-tools').open = false;
      taskOpener.focus({preventScroll:true});
    }
  }
  function openWindow(trigger) {
    taskOpener = menu.contains(trigger) ? menuOpener : bubble.contains(trigger) ? character : taskLauncher;
    if (location.hash !== '#tasks') history.pushState({petTasks:true}, '', '#tasks');
    displayTasks(true);
  }
  function returnToDesk() {
    if (returning) return;
    if (history.state?.petTasks) { returning = true; history.back(); }
    else {
      history.replaceState(null, '', location.href.split('#')[0]);
      displayTasks(false);
    }
  }
  window.addEventListener('hashchange', () => {
    returning = false;
    displayTasks(location.hash === '#tasks');
  });
  document.querySelector('.desk-backdrop').addEventListener('click', returnToDesk);
  function showMenu(trigger) { const opening = menu.hidden; bubble.hidden = true; menu.hidden = !opening; character.setAttribute('aria-expanded', String(opening)); menuToggle.setAttribute('aria-expanded', String(opening)); clampPosition(); if (opening) { menuOpener = trigger; menu.querySelector('button').focus({preventScroll:true}); } }
  function act(action, trigger) {
    switch (action) {
      case 'open': openWindow(trigger); break;
      case 'shop': location.assign('shop.html'); break;
      case 'close': returnToDesk(); break;
      case 'menu': showMenu(trigger); break;
      case 'step': showStep(); break;
      case 'dismiss': bubble.hidden = true; character.focus({preventScroll:true}); break;
      case 'begin': app.act('START'); showStep(); break;
      case 'finish': app.act('FINISH'); showStep(); animate('wave'); break;
      case 'help': openWindow(trigger); app.act('ASSIST'); $('work-title').focus({preventScroll:true}); $('work-title').scrollIntoView({block:'nearest'}); break;
      case 'rest': app.act('REST'); showStep(); syncMood(); break;
      case 'resume': app.act('RESUME_WORK'); showStep(); syncMood(); break;
      case 'wave': mode = 'social'; animate('wave'); say('收到，给你一个小小的击掌。', '不用完成任务，也可以来找我。', [['看看下一步', 'step']]); break;
      case 'stretch': mode = 'social'; animate('stretch'); say('伸——个懒腰。', '你也可以放松一下肩膀。想继续或休息都可以。', [['陪我休息', 'rest'], ['继续这一步', 'step']]); break;
      case 'snooze':
        prefs.quietDate = ''; prefs.remindAt = Date.now() + fiveMinutes; savePrefs(); mode = 'social'; syncMood();
        say('好，5 分钟后再轻轻提醒。', '这段时间我会安静待着。页面需要保持打开。', [['知道啦', 'dismiss']]); break;
      case 'quiet':
        prefs.quietDate = quiet() ? '' : today(); prefs.remindAt = quiet() ? 0 : Date.now() + fiveMinutes; savePrefs(); syncMood(); mode = 'social';
        say(quiet() ? '今天就安静陪着你。' : '轻提醒恢复了。', quiet() ? '不会再主动提醒。想知道下一步，随时点我。' : '5 分钟后提醒一次；休息或停下时不会催你。', [['知道啦', 'dismiss']]); break;
      case 'remind': deliverReminder(true); break;
    }
  }
  function remindersPaused(state) {
    const task = M.displayedTask(state);
    return resting(state) || state.view === 'help' || state.view === 'pause' || !!task?.stoppedOn || !task || (task.index === 3 && !task.aux);
  }
  function deliverReminder(manual = false) {
    if (quiet() || remindersPaused(app.snapshot())) {
      if (manual) { mode = 'social'; say('现在不用催你。', quiet() ? '今天已暂停提醒，可在互动菜单里恢复。' : '休息、求助、停下或到达示例边界时，不推送任务提醒。', [['主动看看', 'step']]); }
      return;
    }
    if (!manual && (document.hidden || !menu.hidden || !bubble.hidden || !$('task-window').hidden || drag)) return;
    showStep(true, manual); animate('wave');
    if (!manual) { prefs.remindAt = 0; savePrefs(); }
  }
  window.addEventListener('one-step-change', () => { syncMood(); status(); if (!bubble.hidden && mode !== 'social') showStep(mode === 'reminder'); });
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-pet]');
    if (control && event.detail <= 1) {
      act(control.dataset.pet, control);
      if (!bubble.hidden && !control.matches('[data-pet="menu"]')) $('bubble-actions').querySelector('button')?.focus({preventScroll:true});
    }
    else if (!widget.contains(event.target)) closeMenu();
  });
  character.addEventListener('click', event => { if (dragged) { dragged = false; return; } if (event.detail <= 1) { showStep(); $('bubble-actions').querySelector('button')?.focus({preventScroll:true}); } });
  character.addEventListener('contextmenu', event => { event.preventDefault(); showMenu(character); });
  character.addEventListener('keydown', event => { if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') { event.preventDefault(); showMenu(character); } });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!taskWindow.hidden) returnToDesk();
      else if (!menu.hidden) { closeMenu(); menuOpener.focus(); }
      else if (!bubble.hidden) { bubble.hidden = true; character.focus(); }
      else return;
      event.preventDefault();
    }
    if (!menu.hidden && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const items = [...menu.querySelectorAll('button')], current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    }
  });
  function clampPosition() {
    if (!widget.style.left) return;
    const rect = widget.getBoundingClientRect();
    widget.style.left = Math.max(10, Math.min(rect.left, innerWidth - rect.width - 10)) + 'px';
    widget.style.bottom = Math.max(10, Math.min(parseFloat(widget.style.bottom) || 10, innerHeight - rect.height - 10)) + 'px';
  }
  character.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = widget.getBoundingClientRect();
    dragged = false; drag = {x:event.clientX, y:event.clientY, left:rect.left, bottom:innerHeight - rect.bottom};
    character.setPointerCapture(event.pointerId);
  });
  character.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!dragged && Math.hypot(dx,dy) < 6) return;
    dragged = true; widget.style.right = 'auto'; widget.style.left = drag.left + dx + 'px'; widget.style.bottom = drag.bottom - dy + 'px'; clampPosition();
  });
  character.addEventListener('pointerup', () => { drag = null; });
  character.addEventListener('pointercancel', () => { drag = null; dragged = false; });
  window.addEventListener('resize', clampPosition);
  function checkReminders() {
    if (prefs.quietDate && !quiet()) {
      prefs.quietDate = ''; prefs.remindAt = Date.now() + fiveMinutes; savePrefs(); syncMood();
    }
    if (prefs.remindAt && Date.now() >= prefs.remindAt) deliverReminder();
  }
  setInterval(checkReminders, 1000);
  syncMood(); savePrefs(); displayTasks(location.hash === '#tasks');
})();
