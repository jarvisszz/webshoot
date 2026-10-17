(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const PREFIX = 'mdp:';
  const load = (k, d) => {
    try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); }
    catch { return d; }
  };
  const save = (k, v) => { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* storage blocked */ } };
  const dayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const lastDays = n => Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d;
  });
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  function renderBars(container, days, values, max, unit = '') {
    container.replaceChildren();
    days.forEach((d, i) => {
      const col = el('div', null, 'bar-col');
      const v = values[i];
      const bar = el('div', null, 'bar' + (v == null ? ' empty' : ''));
      bar.style.height = v == null ? '3%' : Math.max(6, (v / max) * 85) + '%';
      bar.title = v == null ? 'No entry' : v + unit;
      col.append(bar, el('span', d.toLocaleDateString(undefined, { weekday: 'narrow' })));
      container.append(col);
    });
  }

  /* ---------- routing ---------- */
  const views = $$('.view');
  const note = $('#note');
  const stoppers = {};
  let current = null;
  let noteView = null;

  function setNote(view, text) { noteView = view; note.textContent = text; }

  function route() {
    const id = (location.hash || '#home').slice(1);
    const target = document.getElementById(id);
    const name = target && target.classList.contains('view') ? id : 'home';
    if (current && current !== name && stoppers[current]) stoppers[current]();
    views.forEach(v => { v.hidden = v.id !== name; });
    $$('nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + name ? 'page' : 'false'));
    note.hidden = name !== noteView;
    if (current !== name) {
      const h = $('h1', document.getElementById(name));
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    }
    current = name;
    if (name === 'space') renderSpace();
    if (name === 'scroll') { renderMenu(); renderScrollLog(); }
    if (name === 'wind') { renderWind(); renderWorries(); }
  }
  window.addEventListener('hashchange', route);

  /* ---------- home check-in ---------- */
  const targets = { anxious: 'calm', overwhelmed: 'dump', focus: 'focus', switchoff: 'wind', scrolling: 'scroll', sleep: 'wind' };
  const notes = {
    anxious: "That sounds heavy. Let's slow it down together. Press Start when you're ready.",
    overwhelmed: "That's a lot to carry. Get it all out of your head first, then pick one thing.",
    focus: "Focus is hard when your brain is tired. Start small. Even 5 minutes counts.",
    switchoff: "Your mind is still running. Let's ease it down gently.",
    scrolling: "It's okay. Those apps are built to hook you. Try the urge timer before you open it.",
    sleep: "Rest can be tricky when your mind is busy. Park your worries and wind down slowly."
  };
  let feeling = null;

  $$('#feelings button').forEach(b => b.addEventListener('click', () => {
    feeling = b.dataset.feel;
    $$('#feelings button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#timeStep').hidden = false;
    const h = $('#timeStep h2'); h.focus();
  }));

  $$('#timeStep [data-min]').forEach(b => b.addEventListener('click', () => {
    if (!feeling) return;
    const mins = Number(b.dataset.min);
    $('#breathMin').value = mins === 1 ? '1' : mins === 5 ? '5' : '5';
    $('#pomoLen').value = mins === 1 ? '5' : mins === 5 ? '10' : '25';
    pomoSetLength();
    const t = targets[feeling];
    setNote(t, notes[feeling]);
    location.hash = '#' + t;
  }));

  /* ---------- breathing ---------- */
  const patterns = {
    box: [['Inhale', 4, 1.6], ['Hold', 4, 1.6], ['Exhale', 4, 1], ['Hold', 4, 1]],
    '478': [['Inhale', 4, 1.6], ['Hold', 7, 1.6], ['Exhale', 8, 1]],
    sigh: [['Inhale', 2, 1.4], ['Inhale again', 1, 1.65], ['Exhale slowly', 6, 1]]
  };
  const circle = $('#circle');
  const breathText = $('#breathText');
  const breathBtn = $('#breathBtn');
  let breathTimer = null;

  function stopBreath(msg) {
    clearTimeout(breathTimer);
    breathTimer = null;
    circle.style.transition = 'transform 1s ease-in-out';
    circle.style.transform = 'scale(1)';
    breathBtn.textContent = 'Start';
    breathText.textContent = msg || 'Ready when you are';
  }
  stoppers.calm = () => { stopBreath(); stopGround(); };

  function startBreath() {
    const phases = patterns[$('#breathPattern').value];
    const endAt = Date.now() + Number($('#breathMin').value) * 60000;
    breathBtn.textContent = 'Stop';
    const step = i => {
      if (i === 0 && Date.now() >= endAt) { stopBreath('Well done. Notice how you feel now.'); return; }
      const [label, secs, scale] = phases[i];
      circle.style.transition = `transform ${secs}s ease-in-out`;
      circle.style.transform = `scale(${scale})`;
      breathText.textContent = label + '...';
      breathTimer = setTimeout(() => step((i + 1) % phases.length), secs * 1000);
    };
    step(0);
  }
  breathBtn.addEventListener('click', () => (breathTimer ? stopBreath() : startBreath()));

  /* ---------- grounding ---------- */
  const groundSteps = [
    'Name 5 things you can SEE.',
    'Name 4 things you can TOUCH.',
    'Name 3 things you can HEAR.',
    'Name 2 things you can SMELL.',
    'Name 1 thing you can TASTE. Then take one slow breath.'
  ];
  let groundI = -1;
  function stopGround() { groundI = -1; $('#groundText').textContent = "Pulls your attention back to the room you're in."; $('#groundBtn').textContent = 'Begin'; }
  $('#groundBtn').addEventListener('click', () => {
    groundI++;
    if (groundI >= groundSteps.length) {
      $('#groundText').textContent = 'You came back to the present. Nicely done.';
      $('#groundBtn').textContent = 'Do it again';
      groundI = -1;
      return;
    }
    $('#groundText').textContent = groundSteps[groundI];
    $('#groundBtn').textContent = groundI === groundSteps.length - 1 ? 'Finish' : 'Next';
  });

  /* ---------- optional music (hide if file missing) ---------- */
  const lofiSource = $('#lofi source');
  if (lofiSource) lofiSource.addEventListener('error', () => { $('#lofiWrap').hidden = true; });

  /* ---------- urge timer ---------- */
  const urge = { endAt: null, id: null };
  function urgeStop() { clearInterval(urge.id); urge.endAt = null; }
  $('#urgeBtn').addEventListener('click', () => {
    if (urge.endAt) {
      urgeStop();
      $('#urgeTime').textContent = '10:00';
      $('#urgeMsg').textContent = "No worries. If you opened it anyway, that's okay. Try again next time.";
      $('#urgeBtn').textContent = 'Start waiting';
      return;
    }
    urge.endAt = Date.now() + 10 * 60000;
    $('#urgeBtn').textContent = "I'm done waiting";
    $('#urgeMsg').textContent = 'Stand up, drink some water, take a few slow breaths. The urge will fade.';
    urge.id = setInterval(() => {
      const left = Math.max(0, Math.ceil((urge.endAt - Date.now()) / 1000));
      $('#urgeTime').textContent = fmt(left);
      if (left === 0) {
        urgeStop();
        $('#urgeBtn').textContent = 'Start waiting';
        $('#urgeMsg').textContent = "Time's up. If you still want to open it, do it on purpose. Set an intention below first.";
      }
    }, 500);
  });

  /* ---------- intention check ---------- */
  $('#intentBtn').addEventListener('click', () => {
    const t = $('#intent').value.trim();
    if (!t) { $('#intentOut').textContent = 'Type one reason first. If you cannot think of one, maybe skip the app.'; return; }
    $('#intentOut').textContent = `Okay: "${t}". Do that, then put the phone down within ${$('#intentLimit').value} minutes.`;
  });

  /* ---------- dopamine menu ---------- */
  const defaultMenu = [
    { text: 'Drink a glass of water', effort: 'low' },
    { text: 'Stretch for 2 minutes', effort: 'low' },
    { text: 'Listen to one favourite song', effort: 'low' },
    { text: 'Step outside for fresh air', effort: 'medium' },
    { text: 'Call or message a friend', effort: 'medium' },
    { text: 'Doodle or write a few lines', effort: 'medium' },
    { text: 'Go for a walk', effort: 'high' },
    { text: 'Workout or play a sport', effort: 'high' }
  ];
  let menu = load('menu', defaultMenu);

  function renderMenu() {
    const box = $('#menuLists');
    box.replaceChildren();
    ['low', 'medium', 'high'].forEach(level => {
      const items = menu.filter(m => m.effort === level);
      if (!items.length) return;
      const wrap = el('div', null, 'effort');
      wrap.append(el('h3', level.charAt(0).toUpperCase() + level.slice(1) + ' effort'));
      const ul = el('ul', null, 'plain');
      items.forEach(m => {
        const li = el('li', m.text);
        const x = el('button', '×', 'x');
        x.setAttribute('aria-label', 'Remove ' + m.text);
        x.addEventListener('click', () => { menu = menu.filter(i => i !== m); save('menu', menu); renderMenu(); });
        li.append(x);
        ul.append(li);
      });
      wrap.append(ul);
      box.append(wrap);
    });
  }
  $('#menuAdd').addEventListener('click', () => {
    const t = $('#menuInput').value.trim();
    if (!t) return;
    menu.push({ text: t, effort: $('#menuEffort').value });
    save('menu', menu);
    $('#menuInput').value = '';
    renderMenu();
  });
  $('#menuPick').addEventListener('click', () => {
    if (!menu.length) { $('#menuPickOut').textContent = 'Add an activity first.'; return; }
    $('#menuPickOut').textContent = 'Try: ' + menu[Math.floor(Math.random() * menu.length)].text;
  });

  /* ---------- scroll log ---------- */
  function renderScrollLog() {
    const log = load('scrollLog', {});
    const days = lastDays(7);
    const vals = days.map(d => (log[dayKey(d)] == null ? null : log[dayKey(d)]));
    const max = Math.max(60, ...vals.filter(v => v != null));
    renderBars($('#scrollChart'), days, vals, max, ' min');
  }
  $('#scrollSave').addEventListener('click', () => {
    const v = Number($('#scrollMin').value);
    if (!Number.isFinite(v) || v < 0 || $('#scrollMin').value === '') return;
    const log = load('scrollLog', {});
    log[dayKey()] = v;
    save('scrollLog', log);
    $('#scrollMin').value = '';
    renderScrollLog();
  });

  /* ---------- pomodoro ---------- */
  const pomo = { mode: 'focus', total: 25 * 60, left: 25 * 60, endAt: null, id: null };
  function pomoRender() {
    $('#pomoTime').textContent = fmt(pomo.left);
    $('#pomoMode').textContent = pomo.mode === 'focus' ? 'Focus time' : 'Break time';
    $('#pomoStart').textContent = pomo.endAt ? 'Pause' : 'Start';
  }
  function pomoHalt() { clearInterval(pomo.id); pomo.endAt = null; }
  function pomoSetLength() {
    if (pomo.endAt || pomo.mode !== 'focus') return;
    pomo.total = Number($('#pomoLen').value) * 60;
    pomo.left = pomo.total;
    pomoRender();
  }
  $('#pomoLen').addEventListener('change', pomoSetLength);
  $('#pomoStart').addEventListener('click', () => {
    if (pomo.endAt) {
      pomo.left = Math.max(0, Math.ceil((pomo.endAt - Date.now()) / 1000));
      pomoHalt();
      pomoRender();
      return;
    }
    if (pomo.left <= 0) pomo.left = pomo.total;
    $('#pomoMsg').textContent = '';
    pomo.endAt = Date.now() + pomo.left * 1000;
    pomo.id = setInterval(() => {
      pomo.left = Math.max(0, Math.ceil((pomo.endAt - Date.now()) / 1000));
      if (pomo.left === 0) {
        pomoHalt();
        if (pomo.mode === 'focus') {
          $('#pomoMsg').textContent = 'Nice work. Take a real break: stand up, drink water, no phone.';
        } else {
          $('#pomoMsg').textContent = "Break's over. Ready when you are.";
          pomo.mode = 'focus';
          pomo.total = Number($('#pomoLen').value) * 60;
          pomo.left = pomo.total;
        }
      }
      pomoRender();
    }, 250);
    pomoRender();
  });
  $('#pomoReset').addEventListener('click', () => {
    pomoHalt();
    pomo.mode = 'focus';
    pomo.total = Number($('#pomoLen').value) * 60;
    pomo.left = pomo.total;
    $('#pomoMsg').textContent = '';
    pomoRender();
  });
  $('#pomoBreak').addEventListener('click', () => {
    pomoHalt();
    pomo.mode = 'break';
    pomo.total = 5 * 60;
    pomo.left = pomo.total;
    $('#pomoMsg').textContent = 'Press Start when you are ready for your break.';
    pomoRender();
  });
  pomoRender();

  /* ---------- brain dump ---------- */
  const dumpArea = $('#dumpArea');
  dumpArea.value = load('dump', '');
  dumpArea.addEventListener('input', () => save('dump', dumpArea.value));
  $('#dumpBurn').addEventListener('click', () => {
    dumpArea.classList.add('burn');
    setTimeout(() => {
      dumpArea.value = '';
      save('dump', '');
      dumpArea.classList.remove('burn');
    }, 1600);
  });
  const one = $('#oneThing');
  one.value = load('oneThing', '');
  function renderOne() { $('#oneOut').textContent = one.value.trim() ? `Just this: ${one.value.trim()}` : ''; }
  one.addEventListener('input', () => { save('oneThing', one.value); renderOne(); });
  renderOne();

  /* ---------- wind down ---------- */
  const windItems = [
    'Put my phone on charge away from my bed',
    'Dim the lights and screens',
    'Wash my face or take a warm shower',
    'Write down tomorrow\'s one priority',
    'Slow breathing for a few minutes'
  ];
  function renderWind() {
    const key = 'wind-' + dayKey();
    const done = load(key, []);
    const ul = $('#windList');
    ul.replaceChildren();
    windItems.forEach((t, i) => {
      const li = el('li');
      const label = el('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = done.includes(i);
      cb.addEventListener('change', () => {
        const cur = load(key, []).filter(n => n !== i);
        if (cb.checked) cur.push(i);
        save(key, cur);
      });
      label.append(cb, document.createTextNode(t));
      li.append(label);
      ul.append(li);
    });
  }

  function renderWorries() {
    const list = load('worries', []);
    const ul = $('#worryList');
    ul.replaceChildren();
    list.forEach((w, i) => {
      const li = el('li', w);
      const x = el('button', '×', 'x');
      x.setAttribute('aria-label', 'Remove worry');
      x.addEventListener('click', () => { list.splice(i, 1); save('worries', list); renderWorries(); });
      li.append(x);
      ul.append(li);
    });
  }
  $('#worryAdd').addEventListener('click', () => {
    const t = $('#worryInput').value.trim();
    if (!t) return;
    const list = load('worries', []);
    list.unshift(t);
    save('worries', list.slice(0, 20));
    $('#worryInput').value = '';
    renderWorries();
  });

  const scanSteps = [
    'Close your eyes if you like. Take a slow breath.',
    'Feel your feet. Let them go heavy.',
    'Relax your legs and knees.',
    'Let your stomach soften. Unclench it.',
    'Drop your shoulders away from your ears.',
    'Loosen your hands and arms.',
    'Relax your jaw. Let your tongue rest.',
    'Soften your eyes and forehead.',
    'Take one more slow breath. You can rest now.'
  ];
  let scanI = -1;
  $('#scanBtn').addEventListener('click', () => {
    scanI++;
    if (scanI >= scanSteps.length) { scanI = -1; $('#scanText').textContent = 'All done. Do it again any time.'; $('#scanBtn').textContent = 'Begin'; return; }
    $('#scanText').textContent = scanSteps[scanI];
    $('#scanBtn').textContent = scanI === scanSteps.length - 1 ? 'Finish' : 'Next';
  });

  /* ---------- brown noise (Web Audio) ---------- */
  let audioCtx = null, noiseSrc = null, noiseGain = null;
  function startNoise() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = audioCtx || new Ctx();
    audioCtx.resume();
    const len = audioCtx.sampleRate * 4;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;
    noiseGain = audioCtx.createGain();
    noiseGain.gain.value = $('#noiseVol').value / 100;
    noiseSrc.connect(noiseGain).connect(audioCtx.destination);
    noiseSrc.start();
    return true;
  }
  function stopNoise() {
    if (noiseSrc) { try { noiseSrc.stop(); } catch { /* already stopped */ } noiseSrc = null; }
    $('#noiseBtn').textContent = 'Play';
    $('#noiseBtn').setAttribute('aria-pressed', 'false');
  }
  stoppers.wind = stopNoise;
  $('#noiseBtn').addEventListener('click', () => {
    if (noiseSrc) { stopNoise(); return; }
    if (startNoise()) {
      $('#noiseBtn').textContent = 'Stop';
      $('#noiseBtn').setAttribute('aria-pressed', 'true');
    }
  });
  $('#noiseVol').addEventListener('input', e => { if (noiseGain) noiseGain.gain.value = e.target.value / 100; });

  /* ---------- play: bubble wrap ---------- */
  let popped = 0;
  function buildBubbles() {
    const grid = $('#bubbles');
    grid.replaceChildren();
    popped = 0;
    $('#popCount').textContent = 'Popped: 0';
    for (let i = 0; i < 36; i++) {
      const b = el('button', null, 'bubble');
      b.setAttribute('aria-label', 'Bubble');
      b.addEventListener('click', () => {
        if (b.classList.contains('popped')) return;
        b.classList.add('popped');
        popped++;
        $('#popCount').textContent = 'Popped: ' + popped;
        if (navigator.vibrate) navigator.vibrate(10);
      });
      grid.append(b);
    }
  }
  $('#popReset').addEventListener('click', buildBubbles);
  buildBubbles();

  /* ---------- my space: mood + wins ---------- */
  function renderSpace() {
    const moods = load('moods', {});
    const days = lastDays(7);
    renderBars($('#moodChart'), days, days.map(d => (moods[dayKey(d)] == null ? null : moods[dayKey(d)])), 5, ' / 5');
    const last3 = lastDays(3).map(d => moods[dayKey(d)]);
    $('#lowMood').hidden = !last3.every(v => v != null && v <= 2);
    const wins = load('wins', []);
    const ul = $('#winList');
    ul.replaceChildren();
    wins.slice(0, 5).forEach(w => ul.append(el('li', w)));
  }
  $$('#moodBtns [data-mood]').forEach(b => b.addEventListener('click', () => {
    const moods = load('moods', {});
    moods[dayKey()] = Number(b.dataset.mood);
    save('moods', moods);
    renderSpace();
  }));
  $('#winAdd').addEventListener('click', () => {
    const t = $('#winInput').value.trim();
    if (!t) return;
    const wins = load('wins', []);
    wins.unshift(t);
    save('wins', wins.slice(0, 50));
    $('#winInput').value = '';
    renderSpace();
  });

  $('#wipeBtn').addEventListener('click', () => {
    if (!confirm('Delete everything saved in this browser? This cannot be undone.')) return;
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch { /* storage blocked */ }
    location.hash = '#home';
    location.reload();
  });

  /* ---------- start ---------- */
  route();
})();
