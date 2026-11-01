// 終端機介面：逐字顯示輸出、建議指令按鈕、狀態面板。
// 畫面上的文字都在這裡才翻譯，所以切換語言時只要把歷史紀錄重新畫一次。
(function (E) {
  const t = (k, v) => E.i18n.t(k, v);
  const $ = (id) => document.getElementById(id);

  let logEl, chipsEl, onChip, onIdle;
  const queue = [];
  let busy = false;
  // 跳過只作用在「按下跳過那一刻已經排隊的文字」，之後新的輸出照常逐字顯示。
  let seq = 0;
  let skipBelow = 0;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function cmdLabel(cmd) {
    const [verb, target, topic] = cmd;
    const custom = E.chipLabels && E.chipLabels[verb + ':' + target];
    if (custom) return t(custom);
    return t('verb.' + verb) + (target ? ' ' + t('ent.' + target) : '') + (topic ? ' · ' + t('topic.' + topic) : '');
  }

  function textOf(entry) {
    if (entry.c === 'input') return entry.cmd ? cmdLabel(entry.cmd) : entry.raw;
    return t(entry.k, entry.v);
  }

  function lineEl(entry) {
    const el = document.createElement('div');
    el.className = 'line ' + entry.c;
    logEl.appendChild(el);
    return el;
  }

  function scroll() { logEl.scrollTop = logEl.scrollHeight; }

  function renderInstant(entry) {
    if (entry.c === 'pause') return;
    lineEl(entry).textContent = textOf(entry);
  }

  async function typeOut(item) {
    const entry = item.entry;
    const skipped = () => item.n <= skipBelow;
    if (entry.c === 'pause') {
      if (!skipped()) await wait(entry.ms || 600);
      return;
    }
    const el = lineEl(entry);
    const full = textOf(entry);
    // 舞台演出跟著打字節奏觸發；被跳過的文字不播演出，但場景切換一定要跟上。
    if (E.fx && entry.c !== 'input' && (entry.c === 'loc' || !skipped())) E.fx.line(entry, full);
    if (skipped() || entry.c === 'input') {
      el.textContent = full;
      scroll();
      return;
    }
    const slow = entry.c === 'title' || entry.c === 'bleed';
    const step = slow ? 1 : 2;
    const delay = slow ? 70 : 14;
    el.classList.add('typing');
    for (let i = step; i < full.length && !skipped(); i += step) {
      el.textContent = full.slice(0, i);
      scroll();
      await wait(delay);
    }
    el.textContent = full;
    el.classList.remove('typing');
    scroll();
  }

  async function pump() {
    if (busy) return;
    busy = true;
    document.body.classList.add('busy');
    while (queue.length) await typeOut(queue.shift());
    busy = false;
    document.body.classList.remove('busy');
    if (onIdle) onIdle();
  }

  function bump(el, value) {
    const v = String(value);
    if (el.textContent !== v) {
      el.textContent = v;
      el.classList.remove('bump');
      void el.offsetWidth; // 重新觸發動畫
      el.classList.add('bump');
    }
  }

  E.ui = {
    init(opts) {
      logEl = opts.log;
      chipsEl = opts.chips;
      onChip = opts.onChip;
      onIdle = opts.onIdle;
    },

    get busy() { return busy; },

    print(entries) {
      for (const entry of entries) queue.push({ entry, n: ++seq });
      pump();
    },

    skip() { skipBelow = seq; },

    clear() {
      queue.length = 0;
      skipBelow = seq;
      logEl.innerHTML = '';
    },

    // 切換語言時，把全部歷史立刻用新語言重畫一次。
    rerender(history) {
      queue.length = 0;
      skipBelow = seq;
      logEl.innerHTML = '';
      history.forEach(renderInstant);
      scroll();
    },

    chips(list) {
      chipsEl.innerHTML = '';
      for (const cmd of list) {
        const b = document.createElement('button');
        b.type = 'button';
        if (cmd[0] === 'choose') {
          // 最終抉擇：大卡片，附上代價說明，自己排成一列。
          if (!chipsEl.querySelector('.choice-break')) {
            const br = document.createElement('div');
            br.className = 'choice-break';
            chipsEl.appendChild(br);
          }
          b.className = 'chip choice ' + cmd[1];
          const title = document.createElement('b');
          title.textContent = t('ent.' + cmd[1]);
          const desc = document.createElement('small');
          // 說明文字開頭重複了選項名稱（「留下：……」），卡片上已經有標題，去掉。
          desc.textContent = t('fin.opt.' + cmd[1]).replace(/^[^：:]{1,12}[：:]\s*/, '');
          b.append(title, desc);
        } else {
          b.className = 'chip' + (cmd[0] === 'recall' ? ' hot' : '');
          b.textContent = cmdLabel(cmd);
        }
        b.addEventListener('click', () => { if (E.fx) E.fx.sfx.play('click'); onChip(cmd); });
        chipsEl.appendChild(b);
      }
    },

    hud(s) {
      $('hud-loc').textContent = t(E.scenes[s.scene].location);
      const actor = $('hud-actor');
      actor.hidden = !(s.party && s.party.length);
      if (!actor.hidden) actor.textContent = t('hud.actor', { who: { t: 'name.' + s.actor } });
      const bw = $('hud-bw');
      bw.innerHTML = '';
      for (let i = 0; i < s.bandwidthMax; i++) {
        const pip = document.createElement('i');
        if (i < s.bandwidth) pip.className = 'on';
        bw.appendChild(pip);
      }
      $('hud-exp-bar').style.width = s.exposure + '%';
      bump($('hud-exp'), s.exposure);
      $('hud-exp').parentElement.classList.toggle('alert', s.exposure >= 30);
      // 第三格依場景顯示不同的目標數值：序章是瑪雅的資料完整度，唐人街是浩文的信任。
      const meter = E.scenes[s.scene].meter;
      if (meter) {
        const v = meter.get(s);
        $('hud-meter-label').textContent = t(meter.label);
        $('hud-trace-bar').style.width = Math.min(100, (v / meter.max) * 100) + '%';
        $('hud-trace-mark').style.left = (meter.goal / meter.max) * 100 + '%';
        bump($('hud-trace'), v + (meter.unit || ''));
        // danger 類的數值（例如距離回收）跌破目標就轉紅。
        $('hud-trace').parentElement.classList.toggle('ready', v >= meter.goal);
        $('hud-trace').parentElement.classList.toggle('alert', !!meter.danger && v < meter.goal);
      }
      bump($('hud-bleed'), s.bleed);
      if (E.fx) E.fx.party(s);
      if (s.sync !== null) {
        $('hud-sync-bar').style.width = s.sync + '%';
        bump($('hud-sync'), s.sync + '%');
        $('hud-sync').parentElement.classList.toggle('alert', s.sync < 60);
      }
    },
  };
})(window.ECHO = window.ECHO || {});
