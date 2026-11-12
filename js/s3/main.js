// 第三季的介面：標題、安全屋（名冊和小隊）、戰鬥中的狀態列、劇情對話和無線電、
// 獎勵／黑市／維修間／事件／路線的對話框、結局，還有主迴圈和鍵盤滑鼠。
// 規則都在別的檔案：戰鬥是 js/s3/sim.js，一整趟的流程和名冊是 js/s3/run.js，畫面是 js/s3/render.js，劇本是 content-s3/story.js。
// 這裡只負責把玩家的操作轉成 sim 的輸入、把 sim 發生的事變成聲音和演出、在對的時候開對的對話框、講對的台詞。
(function (E) {
  const S3 = E.s3, sim = S3.sim, R = S3.run, V = S3.render, D = S3.data, ST = S3.story;
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => E.i18n.t(k, v);
  const L = (map) => E.i18n.pick(map);
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sfx = E.sfx;
  const params = new URLSearchParams(location.search);
  const LANG_KEY = 'watchdogs-echo.lang';
  const AUTO = !!params.get('bot');   // 機器人自己玩（測試用）：不播劇情，對話框自己選
  const pictures = S3.pictures || {};

  let meta = R.meta();
  let seed = params.get('seed') || fresh();
  let picks = [];          // 今晚的小隊：名冊裡的第幾個人
  let hubLine = null, lobbyNote = null;
  let run = null, s = null, bot = null;
  let mode = 'title';      // title、lobby、play（在房間裡）、menu（在對話框裡）、talk（劇情對話）
  let paused = false, acc = 0, last = 0, freeze = 0, deadT = 0, rewarded = false, onModalKey = null, inRoom = false;
  let lowSaid = false, predictT = 0;
  const keys = {}, edge = {}, mouse = { x: sim.W / 2, y: sim.H / 2 };
  const hudCache = {};

  function fresh() { return Math.random().toString(36).slice(2, 8); }
  const oneOf = (list) => list[Math.floor(Math.random() * list.length)];

  // ===== 前兩季的結局：有幾句台詞會跟著變 =====
  // v1：stay、seal、wildfire、recaptured。s2：dawn、cage、wild、deal、curfew、wiped。ally：hale、cassie、kahn。
  function readPast() {
    const s2 = E.save.peek('watchdogs-echo.s2.proto');
    return {
      v1: params.get('v1') || E.save.v1Ending(),
      s2: params.get('s2') || (s2 && typeof s2.ended === 'string' ? s2.ended : null),
      ally: params.get('ally') || (s2 && s2.ally) || null,
    };
  }
  const PAST = readPast();
  const lineKey = (l) => (l.v1 && l.v1[PAST.v1]) || (l.s2 && l.s2[PAST.s2]) || (l.ally && l.ally[PAST.ally]) || l.k;

  // ===== 聲音：同一種聲音太密集就略過幾次 =====
  const lastPlayed = {};
  function play(name, gap = 0) {
    const now = performance.now();
    if (gap && now - (lastPlayed[name] || 0) < gap) return;
    lastPlayed[name] = now;
    sfx.play(name);
  }
  const SHOT = { pistol: 's3gun', taser: 's3taser', shotgun: 's3shotgun', nailgun: 's3nail', silenced: 's3silenced' };
  const EVENT_SOUND = { bluedoor: 'dream', tarot: 'dream', cat: 'dream', wrench: 'cameo', darcy: 'cameo', aiden: 'cameo', marcus: 'cameo' };
  const GADGET_SOUND = { eagle: 'emp', blackout: 'blackout', sergei: 'sergei', hammer: 'smash', mask: 'dream', spider: 'droneJam', lure: 's3shriek', mine: 'lock' };
  function sound(ev) {
    switch (ev.k) {
      case 'shot': play(SHOT[ev.w] || 's3gun', 40); break;
      case 'eshot': play('s3eshot', 70); break;
      case 'pshot': play('s3nail', 90); break;
      case 'hit': play('s3hit', 45); break;
      case 'kill': play(ev.boss ? 's3bossdown' : ev.machine ? 's3scrap' : 's3kill', 50); break;
      case 'hurt': play('s3hurt'); break;
      case 'dead': case 'down': play('desync'); break;
      case 'swap': play('s3dash'); break;
      case 'getaway': play('bleed'); break;
      case 'dash': play('s3dash'); break;
      case 'hack': play('s3hack', 60); break;
      case 'denied': play('s3deny', 150); break;
      case 'boom': play('s3boom', 60); break;
      case 'shock': play('s3shock', 60); break;
      case 'zap': play('s3zap', 60); break;
      case 'arc': play('s3zap', 60); break;
      case 'steam': play('s3steam'); break;
      case 'spotted': play('spotted', 300); break;
      case 'alarm': play('alarm'); break;
      case 'clang': play('s3clang', 60); break;
      case 'takedown': play('takedown'); break;
      case 'melee': case 'swing': case 'leap': play('s3swing', 80); break;
      case 'pickup': play(ev.what === 'data' ? 's3pick' : 'gain', 40); break;
      case 'reload': play('s3reload'); break;
      case 'crash': play('crash'); break;
      case 'rev': play('s3rev'); break;
      case 'gadget': play(GADGET_SOUND[ev.id] || 'blip'); break;
      case 'wave': play('s3wave'); break;
      case 'clear': play('s3clear'); break;
      case 'phase': play('s3phase'); break;
      case 'revive': play('bleed'); break;
      case 'snipe': play('s3snipe'); break;
      case 'lob': play('s3lob', 100); break;
      case 'hijack': play('droneJam'); break;
      case 'raise': play('lock'); break;
      case 'breach': play('camOff'); break;
      case 'mark': play('prof'); break;
      case 'shriek': play('s3shriek'); break;
      case 'guard': play('s3clang'); break;
      case 'sneeze': play('noise'); break;
    }
  }

  // ===== 文字小工具 =====
  const nameOf = (p) => L(E.people.name(p));
  const jobOf = (p) => L(E.people.occupationOf(p).name);
  const pid = (p) => p.district + ':' + p.id + ':' + p.occupation;
  const exName = (id) => t('s3.ex.' + id + '.n');
  const gadName = (id) => t('s3.gad.' + id + '.n');
  const listOf = (names) => names.join(E.i18n.lang === 'en' ? ', ' : '、');
  const activeIdx = () => (s && !rewarded ? s.active : run ? run.active : 0);
  const activePerson = () => (run ? run.squad[activeIdx()].p : null);
  // 台詞裡的變數：{name} 是場上那個人，{n} 是名單上給這個人的威脅評分，{flaw} 是這個人的弱點。
  function lineVars() {
    const p = activePerson();
    if (!p) return {};
    return { name: nameOf(p), n: p.threat, flaw: p.flaw ? L(E.people.flawOf(p).name) : '' };
  }
  function portrait(who) {
    if (pictures['pt-' + who]) return `<img src="${pictures['pt-' + who]}" alt="">`;
    const sp = ST.speakers[who];
    return sp ? E.art.avatar(sp.art) : '';
  }

  // 隊上誰有這件裝備：{ i 第幾個隊員（共用的那一格是 -1）, g 裝備 }；沒有人有就是 null。
  function gadgetOwner(id) {
    const i = run.squad.findIndex((m) => m.gadget.id === id);
    if (i >= 0) return { i, g: run.squad[i].gadget };
    return run.gear && run.gear.id === id ? { i: -1, g: run.gear } : null;
  }
  // 拿這件新裝備會不會擠掉共用格裡原本的東西。
  const replacesGear = (id) => !!run.gear && !gadgetOwner(id);

  function exploitCard(id, o = {}) {
    const def = R.exploitDef(id), have = (run && run.build.exploits[id]) || 0;
    return `<button type="button" class="s3-card rar-${def.rar}${o.sold ? ' sold' : ''}" data-act="${o.act || 'pick'}" data-id="${o.i !== undefined ? o.i : id}" ${o.disabled ? 'disabled' : ''}>
      <span class="card-top"><span class="tag tag-${def.tag}">${esc(t('s3.tag.' + def.tag))}</span><span class="rar">${esc(t('s3.rar.' + def.rar))}</span></span>
      <b>${esc(exName(id))}</b>
      <span class="card-d">${esc(t('s3.ex.' + id + '.d'))}</span>
      <span class="card-foot">${def.max > 1 ? esc(t('s3.card.stack', { n: have, max: def.max })) : have ? esc(t('s3.card.owned')) : ''}${o.price !== undefined ? `<span class="price">${o.sold ? esc(t('s3.shop.sold')) : '◆ ' + o.price}</span>` : ''}</span>
    </button>`;
  }
  function gadgetCard(id, o = {}) {
    const own = gadgetOwner(id);
    const whose = own ? (own.i >= 0 ? t('s3.gad.own', { name: nameOf(run.squad[own.i].p) }) : t('s3.squad.shared')) : run.gear ? t('s3.gad.swapOut', { name: gadName(run.gear.id) }) : t('s3.squad.shared');
    return `<button type="button" class="s3-card gadget${o.sold ? ' sold' : ''}" data-act="${o.act || 'pick'}" data-id="${o.i !== undefined ? o.i : id}" ${o.disabled ? 'disabled' : ''}>
      <span class="card-top"><span class="tag tag-gadget">${esc(t('s3.tag.gadget'))}</span><span class="rar">${own ? esc(t('s3.gad.up', { n: Math.min(3, own.g.lv + 1) })) : esc(t('s3.gad.new'))}</span></span>
      <b>${esc(gadName(id))}</b>
      <span class="card-d">${esc(t('s3.gad.' + id + '.d'))}</span>
      <span class="card-note">${esc(whose)}</span>
      <span class="card-foot">${esc(t('s3.gad.cd', { n: D.gadgets[id].cd }))}${o.price !== undefined ? `<span class="price">${o.sold ? esc(t('s3.shop.sold')) : '◆ ' + o.price}</span>` : ''}</span>
    </button>`;
  }
  // 小隊現在的樣子：每個人的體力、武器、自己的裝備，加上共用的裝備和全隊的漏洞。
  function squadSummary() {
    const b = run.build, act = activeIdx();
    const rows = run.squad.map((m, i) => {
      const max = R.maxHp(run, i), hp = m.down ? 0 : Math.round(m.hp);
      return `<div class="sq-row${m.down ? ' down' : ''}${i === act ? ' on' : ''}"><kbd>${i + 1}</kbd><span class="sq-row-face">${E.faces.of(m.p, { round: true })}</span>
        <span class="sq-row-name"><b>${esc(nameOf(m.p))}</b><small>${esc(jobOf(m.p))}</small></span>
        <span class="sq-row-hp">${m.down ? esc(t('s3.squad.down')) : hp + ' / ' + max}</span>
        <span class="chip">${esc(t('s3.wp.' + m.weapon + '.n'))}</span>
        <span class="chip tag-gadget" title="${esc(t('s3.gad.' + m.gadget.id + '.d'))}"><kbd>Q</kbd> ${esc(gadName(m.gadget.id))} ${esc(t('s3.gad.lv', { n: m.gadget.lv }))}</span>
        <span class="sq-row-job" title="${esc(t('s3.job.' + m.job))}">${esc(t('s3.job.' + m.job))}</span></div>`;
    }).join('');
    const ex = Object.entries(b.exploits).map(([id, n]) => { const def = R.exploitDef(id); return `<span class="chip tag-${def.tag}" title="${esc(t('s3.ex.' + id + '.d'))}">${esc(exName(id))}${n > 1 ? ' ×' + n : ''}</span>`; }).join('');
    const gear = run.gear ? `<span class="chip tag-gadget" title="${esc(t('s3.gad.' + run.gear.id + '.d'))}"><kbd>E</kbd> ${esc(gadName(run.gear.id))} ${esc(t('s3.gad.lv', { n: run.gear.lv }))}</span>` : `<span class="dim">${esc(t('s3.squad.none'))}</span>`;
    const st = R.statsOf(run, act).st;
    return `<div class="build">
      <div class="sq-rows">${rows}</div>
      <div class="build-line"><span class="k">${esc(t('s3.squad.shared'))}</span>${gear}<span class="data-now">◆ ${run.data}</span></div>
      <div class="build-line">${ex || `<span class="dim">${esc(t('s3.pause.noEx'))}</span>`}</div>
      <div class="build-line dim">${esc(t('s3.pause.stats', { hp: st.maxHp, bw: st.bwMax, range: Math.round(st.hackRange / 50) }))}</div>
    </div>`;
  }

  // ===== 對話框 =====
  let modalHandler = null;
  function modal(html, handler, cls = '') {
    const el = $('s3-modal');
    el.className = 's3-modal ' + cls;
    el.innerHTML = `<div class="s3-box">${html}</div>`;
    el.hidden = false;
    modalHandler = handler;
    mode = mode === 'title' || mode === 'lobby' ? mode : 'menu';
    // 數字鍵 1～4 選第幾張卡片。
    onModalKey = (e) => {
      const n = /^(Digit|Numpad)([1-4])$/.exec(e.code);
      const card = n && el.querySelectorAll('.s3-card')[Number(n[2]) - 1];
      if (card && !card.disabled) card.click();
    };
  }
  function closeModal() { $('s3-modal').hidden = true; modalHandler = null; onModalKey = null; }
  $('s3-modal').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !modalHandler) return;
    sfx.unlock();
    play('click');
    modalHandler(b.dataset.act, b.dataset.id, b);
  });
  let toastT = null;
  function toast(text, cls = '') {
    const el = $('s3-toast');
    el.textContent = text;
    el.className = 'show ' + cls;
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.className = ''; }, 2600);
  }
  // 第一次遇到某件事才講一次的提示。
  function tip(id) {
    if (meta.seen[id] || AUTO) return;
    meta.seen[id] = 1;
    R.saveMeta(meta);
    toast(t('s3.tip.' + id), 'tip');
  }

  // ===== 劇情對話：一句一句播，點一下或按空白鍵換下一句，Esc 整段跳過 =====
  // lines：[{ who, k }]。o：{ vars 台詞裡的變數, bg 背景插圖（S3.pictures 的 key）, banner 畫面上方的大字 }。
  let talkState = null;
  function talk(lines, o, done) {
    if (AUTO || !lines || !lines.length) { done(); return; }
    const back = mode;
    for (const k of Object.keys(keys)) keys[k] = false;
    mode = 'talk';
    talkState = { lines, i: -1, vars: (o && o.vars) || lineVars(), done, back, full: '', shown: 0, timer: null };
    const bg = o && o.bg && pictures[o.bg];
    $('talk-bg').style.backgroundImage = bg ? `url("${bg}")` : 'none';
    $('s3-talk').className = bg ? 'has-bg' : '';
    $('talk-banner').textContent = (o && o.banner) || '';
    $('s3-talk').hidden = false;
    talkNext();
  }
  function talkNext() {
    const st = talkState;
    if (!st) return;
    // 字還沒跑完：先把整句顯示出來。
    if (st.timer) { clearInterval(st.timer); st.timer = null; $('talk-text').textContent = st.full; return; }
    st.i++;
    if (st.i >= st.lines.length) { talkEnd(); return; }
    const l = st.lines[st.i];
    $('talk-face').innerHTML = l.who ? portrait(l.who) : '';
    $('talk-who').textContent = l.who ? t('s3.who.' + l.who) : '';
    $('talk-box').className = 'talk-box' + (l.who ? ' who-' + l.who : ' narr');
    st.full = t(lineKey(l), st.vars);
    st.shown = 0;
    const el = $('talk-text');
    el.textContent = '';
    const step = E.i18n.lang === 'en' ? 3 : 1;
    st.timer = setInterval(() => {
      st.shown = Math.min(st.full.length, st.shown + step);
      el.textContent = st.full.slice(0, st.shown);
      if (st.shown >= st.full.length) { clearInterval(st.timer); st.timer = null; }
    }, 22);
    play('click');
  }
  function talkEnd() {
    const st = talkState;
    if (!st) return;
    if (st.timer) clearInterval(st.timer);
    talkState = null;
    $('s3-talk').hidden = true;
    mode = st.back;
    acc = 0;
    st.done();
  }
  $('s3-talk').addEventListener('click', () => { sfx.unlock(); talkNext(); });
  // 只播一次的劇情段落（記在永久進度裡）。
  function beat(id, o, next) {
    const lines = ST.beats[id];
    if (!lines || meta.story[id] || AUTO) { next(); return; }
    meta.story[id] = 1;
    R.saveMeta(meta);
    talk(lines, o, next);
  }

  // ===== 無線電：打的時候插進來的一句，不暫停 =====
  let commBusy = 0, commT = null;
  const commLast = {};
  // force：重要的話（有人倒下）不管上一句講完了沒有，直接蓋過去。
  function comm(kind, vars, force) {
    const c = ST.comms[kind];
    if (!c || AUTO || !s) return;
    const now = performance.now();
    if (!force && (now < commBusy || now - (commLast[kind] || -1e9) < 20000)) return;
    commLast[kind] = now;
    commBusy = now + 4200;
    const el = $('s3-comms');
    el.innerHTML = `<span class="cm-face">${portrait(c.who)}</span><span class="cm-body"><b>${esc(t('s3.who.' + c.who))}</b><span>${esc(t(oneOf(c.k), Object.assign(lineVars(), vars)))}</span></span>`;
    el.className = 'show who-' + c.who;
    clearTimeout(commT);
    commT = setTimeout(() => { el.className = ''; }, 4200);
    play('click');
  }

  // ===== 標題 =====
  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('.lang-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === E.i18n.lang)));
    document.title = E.i18n.lang === 'en' ? 'ZERO DAY' : t('s3.ui.title') + ' ZERO DAY';
    $('s3-sound').textContent = sfx.muted ? '🔇' : '🔊';
    for (const k of Object.keys(hudCache)) delete hudCache[k];
  }
  function setLang(code) {
    if (!E.i18n.set(code)) return;
    try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* 忽略 */ }
    applyLang();
    if (mode === 'lobby') renderLobby();
  }
  function showTitle() {
    mode = 'title';
    run = null; s = null;
    S3.music.set(null);
    $('s3-game').hidden = true;
    $('s3-lobby').hidden = true;
    $('s3-title').hidden = false;
    closeModal();
    $('s3-continue').hidden = !R.load();
    $('s3-echoes').textContent = meta.echoes || meta.runs ? t('s3.ui.record', { echoes: meta.echoes, runs: meta.runs, wins: meta.wins }) : '';
  }

  // ===== 安全屋：名冊、今晚的小隊、想加入的人、永久強化 =====
  // 還沒進基石的人長什麼樣：這個人的裝備和能力（含永久強化）。
  function preview(p) {
    const m = R.memberOf(p);
    const extra = { maxHp: 8 * R.perkLv(meta, 'hp'), bwMax: R.perkLv(meta, 'bw'), focusMul: R.perkLv(meta, 'focus') ? 1.2 : 1 };
    const st = sim.stats({ person: p, cat: m.cat, job: m.job, weapon: m.weapon, skills: p.skills, traits: p.traits, flaw: p.flaw, quirks: p.quirks, exploits: {}, extra, gadgets: [m.gadget] }).st;
    return { m, st };
  }
  function personCard(p, o) {
    const { m, st } = preview(p);
    const line = (cls, name, key) => `<li class="${cls}"><b>${esc(name)}</b> — ${esc(t(key))}</li>`;
    const traits = E.people.traitsOf(p).map((x) => line('good', L(x.name), 's3.trait.' + x.id)).join('');
    const flaw = p.flaw ? line('bad', L(E.people.flawOf(p).name), 's3.flaw.' + p.flaw) : '';
    const quirks = E.people.quirksOf(p).filter((q) => D.quirkFx[q.id]).map((q) => line('quirk', L(q.name), 's3.quirk.' + q.id)).join('');
    return `<article class="crew-card cat-${m.cat}${p.rare ? ' rare' : ''}${o.cls ? ' ' + o.cls : ''}" ${o.attr || ''}>
      <div class="crew-head"><div class="crew-face">${E.faces.of(p)}</div>
        <div class="crew-id"><h3>${esc(nameOf(p))}</h3><p>${esc(t('s3.card.job', { age: p.age, job: jobOf(p) }))}</p>
        <p class="crew-stats"><span>${esc(t('s3.hud.hp'))} <b>${st.maxHp}</b></span><span>${esc(t('s3.hud.bw'))} <b>${st.bwMax}</b></span></p></div>
        ${o.badge ? `<span class="crew-badge">${esc(o.badge)}</span>` : ''}</div>
      <div class="crew-kit">
        <p><span class="k">${esc(t('s3.card.perk'))}</span><b class="perk-line">${esc(t('s3.job.' + m.job))}</b></p>
        <p><span class="k">${esc(t('s3.card.weapon'))}</span><b>${esc(t('s3.wp.' + m.weapon + '.n'))}</b><span class="dim"> ${esc(t('s3.wp.' + m.weapon + '.d'))}</span></p>
        <p><span class="k">${esc(t('s3.card.gadget'))}</span><b>${esc(gadName(m.gadget.id))}</b><span class="dim"> ${esc(t('s3.gad.' + m.gadget.id + '.d'))}</span></p>
      </div>
      <ul class="crew-traits">${traits}${flaw}${quirks}</ul>
      ${o.foot || ''}
    </article>`;
  }
  // 進安全屋：補人、預先選好上一次的小隊、挑一句閒聊。
  function enterLobby() {
    meta = R.meta();
    // 打完《宵禁》的人，第一次進來時那一輪的隊伍會跟過來。
    const vets = R.inherit(meta);
    const came = R.ensureRoster(meta);
    R.saveMeta(meta);
    lobbyNote = vets ? { vets } : came.length && meta.runs ? { came } : null;
    if (!params.get('seed')) seed = fresh();
    const ready = meta.roster.map((x, i) => i).filter((i) => meta.roster[i].status === 'ready');
    const lastSquad = meta.squad || [];
    picks = ready.filter((i) => lastSquad.includes(pid(meta.roster[i].p))).slice(0, R.SQUAD);
    for (const i of ready) if (picks.length < R.SQUAD && !picks.includes(i)) picks.push(i);
    const held = meta.roster.filter((x) => x.status === 'held').length;
    const pool = vets ? ST.hub.vets : held && Math.random() < 0.6 ? ST.hub.held : meta.story.ended && Math.random() < 0.4 ? ST.hub.won : ST.hub.any;
    hubLine = { l: oneOf(pool), vars: { n: held } };
    mode = 'lobby';
    S3.music.set(null);
    $('s3-title').hidden = true;
    $('s3-game').hidden = true;
    $('s3-lobby').hidden = false;
    $('s3-lobby').scrollTop = 0;
    renderLobby();
  }
  // 名冊上面那一行：誰新來了。存的是人，不是字，換語言的時候才會跟著換。
  function noteHtml() {
    if (!lobbyNote) return '';
    const names = (list) => listOf(list.map(nameOf));
    const lines = [];
    if (lobbyNote.came) lines.push(t('s3.roster.new', { names: names(lobbyNote.came) }));
    if (lobbyNote.vets && lobbyNote.vets.ready.length) lines.push(t('s3.roster.vets', { names: names(lobbyNote.vets.ready) }));
    if (lobbyNote.vets && lobbyNote.vets.held.length) lines.push(t('s3.roster.vetsHeld', { names: names(lobbyNote.vets.held) }));
    return lines.map((x) => `<p class="notice">${esc(x)}</p>`).join('');
  }
  function renderLobby() {
    const max = R.rosterMax(meta), readyN = meta.roster.filter((x) => x.status === 'ready').length;
    $('s3-hub').innerHTML = `<span class="hub-face">${portrait(hubLine.l.who)}</span><span class="hub-body"><b>${esc(t('s3.who.' + hubLine.l.who))}</b><span>${esc(t(lineKey(hubLine.l), hubLine.vars))}</span></span>`;
    const cards = meta.roster.map((x, i) => {
      const n = picks.indexOf(i), held = x.status === 'held';
      const foot = `<div class="crew-foot"><span class="dim">${x.veteran ? `<b class="vet">${esc(t('s3.roster.vet'))}</b>　` : ''}${x.runs ? esc(t('s3.roster.runs', { n: x.runs })) : ''}</span>${!held && readyN > R.SQUAD ? `<button type="button" class="ghost small" data-dismiss="${i}">${esc(t('s3.roster.dismiss'))}</button>` : ''}</div>`;
      return personCard(x.p, {
        cls: held ? 'held' : n >= 0 ? 'picked' : 'pickable', attr: held ? '' : `data-roster="${i}" role="button" tabindex="0"`,
        badge: held ? t('s3.roster.held') : n >= 0 ? t('s3.roster.picked', { n: n + 1 }) : t('s3.roster.pick'), foot,
      });
    }).join('');
    $('s3-roster').innerHTML = `<h3>${esc(t('s3.roster.title'))}<small>${esc(t('s3.roster.count', { n: meta.roster.length, max }))}</small></h3>
      ${noteHtml()}<div class="crew">${cards}</div>`;
    const full = meta.roster.length >= max;
    const vols = R.volunteers(meta).map((p, i) => personCard(p, {
      cls: 'vol', foot: `<div class="crew-foot"><span></span><button type="button" data-vol="${i}" ${full || meta.echoes < R.RECRUIT_COST ? 'disabled' : ''}>${esc(full ? t('s3.vol.full') : t('s3.vol.join', { n: R.RECRUIT_COST }))}</button></div>`,
    })).join('');
    $('s3-vols').innerHTML = `<h3>${esc(t('s3.vol.title'))}<small>${esc(t('s3.ui.echoes', { n: meta.echoes }))}</small></h3><p class="dim">${esc(t('s3.vol.hint', { n: R.RECRUIT_COST }))}</p><div class="crew">${vols}</div>`;
    $('s3-perks').innerHTML = `<h3>${esc(t('s3.ui.lobby.perks'))}<small>${esc(t('s3.ui.echoes', { n: meta.echoes }))}</small></h3>` + D.perks.map((p) => {
      const lv = R.perkLv(meta, p.id), isFull = lv >= p.max, cost = p.cost[lv];
      return `<button type="button" class="perk${isFull ? ' full' : ''}" data-perk="${p.id}" ${isFull || meta.echoes < cost ? 'disabled' : ''}>
        <b>${esc(t('s3.perk.' + p.id + '.n'))}</b><span>${esc(t('s3.perk.' + p.id + '.d'))}</span>
        <i>${'●'.repeat(lv)}${'○'.repeat(p.max - lv)}　${isFull ? esc(t('s3.perk.max')) : esc(t('s3.perk.buy', { n: cost }))}</i></button>`;
    }).join('');
    const slots = Array.from({ length: R.SQUAD }, (_, n) => {
      const x = meta.roster[picks[n]];
      return `<span class="slot${x ? ' on' : ''}"><kbd>${n + 1}</kbd>${x ? `<span class="slot-face">${E.faces.of(x.p, { round: true })}</span><b>${esc(nameOf(x.p))}</b>` : '<i></i>'}</span>`;
    }).join('');
    const need = R.SQUAD - picks.length;
    $('s3-squadbar').innerHTML = `<span class="k">${esc(t('s3.squad.title'))}</span>${slots}<span class="bar-note">${esc(need ? t('s3.roster.need', { n: need }) : t('s3.roster.ready'))}</span>
      <button type="button" id="s3-go" class="primary" ${need ? 'disabled' : ''}>${esc(t('s3.ui.lobby.go'))}</button>`;
  }
  function togglePick(i) {
    const at = picks.indexOf(i);
    if (at >= 0) picks.splice(at, 1);
    else if (picks.length < R.SQUAD) picks.push(i);
    else { picks.shift(); picks.push(i); }
    renderLobby();
  }
  $('s3-lobby').addEventListener('click', (e) => {
    const dis = e.target.closest('[data-dismiss]'), vol = e.target.closest('[data-vol]'), perk = e.target.closest('[data-perk]'), card = e.target.closest('[data-roster]');
    sfx.unlock();
    if (dis) {
      const i = Number(dis.dataset.dismiss);
      if (R.dismiss(meta, i)) { play('click'); picks = picks.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)); renderLobby(); }
    } else if (vol && !vol.disabled) { if (R.recruit(meta, Number(vol.dataset.vol))) { play('gain'); renderLobby(); } }
    else if (perk && !perk.disabled) { if (R.buyPerk(meta, perk.dataset.perk)) { play('gain'); renderLobby(); } }
    else if (e.target.id === 's3-go') { if (picks.length === R.SQUAD) { play('title'); beginRun(); } }
    else if (e.target.id === 's3-lobby-back') { play('click'); showTitle(); }
    else if (card) { play('click'); togglePick(Number(card.dataset.roster)); }
  });
  $('s3-lobby').addEventListener('keydown', (e) => {
    const card = e.target.closest && e.target.closest('[data-roster]');
    if (card && e.target === card && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); togglePick(Number(card.dataset.roster)); }
  });

  // ===== 開始、接續 =====
  function showGame() {
    $('s3-title').hidden = true;
    $('s3-lobby').hidden = true;
    $('s3-game').hidden = false;
    mode = 'menu';
    V.resize();
    for (const k of Object.keys(hudCache)) delete hudCache[k];
  }
  function beginRun(people) {
    people = people || picks.map((i) => meta.roster[i].p);
    meta.squad = people.map(pid);
    R.saveMeta(meta);
    run = R.start(seed, people, meta);
    R.save(run);
    showGame();
    const go = () => showRoute(true);
    if (!meta.seen.controls && !AUTO) { meta.seen.controls = 1; R.saveMeta(meta); showControls(go); } else go();
  }
  // 按「開始」：手上還有沒打完的一趟就先結掉（倒下的人照樣被帶走），第一次會先播開場，然後進安全屋。
  function startFresh() {
    const old = R.load();
    if (old) { R.finish(old, false, meta); meta = R.meta(); }
    beat('intro', { bg: 'title', vars: {} }, enterLobby);
  }
  function resume() {
    run = R.load();
    if (!run) { enterLobby(); return; }
    seed = run.seed;
    showGame();
    if (run.phase === 'room') startRoom(R.spec(run));
    else if (run.phase === 'reward' && run.pending) showReward(run.pending, afterNode);
    else if (run.phase === 'shop' || run.phase === 'safe' || run.phase === 'event') showNode();
    else if (run.phase === 'done' || run.phase === 'doors') afterNode();
    else showRoute(true);
  }
  function controlsHtml() {
    const rows = ['move', 'aim', 'fire', 'hack', 'dash', 'focus', 'melee', 'swap', 'gadget', 'reload', 'pause'];
    return `<div class="controls">${rows.map((k) => `<div><kbd>${esc(t('s3.ctl.' + k + '.k'))}</kbd><span>${esc(t('s3.ctl.' + k))}</span></div>`).join('')}</div>`;
  }
  function showControls(next) {
    modal(`<h2>${esc(t('s3.ctlbox.title'))}</h2>${controlsHtml()}<div class="s3-actions"><button type="button" class="primary" data-act="go">${esc(t('s3.ctlbox.go'))}</button></div>`, () => { closeModal(); next(); }, 'wide');
  }

  // ===== 路線 =====
  function doorInfo(o) {
    const lost = R.statsOf(run, run.active).fl.lost;
    const fight = o.type === 'fight' || o.type === 'elite';
    return {
      title: t('s3.node.' + o.type),
      sub: fight || o.type === 'cells' ? t('s3.rw.' + o.reward) : o.type === 'boss' ? t('s3.boss.' + D.sectors[run.sector].boss + '.n') : '',
      mod: fight ? (lost ? t('s3.route.unknown') : o.mod ? t('s3.mod.' + o.mod + '.n') : '') : '',
      modD: fight && o.mod && !lost ? t('s3.mod.' + o.mod + '.d') : '',
      color: o.type === 'elite' ? V.C.warn : o.type === 'boss' ? V.C.bad : o.type === 'cells' ? V.C.pink : o.type === 'fight' ? V.C.white : V.C.green,
    };
  }
  // 不在房間裡的時候（剛開始、逛完黑市之後）用卡片選門；在房間裡就直接走進門。
  function showRoute(first) {
    const sec = D.sectors[run.sector];
    const cards = run.options.map((o, i) => {
      const d = doorInfo(o);
      return `<button type="button" class="s3-card door type-${o.type}" data-act="door" data-id="${i}">
        <span class="card-top"><span class="tag">${esc(t('s3.route.door', { n: i + 1 }))}</span></span>
        <b>${esc(d.title)}</b><span class="card-d">${esc(d.sub)}${d.sub ? '<br>' : ''}${esc(t('s3.node.' + o.type + '.d'))}</span>
        <span class="card-foot mod">${d.mod ? esc(d.mod) + (d.modD ? '：' + esc(d.modD) : '') : ''}</span></button>`;
    }).join('');
    S3.music.set('calm');
    modal(`<h2>${esc(t('s3.sec.' + sec.id + '.n'))}<small>${esc(t('s3.hud.room', { n: run.roomNo + 1 }))}</small></h2>
      <p class="dim">${esc(first && run.roomNo === 0 ? t('s3.sec.' + sec.id + '.d') : t('s3.route.hint'))}</p>
      <div class="s3-cards">${cards}</div>${squadSummary()}`, (act, id) => { if (act === 'door') { closeModal(); enterDoor(Number(id)); } }, 'wide');
  }
  function enterDoor(i) {
    const spec = R.enter(run, i);
    R.save(run);
    play('door');
    if (spec) startRoom(spec); else showNode();
  }
  // 律師把人保出來之類的事：流程記在 run.notes 裡，這裡講出來。
  function flushNotes() {
    for (const n of run.notes.splice(0)) if (n.k === 'bail') toast(t('s3.toast.bail', { name: nameOf(run.squad[n.i].p) }), 'good');
  }
  function showNode() {
    S3.music.set('calm');
    flushNotes();
    if (run.phase === 'shop') showShop();
    else if (run.phase === 'safe') showSafe();
    else if (run.phase === 'event') showEvent();
    else afterNode();
  }
  // 節點結束：算下一批門。打倒核心就進結局。
  function afterNode() {
    if (run.phase === 'reward' && run.pending) { showReward(run.pending, afterNode); return; }
    const ph = R.advance(run);
    R.save(run);
    if (ph === 'won') { showFinale(); return; }
    if (s && mode !== 'title' && s.cleared && !s.over && s.exit < 0 && inRoom) { closeModal(); s.doorsOpen = true; mode = 'play'; play('door'); tip('doors'); }
    else showRoute();
  }

  // ===== 房間 =====
  function startRoom(spec) {
    closeModal();
    s = sim.createRoom(spec, R.simBuild(run), R.carry(run));
    bot = AUTO ? S3.bot.create(seed + ':' + run.roomNo) : null;
    V.reset();
    mode = 'play';
    inRoom = true;
    paused = false; rewarded = false; deadT = 0; acc = 0; lowSaid = false; predictT = 9;
    for (const k of Object.keys(keys)) keys[k] = false;
    for (const k of Object.keys(hudCache)) delete hudCache[k];
    S3.music.set(spec.boss ? 'boss' : 'calm');
    sfx.ambient('tac', 0.2);
    const sec = D.sectors[run.sector];
    const begin = () => {
      toast(spec.boss ? t('s3.boss.' + spec.boss + '.n') : t('s3.sec.' + sec.id + '.n') + '　' + t('s3.hud.room', { n: run.roomNo }) + (spec.mod ? '　' + t('s3.mod.' + spec.mod + '.n') : ''), spec.boss ? 'boss' : '');
      if (run.roomNo === 1) setTimeout(() => tip('stealth'), 2800);
      // 新區段的第一間：多講一句這一區有什麼。
      else if (run.depth === 0 && !spec.boss) setTimeout(() => { if (s && s.spec === spec && !AUTO) toast(t('s3.sec.' + sec.id + '.d'), 'tip'); }, 2800);
    };
    if (spec.boss) bossIntro(spec.boss, begin);
    else if (run.depth === 0 && ST.sectorBeats[sec.id]) beat(ST.sectorBeats[sec.id], {}, begin);
    else begin();
  }
  // 首領登場：整張插圖加名字。第一次見面播完整的一段，之後每次只講一句。
  function bossIntro(id, next) {
    const bb = ST.bossBeats[id], o = { bg: 'boss-' + id, banner: t('s3.boss.' + id + '.n') };
    play('s3phase');
    if (bb.meet && !meta.story[bb.meet]) beat(bb.meet, o, next);
    else talk([{ who: bb.who, k: oneOf(bb.again) }], o, next);
  }
  function roomCleared() {
    rewarded = true;
    const boss = s.spec.boss;
    const rw = R.finishRoom(run, s);
    R.save(run);
    S3.music.set('calm');
    flushNotes();
    if (rw.silent) { toast(t('s3.hud.silent', { n: rw.bonus }), 'good'); comm('silent'); }
    const next = () => showReward(rw, afterNode);
    const bb = boss && ST.bossBeats[boss];
    if (bb && bb.down) beat(bb.down, { bg: 'boss-' + boss }, next); else next();
  }
  function showReward(rw, next) {
    const done = (choice) => { R.take(run, choice); R.save(run); closeModal(); next(); };
    if (rw.kind === 'rescue') { showRescue(next); return; }
    // 最後一個首領：後面沒有房間了，不用挑漏洞。
    if (rw.boss && run.sector >= D.sectors.length - 1) { done(null); return; }
    if (!rw.picks) {
      // 資料、治療、體力上限：直接給。
      R.take(run, null);
      R.save(run);
      play('gain');
      toast(t('s3.rw.got.' + rw.kind, { n: rw.kind === 'heal' ? Math.round(rw.n * 100) : rw.n }), 'good');
      next();
      return;
    }
    play('event');
    const gad = rw.kind === 'gadget';
    const cards = rw.picks.map((id) => (gad ? gadgetCard(id) : exploitCard(id))).join('');
    modal(`<h2>${esc(t(gad ? 's3.rw.title.gadget' : rw.boss ? 's3.rw.title.boss' : 's3.rw.title'))}</h2>
      <p class="dim">${esc(t('s3.rw.pick'))}${rw.bonus ? '　' + esc(t(rw.silent ? 's3.rw.bonus.silent' : 's3.rw.bonus', { n: rw.bonus })) : ''}</p>
      <div class="s3-cards">${cards}</div>
      <div class="s3-actions"><button type="button" data-act="reroll" ${run.rerolls > 0 ? '' : 'disabled'}>${esc(t('s3.rw.reroll', { n: run.rerolls }))}</button>
      <button type="button" class="ghost" data-act="skip">${esc(t('s3.rw.skip'))}</button></div>${squadSummary()}`, (act, id) => {
      if (act === 'reroll') { if (R.reroll(run)) { R.save(run); showReward(run.pending, next); } }
      else if (act === 'skip') done(null);
      else if (act === 'pick') {
        if (gad && replacesGear(id)) askGear(id, () => { play('gain'); done(id); }, () => showReward(rw, next));
        else { play('gain'); done(id); }
      }
    }, 'wide');
  }
  // 共用的那一格已經有裝備：確定要換掉嗎？
  function askGear(id, yes, back) {
    modal(`<h2>${esc(t('s3.gad.replace'))}</h2><p>${esc(t('s3.gad.replace.d', { old: gadName(run.gear.id), name: gadName(id) }))}</p>
      <div class="s3-actions"><button type="button" class="ghost" data-act="back">${esc(t('s3.ui.back'))}</button><button type="button" class="primary" data-act="yes">${esc(t('s3.ui.ok'))}</button></div>`, (act) => { if (act === 'yes') yes(); else back(); });
  }
  // 拘留室：救出一個人。名冊裡有人被關就先救自己人，不然是名單上的陌生人。
  function showRescue(next) {
    const res = R.rescue(run, AUTO ? null : meta);
    R.save(run);
    if (!res || AUTO) { next(); return; }
    play('gain');
    comm('rescue', {}, true);
    const name = nameOf(res.p);
    const lines = [t(res.known ? 's3.rescue.known' : 's3.rescue.new', { name, job: jobOf(res.p) })];
    if (res.joined) lines.push(t('s3.rescue.joined', { name, n: res.slot + 1 }));
    if (res.full) lines.push(t('s3.rescue.full', { name }));
    const show = () => modal(`<div class="ev"><div class="ev-face">${E.faces.of(res.p)}</div><div><h2>${esc(t('s3.rescue.title'))}</h2>${lines.map((x) => `<p>${esc(x)}</p>`).join('')}
      <p class="perk-line">${esc(t('s3.job.' + R.memberOf(res.p).job))}</p></div></div>
      <div class="s3-actions"><button type="button" class="primary" data-act="ok">${esc(t('s3.ui.ok'))}</button></div>`, () => { closeModal(); next(); });
    beat('cells', {}, show);
  }

  // ===== 黑市、維修間、事件 =====
  function showShop() {
    const sh = run.shop;
    const cards = sh.items.map((it, i) => {
      const o = { act: 'buy', i, price: it.price, sold: it.sold, disabled: it.sold || run.data < it.price };
      if (it.k === 'exploit') return exploitCard(it.id, o);
      if (it.k === 'gadget') return gadgetCard(it.id, o);
      return `<button type="button" class="s3-card heal${it.sold ? ' sold' : ''}" data-act="buy" data-id="${i}" ${o.disabled || !R.hurtSomeone(run) ? 'disabled' : ''}><span class="card-top"><span class="tag tag-body">${esc(t('s3.tag.body'))}</span></span><b>${esc(t('s3.shop.heal'))}</b><span class="card-d">${esc(t('s3.shop.heal.d', { n: it.n }))}</span><span class="card-foot"><span class="price">${it.sold ? esc(t('s3.shop.sold')) : '◆ ' + it.price}</span></span></button>`;
    }).join('');
    modal(`<h2>${esc(t('s3.shop.title'))}</h2><p class="dim">${esc(t('s3.shop.hint'))}</p><div class="s3-cards">${cards}</div>
      <div class="s3-actions"><button type="button" data-act="restock" ${run.data >= sh.reroll ? '' : 'disabled'}>${esc(t('s3.shop.reroll', { n: sh.reroll }))}</button>
      <button type="button" class="primary" data-act="leave">${esc(t('s3.shop.leave'))}</button></div>${squadSummary()}`, (act, i) => {
      if (act === 'leave') { run.phase = 'done'; closeModal(); afterNode(); }
      else if (act === 'restock') { if (R.restock(run)) { R.save(run); showShop(); } }
      else if (act === 'buy') {
        const it = sh.items[Number(i)];
        const finish = () => { if (R.buy(run, Number(i))) { play('gain'); R.save(run); } showShop(); };
        if (it.k === 'gadget' && replacesGear(it.id)) askGear(it.id, finish, showShop); else finish();
      }
    }, 'wide');
  }
  function showSafe() {
    const opt = (id) => `<button type="button" class="s3-card safe" data-act="${id}" ${id === 'rest' && !R.hurtSomeone(run) ? 'disabled' : ''}><b>${esc(t('s3.safe.' + id))}</b><span class="card-d">${esc(t('s3.safe.' + id + '.d'))}</span></button>`;
    modal(`<h2>${esc(t('s3.safe.title'))}</h2><p>${esc(t('s3.safe.text'))}</p><div class="s3-cards">${opt('rest')}${opt('tune')}${opt('train')}</div>${squadSummary()}`, (act) => {
      R.safe(run, act);
      R.save(run);
      play('gain');
      closeModal();
      afterNode();
    }, 'wide');
  }
  function showEvent() {
    const ev = run.event, def = R.eventDef(ev.id);
    const pic = pictures['ev-' + ev.id] ? `<img class="ev-pic" src="${pictures['ev-' + ev.id]}" alt="">` : '';
    const face = pic ? '' : `<div class="ev-face">${E.art.avatar(def.cameo)}</div>`;
    if (ev.result) {
      modal(`${pic}<div class="ev">${face}<div><h2>${esc(t('s3.ev.' + ev.id + '.t'))}</h2><p>${esc(t(ev.result.key))}</p>${fxLine(ev.result.fx)}</div></div>
        <div class="s3-actions"><button type="button" class="primary" data-act="ok">${esc(t('s3.ui.ok'))}</button></div>`, () => { closeModal(); afterNode(); }, pic ? 'pic' : '');
      return;
    }
    play(EVENT_SOUND[def.cameo] || 'event');
    const btn = (i) => `<button type="button" data-act="c" data-id="${i}" ${R.canChoose(run, i) ? '' : 'disabled'} class="${i ? '' : 'primary'}">${esc(t('s3.ev.' + ev.id + '.c' + i))}${def.choices[i].cost ? '（◆ ' + def.choices[i].cost + '）' : ''}</button>`;
    modal(`${pic}<div class="ev">${face}<div><h2>${esc(t('s3.ev.' + ev.id + '.t'))}</h2><p>${esc(t('s3.ev.' + ev.id + '.x'))}</p></div></div>
      <div class="s3-actions">${btn(0)}${btn(1)}</div>${squadSummary()}`, (act, i) => {
      const c = def.choices[Number(i)], g = c.fx && c.fx.gadget;
      const go = () => { R.choose(run, Number(i)); R.save(run); showEvent(); };
      if (g && replacesGear(g)) askGear(g, go, showEvent); else go();
    }, pic ? 'pic' : '');
  }
  // 事件結果下面那一行：實際拿到、失去什麼。
  function fxLine(fx) {
    const out = [];
    if (fx.data) out.push(t('s3.fx.data', { n: fx.data }));
    if (fx.heal) out.push(t('s3.fx.heal', { n: fx.heal }));
    if (fx.hurt) out.push(t('s3.fx.hurt', { n: fx.hurt }));
    if (fx.maxHp) out.push(t(fx.maxHp > 0 ? 's3.fx.maxHp' : 's3.fx.maxHpDown', { n: Math.abs(fx.maxHp) }));
    if (fx.maxBw) out.push(t('s3.fx.maxBw', { n: fx.maxBw }));
    if (fx.rerolls) out.push(t('s3.fx.rerolls', { n: fx.rerolls }));
    if (fx.gadget) out.push(t('s3.fx.gadget', { name: gadName(fx.gadget) }));
    if (fx.exploit) out.push(t('s3.fx.exploit', { name: exName(fx.exploit) }));
    if (fx.curse) out.push(t('s3.fx.curse'));
    if (fx.draft) out.push(t('s3.fx.draft'));
    for (const id of fx.lost || []) out.push(t('s3.fx.lost', { name: exName(id) }));
    for (const id of fx.got || []) out.push(t('s3.fx.exploit', { name: exName(id) }));
    return out.length ? `<p class="fx-line">${out.map(esc).join('　')}</p>` : '';
  }

  // ===== 暫停 =====
  function pause() {
    if (mode !== 'play' || !s || s.over) return;
    paused = true;
    const sec = D.sectors[run.sector];
    modal(`<h2>${esc(t('s3.pause.title'))}<small>${esc(t('s3.sec.' + sec.id + '.n'))}　${esc(t('s3.hud.room', { n: run.roomNo }))}</small></h2>
      ${squadSummary()}${controlsHtml()}${guideHtml()}
      <div class="s3-actions"><div class="lang-switch"><button type="button" data-act="lang" data-id="zh-Hant">繁</button><button type="button" data-act="lang" data-id="zh-Hans">简</button><button type="button" data-act="lang" data-id="en">EN</button></div>
      <button type="button" class="ghost" data-act="quit">${esc(t('s3.pause.quit'))}</button><button type="button" class="primary" data-act="resume">${esc(t('s3.pause.resume'))}</button></div>`, (act, id) => {
      if (act === 'resume') unpause();
      else if (act === 'lang') { setLang(id); paused = false; mode = 'play'; pause(); }
      else if (act === 'quit') {
        // 撤退：這一間裡已經倒下的人還是被帶走了。
        if (!rewarded) sim.teamState(s).forEach((tm, i) => { if (tm.down) run.squad[i].down = true; });
        closeModal();
        showEnd(false, true);
      }
    }, 'wide');
    applyLang();
    onModalKey = (e) => { if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Tab') { e.preventDefault(); unpause(); } };
  }
  function unpause() { closeModal(); paused = false; mode = 'play'; acc = 0; }
  // 敵人和設施的簡短說明。
  function guideHtml() {
    const foes = Object.keys(D.enemies).filter((k) => D.enemies[k].from <= (run ? run.roomNo + 1 : 99));
    const row = (k, pre) => `<div><b>${esc(t(pre + k + '.n'))}</b><span>${esc(t(pre + k + '.d'))}</span></div>`;
    return `<details class="guide"><summary>${esc(t('s3.pause.guide'))}</summary><div class="guide-grid">${foes.map((k) => row(k, 's3.en.')).join('')}</div>
      <div class="guide-grid">${['junction', 'vent', 'barrel', 'car', 'bollard', 'camera', 'speaker'].map((k) => row(k, 's3.prop.')).join('')}</div></details>`;
  }

  // ===== 結局和結算 =====
  // 核心停了：先播一段，再選要怎麼處理基石，然後播那個結局。
  function showFinale() {
    inRoom = false;
    S3.music.set(null);
    sfx.ambient(null);
    if (AUTO) { showEnd(true, false, 'return'); return; }
    talk(ST.beats.choice, { bg: 'boss-keystone' }, chooseEnding);
  }
  function chooseEnding() {
    mode = 'menu';
    const cards = ST.endings.map((e) => {
      const lack = (e.need || 0) - (meta.rescued || 0);
      return `<button type="button" class="s3-card ending end-${e.id}" data-act="end" data-id="${e.id}" ${lack > 0 ? 'disabled' : ''}>
        <b>${esc(t('s3.end.' + e.id + '.c'))}</b><span class="card-d">${esc(t('s3.end.' + e.id + '.d'))}</span>
        <span class="card-foot mod">${lack > 0 ? esc(t('s3.end.teach.lock', { n: lack })) : meta.endings[e.id] ? '✓' : ''}</span></button>`;
    }).join('');
    modal(`<h2>${esc(t('s3.end.choose'))}</h2><div class="s3-cards">${cards}</div>`, (act, id) => {
      const e = ST.endings.find((x) => x.id === id);
      if (!e) return;
      closeModal();
      meta.endings[id] = 1;
      meta.story.ended = id;
      R.saveMeta(meta);
      play('ending');
      talk(e.lines, { bg: 'title', banner: t('s3.end.' + id + '.t'), vars: {} }, () => showEnd(true, false, id));
    }, 'wide');
  }
  function showEnd(won, quit, ending) {
    const lastName = run.squad[run.active] ? nameOf(run.squad[run.active].p) : '';
    // 機器人模式不動存檔。
    const res = AUTO ? { earned: 0, meta, captured: run.squad.filter((m) => m.down).map((m) => m.p), freed: 0 } : R.finish(run, won, meta);
    meta = res.meta;
    const st = run.stats, sec = D.sectors[run.sector];
    S3.music.set(null);
    sfx.ambient(null);
    if (!won) play(quit ? 'loss' : 'fail');
    inRoom = false;
    const stat = (k, n) => `<div><span>${esc(t('s3.stat.' + k))}</span><b>${n}</b></div>`;
    const title = won ? t('s3.end.' + ending + '.t') : t(quit ? 's3.quit.title' : 's3.dead.title');
    const text = won ? t('s3.win.text') : t(quit ? 's3.dead.quit' : 's3.dead.text', { sector: t('s3.sec.' + sec.id + '.n'), n: run.roomNo });
    const people = won ? (res.freed ? t('s3.end.freed', { n: res.freed }) : '') : res.captured.length ? t('s3.end.captured', { names: listOf(res.captured.map(nameOf)) }) : t('s3.end.safe');
    const show = () => {
      mode = 'menu';
      modal(`<h2 class="${won ? 'win' : 'lose'}">${esc(title)}</h2>
        <p>${esc(text)}</p>${people ? `<p class="${won ? 'good' : 'warn'}">${esc(people)}</p>` : ''}
        <div class="stats">${stat('rooms', st.rooms)}${stat('kills', st.kills)}${stat('hacks', st.hacks)}${stat('takedowns', st.takedowns)}${stat('silent', st.silent)}${stat('bosses', st.bosses)}${stat('rescued', st.rescued)}${stat('captured', res.captured.length)}</div>
        <p class="echo-gain">${esc(t('s3.dead.echoes', { n: res.earned, total: meta.echoes }))}</p>${won ? `<p class="dim">${esc(t('s3.end.note'))}</p>` : ''}
        <div class="s3-actions"><button type="button" class="ghost" data-act="title">${esc(t('s3.dead.title.btn'))}</button><button type="button" class="primary" data-act="again">${esc(t('s3.dead.again'))}</button></div>`, (act) => {
        closeModal();
        s = null; run = null;
        if (act === 'again') enterLobby(); else showTitle();
      }, 'wide end');
    };
    // 第一次全隊被捕：講清楚人沒事、要去哪裡救。
    if (!won && !quit) beat('first_fall', { vars: { name: lastName } }, show); else show();
  }

  // ===== 狀態列 =====
  function set(id, value, prop = 'textContent') {
    if (hudCache[id + prop] === value) return;
    hudCache[id + prop] = value;
    const el = $(id);
    if (prop === 'width') el.style.width = value; else el[prop] = value;
  }
  function hud() {
    const p = s.p, st = s.st, live = !rewarded;
    const me = run.squad[activeIdx()];
    if (hudCache.faceKey !== pid(me.p)) { hudCache.faceKey = pid(me.p); $('h-face').innerHTML = E.faces.of(me.p, { round: true }); }
    set('h-face', 'cat-' + me.cat, 'className');
    set('h-name', nameOf(me.p) + '　' + jobOf(me.p));
    set('h-hp', Math.max(0, (p.hp / p.maxHp) * 100).toFixed(1) + '%', 'width');
    set('h-hp-v', Math.ceil(Math.max(0, p.hp)) + ' / ' + p.maxHp);
    const full = Math.floor(p.bw + 0.001), part = p.bw - full;
    set('h-bw', Array.from({ length: st.bwMax }, (_, i) => `<i class="${i < full ? 'on' : ''}" ${i === full ? `style="--fill:${(part * 100).toFixed(0)}%"` : ''}></i>`).join(''), 'innerHTML');
    set('h-focus', ((p.focus / st.focusMax) * 100).toFixed(0) + '%', 'width');
    set('h-focus-box', p.focusLock ? 'bar focus locked' : p.focusing ? 'bar focus on' : 'bar focus', 'className');
    // 小隊：三個人的體力，誰在場上，誰被帶走了。
    const sqKey = run.squad.map((m) => pid(m.p)).join('|') + E.i18n.lang;
    if (hudCache.sqKey !== sqKey) {
      hudCache.sqKey = sqKey;
      $('h-squad').innerHTML = run.squad.map((m, i) => `<div id="sq-${i}" class="sq"><kbd>${i + 1}</kbd><span class="sq-face">${E.faces.of(m.p, { round: true })}</span><span class="sq-n">${esc(nameOf(m.p))}</span><span class="sq-bar"><i id="sq-${i}-hp"></i></span></div>`).join('');
      for (const k of Object.keys(hudCache)) if (k.startsWith('sq-')) delete hudCache[k];
    }
    run.squad.forEach((m, i) => {
      const tm = live ? s.team[i] : null;
      const down = tm ? tm.down : m.down, on = i === activeIdx();
      const hp = down ? 0 : on && live ? p.hp : tm ? tm.hp : m.hp, max = tm ? tm.maxHp : R.maxHp(run, i);
      set('sq-' + i, 'sq' + (on ? ' on' : '') + (down ? ' down' : '') + (!on && !down && live && s.swapCd > 0 ? ' wait' : '') + (!down && hp < max * 0.3 ? ' low' : ''), 'className');
      set('sq-' + i + '-hp', Math.max(0, (hp / max) * 100).toFixed(0) + '%', 'width');
    });
    set('h-data', '◆ ' + (run.data + (live ? s.gain : 0)));
    set('h-ammo', p.reload > 0 ? t('s3.hud.reload') : p.ammo + ' / ' + p.mag);
    set('h-weapon', t('s3.wp.' + s.build.weapon + '.n'));
    set('h-dash', Array.from({ length: st.dashCharges }, (_, i) => `<i class="${i < p.dashN ? 'on' : ''}"></i>`).join(''), 'innerHTML');
    set('h-gad', p.gad.map((g, i) => { const cd = D.gadgets[g.id].cd * (1 - 0.2 * (g.lv - 1)); return `<div class="gad${g.cd > 0 ? ' cd' : ''}"><kbd>${i ? 'E' : 'Q'}</kbd><span>${esc(gadName(g.id))}</span><i style="width:${g.cd > 0 ? ((g.cd / cd) * 100).toFixed(0) : 0}%"></i>${g.cd > 0 ? `<em>${Math.ceil(g.cd)}</em>` : ''}</div>`; }).join(''), 'innerHTML');
    // 狀態：未被發現、被發現、警報、增援、清場
    let status = 'calm', text = t('s3.hud.calm');
    const calling = s.en.filter((e) => e.call > 0 && !e.dead);
    if (s.cleared) { status = 'clear'; text = s.doorsOpen ? t('s3.hud.doors') : t(s.spec.cells ? 's3.hud.clear.cells' : 's3.hud.clear'); }
    else if (s.spec.boss) { status = 'alert'; text = ''; }
    else if (s.alert) { status = 'alert'; text = s.waves.length ? t('s3.hud.wave', { n: s.waves.length, s: Math.max(0, Math.ceil(s.waveT)) }) : t('s3.hud.alert'); }
    else if (calling.length) { status = 'seen'; text = t('s3.hud.seen', { s: Math.min(...calling.map((e) => e.call)).toFixed(1) }); }
    set('h-status', text);
    set('h-status', 'status ' + status, 'className');
    const boss = s.en.find((e) => e.boss && !e.dead);
    set('h-boss', boss ? 'boss show' : 'boss', 'className');
    if (boss) {
      set('h-boss-hp', ((boss.hp / boss.maxHp) * 100).toFixed(1) + '%', 'width');
      const pylons = s.props.filter((q) => q.kind === 'pylon');
      const note = boss.boss === 'carrier' ? t('s3.boss.carrier.s', { n: pylons.filter((q) => q.down <= 0).length }) : boss.boss === 'keystone' ? t(boss.open > 0 ? 's3.boss.keystone.open' : 's3.boss.keystone.shut') : boss.stun > 0 ? t('s3.boss.stunned') : '';
      set('h-boss-n', t('s3.boss.' + boss.boss + '.n') + (note ? '　' + note : ''));
    }
    const sec = D.sectors[run.sector];
    set('h-room', t('s3.sec.' + sec.id + '.n') + '　' + t('s3.hud.room', { n: run.roomNo }) + (s.spec.mod ? '　· ' + t('s3.mod.' + s.spec.mod + '.n') : ''));
    sfx.ambient('tac', s.alert && !s.cleared ? 0.8 : calling.length ? 0.5 : 0.15);
  }
  const ui = { hack: null, takedown: null, doors: null, mouse, hackText: '', takedownText: '' };
  function refreshUi() {
    ui.hack = s.over || s.cleared ? null : sim.pickHack(s, mouse.x, mouse.y);
    if (ui.hack) {
      const h = ui.hack;
      ui.hackText = h.why ? t('s3.why.' + h.why) : t('s3.hack.' + h.act) + (h.cost ? '　−' + h.cost : '　' + t('s3.hack.free'));
      tip('hack');
    }
    ui.takedown = s.over ? null : sim.takedownTarget(s);
    ui.takedownText = ui.takedown ? t('s3.hint.takedown') : '';
    if (ui.takedown) tip('takedown');
    ui.doors = s.doorsOpen && run.options ? run.options.map(doorInfo) : null;
  }

  // ===== 主迴圈 =====
  function stepOnce() {
    let inp;
    if (bot) { bot.state.door = S3.bot.chooseDoor(run); inp = bot.act(s); mouse.x = inp.ax; mouse.y = inp.ay; }
    else {
      inp = {
        mx: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), my: (keys.down ? 1 : 0) - (keys.up ? 1 : 0), ax: mouse.x, ay: mouse.y,
        fire: !!keys.fire, focus: !!keys.focus, dash: !!edge.dash, hack: !!edge.hack, melee: !!edge.melee, g1: !!edge.g1, g2: !!edge.g2, reload: !!edge.reload,
        swap: typeof edge.swap === 'number' ? edge.swap : -1,
      };
    }
    for (const k of Object.keys(edge)) edge[k] = false;
    const wasAlert = s.alert;
    sim.step(s, inp);
    for (const ev of s.ev) {
      V.event(s, ev);
      sound(ev);
      if (ev.k === 'kill') { freeze = Math.max(freeze, ev.boss ? 0.35 : 0.03); if (ev.ambush) tip('trap'); }
      else if (ev.k === 'takedown') freeze = Math.max(freeze, 0.07);
      else if (ev.k === 'hurt') freeze = Math.max(freeze, 0.05);
      else if (ev.k === 'spotted') tip('spotted');
      else if (ev.k === 'denied' && ev.why) toast(t('s3.why.' + ev.why), 'warn');
      else if (ev.k === 'wave') toast(t('s3.toast.wave'), 'warn');
      else if (ev.k === 'revive') toast(t('s3.toast.revive'), 'good');
      else if (ev.k === 'phase') { toast(t('s3.toast.phase'), 'boss'); comm('phase'); }
      else if (ev.k === 'clear') freeze = Math.max(freeze, 0.22);
      else if (ev.k === 'hijack') comm('hijack');
      else if (ev.k === 'getaway') comm('getaway', {}, true);
      else if (ev.k === 'swap') { lowSaid = false; if (!ev.forced) toast(t('s3.toast.swap', { name: nameOf(run.squad[ev.i].p) })); }
      else if (ev.k === 'down') {
        // 有人倒下、被帶走：停一下，讓玩家看清楚換了誰上來。
        const name = nameOf(run.squad[ev.i].p);
        freeze = Math.max(freeze, 0.4);
        toast(t('s3.toast.down', { name }), 'warn');
        comm(s.team.filter((m) => !m.down).length === 1 ? 'last' : 'down', { name }, true);
      }
    }
    s.ev.length = 0;
    if (!wasAlert && s.alert && !s.spec.boss) { S3.music.set('fight'); toast(t('s3.toast.alarm'), 'warn'); comm('alarm'); }
    // 體力快沒了，而且還有人可以換：提醒一次。
    if (!lowSaid && !s.over && !s.cleared && s.p.hp < s.p.maxHp * 0.3 && s.team.filter((m) => !m.down).length > 1) { lowSaid = true; comm('low', {}, true); tip('swap'); }
    // 母機和核心那兩場：基石會念出它對場上這個人的預測。
    if ((s.spec.boss === 'carrier' || s.spec.boss === 'keystone') && !s.cleared && !s.over) {
      predictT -= sim.DT;
      if (predictT <= 0) { predictT = 15 + Math.random() * 9; comm(activePerson().flaw && Math.random() < 0.4 ? 'predictFlaw' : 'predict', {}, false); }
    }
    if (s.cleared && !rewarded && s.cache.taken) roomCleared();
    else if (s.cleared && !rewarded) S3.music.set('calm');
    if (s && s.exit >= 0 && mode === 'play') { const i = s.exit; inRoom = false; enterDoor(i); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (!s || !run || $('s3-game').hidden) return;
    if (mode === 'play' && !paused) {
      if (s.over === 'dead') {
        deadT += dt;
        if (deadT > 1.5) { R.finishRoom(run, s); showEnd(false); return; }
      } else if (freeze > 0) freeze -= dt;
      else {
        acc += dt;
        let n = 0;
        while (acc >= sim.DT && n++ < 5 && s && mode === 'play' && !s.over) { acc -= sim.DT; stepOnce(); }
        if (n >= 5) acc = 0;
      }
      V.update(dt);
    }
    if (!s || !run) return;
    if (mode === 'play') refreshUi(); else { ui.hack = null; ui.takedown = null; }
    V.draw(s, ui);
    hud();
  }

  // ===== 鍵盤和滑鼠 =====
  const MOVE = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  window.addEventListener('keydown', (e) => {
    if (mode === 'talk') {
      if (e.code === 'Escape') { e.preventDefault(); talkEnd(); }
      else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) talkNext(); }
      return;
    }
    if (onModalKey) { onModalKey(e); return; }
    if (mode !== 'play') return;
    const digit = /^(Digit|Numpad)([1-3])$/.exec(e.code);
    if (MOVE[e.code]) { keys[MOVE[e.code]] = true; e.preventDefault(); }
    else if (e.code === 'Space') { if (!e.repeat) edge.dash = true; e.preventDefault(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.focus = true;
    else if (digit) { if (!e.repeat) edge.swap = Number(digit[2]) - 1; }
    else if (e.code === 'KeyF') { if (!e.repeat) edge.melee = true; }
    else if (e.code === 'KeyQ') { if (!e.repeat) edge.g1 = true; }
    else if (e.code === 'KeyE') { if (!e.repeat) edge.g2 = true; }
    else if (e.code === 'KeyR') edge.reload = true;
    else if (e.code === 'KeyC') { if (!e.repeat) edge.hack = true; }
    else if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Tab') { e.preventDefault(); pause(); }
  });
  window.addEventListener('keyup', (e) => {
    if (MOVE[e.code]) keys[MOVE[e.code]] = false;
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.focus = false;
  });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; if (mode === 'play' && s && !s.cleared && !bot) pause(); });
  const stage = $('s3-stage');
  stage.addEventListener('mousemove', (e) => { const w = V.toWorld(e.clientX, e.clientY); mouse.x = w.x; mouse.y = w.y; });
  stage.addEventListener('mousedown', (e) => {
    sfx.unlock();
    if (mode !== 'play') return;
    const w = V.toWorld(e.clientX, e.clientY);
    mouse.x = w.x; mouse.y = w.y;
    if (e.button === 0) keys.fire = true;
    else if (e.button === 2) edge.hack = true;
    e.preventDefault();
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) keys.fire = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => V.resize());

  // ===== 啟動 =====
  function boot() {
    let lang = 'zh-Hant';
    try { lang = localStorage.getItem(LANG_KEY) || lang; } catch (e) { /* 忽略 */ }
    E.i18n.set(params.get('lang') || lang);
    V.init($('s3-canvas'));
    $('s3-title-art').innerHTML = pictures.title ? `<img src="${pictures.title}" alt="">` : E.art.byKey('server');
    if (pictures.title) $('s3-title').classList.add('has-art');
    document.querySelectorAll('.lang-switch button[data-lang]').forEach((b) => b.addEventListener('click', () => { sfx.unlock(); play('click'); setLang(b.dataset.lang); }));
    $('s3-start').addEventListener('click', () => { sfx.unlock(); play('title'); startFresh(); });
    $('s3-continue').addEventListener('click', () => { sfx.unlock(); play('click'); resume(); });
    $('s3-sound').addEventListener('click', () => { sfx.unlock(); sfx.toggle(); applyLang(); });
    $('s3-pause').addEventListener('click', () => pause());
    applyLang();
    showTitle();
    // 機器人模式：不碰名冊，用這個種子的三個路人直接開打。
    if (AUTO) { meta = Object.assign(R.meta(), { roster: [] }); R.saveMeta = R.save = R.clear = () => {}; beginRun(R.crewFor(seed)); }
    requestAnimationFrame(frame);
  }
  // 機器人模式：對話框自己選。
  function autoMenu() {
    if (!run || mode === 'play' || $('s3-modal').hidden) return;
    if (run.phase === 'route') { closeModal(); enterDoor(S3.bot.chooseDoor(run)); }
    else if (run.phase === 'reward' && run.pending) { if (run.pending.kind === 'rescue') R.rescue(run, null); else R.take(run, S3.bot.chooseReward(run, run.pending)); closeModal(); afterNode(); }
    else if (run.phase === 'shop' || run.phase === 'safe' || run.phase === 'event') { S3.bot.visit(run); closeModal(); afterNode(); }
  }
  setInterval(() => { if (AUTO) autoMenu(); }, 900);

  // 測試用：從主控台跳到某個區段的首領、給自己東西、重播某一段劇情。
  S3.debug = {
    get run() { return run; }, get room() { return s; }, get meta() { return meta; }, get mode() { return mode; }, past: PAST,
    jump(sector, depth) { run.sector = sector; run.depth = depth === undefined ? D.sectors[sector].rooms : depth; run.roomNo = D.sectors.slice(0, sector).reduce((n, x) => n + x.rooms + 1, 0) + run.depth; R.route(run); inRoom = false; showRoute(); },
    give(id) { if (D.gadgets[id]) R.addGadget(run, id); else R.addExploit(run, id); },
    heal() { R.heal(run, 999); if (s) { s.p.hp = s.p.maxHp; for (const m of s.team) if (!m.down) m.hp = m.maxHp; } },
    hurt(hp = 1) { if (s) s.p.hp = hp; },
    clear() { for (const e of s.en.slice()) sim.api.kill(s, e, { by: 'gun' }); s.waves = []; },
    grab() { s.p.x = s.cache.x; s.p.y = s.cache.y + 20; },
    // 不等畫面更新，直接跑 n 步（瀏覽器在背景時畫面更新很慢）。
    steps(n = 60) { for (let i = 0; i < n && s && mode === 'play' && !s.over; i++) stepOnce(); return s ? s.tick : -1; },
    swap(i) { edge.swap = i; },
    auto: () => autoMenu(),
    draw() { if (!s) return; if (mode === 'play') refreshUi(); V.update(1 / 60); V.draw(s, ui); hud(); },
    beat(id) { delete meta.story[id]; beat(id, {}, () => {}); },
    talkNext, talkEnd,
    event(id) { run.event = { id, result: null }; run.phase = 'event'; inRoom = false; showNode(); },
    finale() { showFinale(); },
    lobby() { enterLobby(); },
  };

  boot();
})(window.ECHO = window.ECHO || {});
