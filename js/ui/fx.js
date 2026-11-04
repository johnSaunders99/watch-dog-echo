// 舞台與演出：場景插畫切換、Profiler 人物卡、駭入連線動畫、全螢幕標題卡／獨白／同步崩塌。音效在 js/ui/sfx.js。
// 演出跟著逐字輸出的節奏觸發（terminal.js 在每一行開始打字前呼叫 E.fx.line）。
// 切換語言時是瞬間重畫，不會重播任何演出。
(function (E) {
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => E.i18n.t(k, v);
  let getState = () => null;
  let currentArt = null;

  // 音效在 js/ui/sfx.js。
  const sfx = E.sfx;

  // ===== 全螢幕演出佇列：標題卡、獨白、同步崩塌、結局 =====
  const queue = [];
  let showing = false;
  let skipCurrent = null;

  function cine(kind, html, ms) {
    return new Promise((resolve) => {
      queue.push({ kind, html, ms, resolve });
      pump();
    });
  }

  function pump() {
    if (showing || !queue.length) return;
    showing = true;
    const { kind, html, ms, resolve } = queue.shift();
    const el = $('cine');
    el.className = 'cine show ' + kind;
    el.innerHTML = html;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.remove('show');
      setTimeout(() => {
        showing = false;
        resolve();
        pump();
      }, 350);
    };
    skipCurrent = finish;
    setTimeout(finish, ms);
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ===== Profiler 人物卡 =====
  let card = null;
  let cardTimer = null;

  function profiler(who, text) {
    // 寬螢幕放在插畫下方的檔案區；手機沒有檔案區，就疊在插畫上。
    const layer = window.matchMedia('(max-width: 960px)').matches ? $('fx-layer') : $('pcard-dock');
    if (!card || card.dataset.who !== String(who)) {
      if (card) card.remove();
      card = document.createElement('div');
      card.className = 'pcard';
      card.dataset.who = String(who);
      card.innerHTML = `<div class="pcard-head"><span>PROFILER</span><i></i></div><div class="pcard-body"><div class="pcard-avatar">${E.art.avatarFor(who)}</div><div class="pcard-lines"></div></div>`;
      layer.appendChild(card);
      sfx.play('prof');
    }
    const line = document.createElement('div');
    line.textContent = text.replace(/^\[PROFILER\]\s*/, '');
    card.querySelector('.pcard-lines').appendChild(line);
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => {
      if (!card) return;
      const c = card;
      c.classList.add('out');
      setTimeout(() => c.remove(), 400);
      if (card === c) card = null;
    }, 5200);
  }

  // ===== 駭入連線：從 ECHO 節點射向畫面上的一點 =====
  function hackBeam() {
    const layer = $('fx-layer');
    const x = 30 + Math.random() * 55, y = 20 + Math.random() * 45;
    const el = document.createElement('div');
    el.className = 'beam';
    el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M4 96 Q${x / 2} ${y + 30} ${x} ${y}" vector-effect="non-scaling-stroke"/></svg><span class="beam-node" style="left:${x}%;top:${y}%"></span>`;
    layer.appendChild(el);
    sfx.play('hack');
    setTimeout(() => el.remove(), 1400);
  }

  function alarm() {
    const st = $('stage');
    st.classList.remove('alarm');
    void st.offsetWidth;
    st.classList.add('alarm');
    sfx.play('alarm');
  }

  // 客串角色登場：全螢幕人物卡。
  const CAMEO_KEYS = { 'cameo.bagley': 'bagley', 'cameo.darcy': 'darcy', 'cameo.wrench': 'wrench' };

  E.fx = {
    sfx,

    init(opts) {
      getState = opts.getState;
      $('cine').addEventListener('click', () => { if (skipCurrent) skipCurrent(); });
    },

    // 切換場景插畫（淡入淡出）。
    setScene(sceneId, instant) {
      const { key, svg } = E.art.scene(sceneId);
      const memory = !!(E.scenes[sceneId] && E.scenes[sceneId].memory);
      $('stage').classList.toggle('memory', memory);
      if (key === currentArt && !instant) return;
      currentArt = key;
      const art = $('art');
      const next = document.createElement('div');
      next.className = 'art-layer';
      next.innerHTML = svg;
      art.appendChild(next);
      if (instant) {
        [...art.children].forEach((c) => { if (c !== next) c.remove(); });
        next.classList.add('in');
      } else {
        requestAnimationFrame(() => next.classList.add('in'));
        setTimeout(() => [...art.children].forEach((c) => { if (c !== next) c.remove(); }), 1200);
      }
    },

    // 地點文字的格式是「地點 // 細節 // 時間」：第一段放大，其餘當副標。
    caption(text) {
      const parts = String(text).split('//').map((p) => p.trim()).filter(Boolean);
      const memory = parts[0] && /^(記憶|记忆|MEMORY|現實|现实|PRESENT)$/.test(parts[0]);
      const tag = memory ? parts.shift() : '';
      $('stage-tag').textContent = tag || 'ctOS';
      $('stage-loc').textContent = parts.shift() || '';
      $('stage-sub').textContent = parts.join('  ·  ');
    },

    party(s) {
      const el = $('party');
      const members = ['echo', ...(s.party || [])];
      const memory = E.scenes[s.scene] && E.scenes[s.scene].memory;
      el.innerHTML = members.length > 1 && !memory
        ? members.map((m) => `<div class="member${m === s.actor ? ' active' : ''}" title="${esc(t('name.' + m))}">${E.art.avatar(m)}<span>${esc(t('name.' + m))}</span></div>`).join('')
        : '';
    },

    // 每一行開始打字前觸發對應的演出。
    line(entry, text) {
      const k = entry.k || '';
      if (entry.c === 'loc') {
        const s = getState();
        if (s) this.setScene(s.scene);
        this.caption(text);
        sfx.play('blip');
      } else if (entry.c === 'title') {
        const ending = k.startsWith('end.');
        cine(ending ? 'ending' : 'title', `<div class="cine-title">${esc(text)}</div>`, ending ? 4200 : 2400);
        sfx.play(ending ? 'ending' : 'title');
      } else if (entry.c === 'bleed') {
        cine('bleed', `<div class="cine-bleed">${esc(text)}</div>`, 3000);
        sfx.play('bleed');
      } else if (k === 'desync.1') {
        cine('desync', `<div class="cine-desync" data-text="${esc(text)}">${esc(text)}</div>`, 1800);
        sfx.play('desync');
      } else if (entry.c === 'prof') {
        profiler(entry.who, text);
      } else if (entry.c === 'cost') {
        hackBeam();
      } else if (entry.c === 'warn' && /NIGHTWATCH/.test(text)) {
        alarm();
      } else if (entry.c === 'gain') {
        sfx.play('gain');
      } else if (entry.c === 'loss') {
        sfx.play('loss');
      } else if (CAMEO_KEYS[k]) {
        const who = CAMEO_KEYS[k];
        cine('cameo', `<div class="cine-cameo"><div class="cameo-avatar">${E.art.avatar(who)}</div><div class="cameo-name">${esc(t('name.' + who))}</div><div class="cameo-line">${esc(text)}</div></div>`, 3200);
        sfx.play('cameo');
      }
    },

    // 新遊戲的開場：先閃現終章的危機，再回到「四小時前」。
    coldOpen() {
      const lines = [1, 2, 3, 4].map((i) => esc(t('co.' + i)));
      sfx.play('alarm');
      const flash = cine('cold', `<div class="cold-stamp">${lines[0]}</div><div class="cold-warn">${lines[1]}</div><div class="cold-quote">${lines[2]}</div>`, 3600);
      sfx.play('title');
      return flash.then(() => {
        sfx.play('desync');
        return cine('title', `<div class="cine-title">${lines[3]}</div>`, 1800);
      });
    },
  };
})(window.ECHO = window.ECHO || {});
