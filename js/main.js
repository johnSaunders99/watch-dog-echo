// 啟動與主迴圈：標題畫面、輸入處理、語言切換、存檔。
(function (E) {
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => E.i18n.t(k, v);

  let state = null;
  let history = [];

  function persist() {
    if (state) E.save.write({ state, history, lang: E.i18n.lang });
  }

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-lang]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.lang === E.i18n.lang));
    });
    document.title = t('ui.title');
  }

  function refresh() {
    document.body.classList.toggle('memory', !!E.scenes[state.scene].memory);
    E.ui.hud(state);
    E.ui.chips(E.engine.suggestions(state));
  }

  function emit(entries) {
    history.push(...entries);
    E.ui.print(entries);
  }

  // 舞台立刻對齊目前的場景（讀檔、換語言時用，不播放轉場）。
  function syncStage() {
    E.fx.setScene(state.scene, true);
    E.fx.caption(t(E.scenes[state.scene].location));
  }

  function setLang(code) {
    if (!E.i18n.set(code)) return;
    applyStatic();
    updateSoundButton();
    if (state) {
      E.ui.rerender(history);
      syncStage();
      refresh();
      persist();
    }
  }

  function updateSoundButton() {
    $('btn-sound').textContent = E.fx.sfx.muted ? t('ui.soundOff') : t('ui.soundOn');
  }

  function langFromText(text) {
    const s = (text || '').trim().toLowerCase();
    for (const code in E.langAliases) {
      if (E.langAliases[code].includes(s)) return code;
    }
    return null;
  }

  function showScreen(name) {
    $('title').hidden = name !== 'title';
    $('game').hidden = name !== 'game';
    if (name === 'game') $('cmd').focus();
    if (name === 'title') $('btn-continue').hidden = !(E.save.read() || {}).state;
  }

  function newGame() {
    E.fx.sfx.unlock();
    state = E.state.create();
    history = [];
    E.ui.clear();
    showScreen('game');
    syncStage();
    refresh();
    // 開場先閃現終章的危機，再回到「四小時前」的地下室。
    E.fx.coldOpen().then(() => {
      emit(E.engine.enter(state));
      persist();
    });
  }

  function resume() {
    const save = E.save.read();
    if (!save || !save.state) return newGame();
    E.fx.sfx.unlock();
    state = save.state;
    history = save.history || [];
    showScreen('game');
    E.ui.rerender(history);
    syncStage();
    refresh();
  }

  function run(cmd, inputEntry) {
    E.ui.skip();
    if (cmd.verb === 'restart') {
      E.save.clear();
      newGame();
      return;
    }
    emit([inputEntry]);
    if (cmd.verb === 'lang') {
      const code = langFromText(cmd.rest);
      if (code) {
        setLang(code);
        emit([{ c: 'sys', k: 'lang.switched' }]);
      } else {
        emit([{ c: 'err', k: 'lang.unknown' }]);
      }
      persist();
      return;
    }
    if (state.ended) {
      emit([{ c: 'dim', k: 'end.thanks' }]);
      return;
    }
    const out = E.engine.exec(cmd, state);
    // 標記掃描對象，讓 Profiler 人物卡知道要畫誰的頭像。
    for (const e of out) if (e.c === 'prof' && !e.who) e.who = cmd.target;
    if (out.some((e) => e.k === 'desync.1')) glitch();
    emit(out);
    refresh();
    persist();
  }

  // 同步中斷時畫面閃一下故障效果。
  function glitch() {
    document.body.classList.remove('desync');
    void document.body.offsetWidth;
    document.body.classList.add('desync');
    setTimeout(() => document.body.classList.remove('desync'), 900);
  }

  // 錄影用：?jump=章節 會在背景跑完前面的路線，然後直接從那裡繼續。
  function jumpTo(name) {
    const route = E.devRoutes && E.devRoutes[name];
    if (!route) return false;
    const s = E.state.create();
    const log = [...E.engine.enter(s)];
    for (const text of route) {
      log.push({ c: 'input', raw: text });
      log.push(...E.engine.exec(E.parser.parse(text, E.scenes[s.scene], s), s));
    }
    E.save.write({ state: s, history: log, lang: E.i18n.lang });
    return true;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    const input = $('cmd');
    const text = input.value;
    input.value = '';
    const cmd = E.parser.parse(text, E.scenes[state.scene], state);
    if (cmd) run(cmd, { c: 'input', raw: text.trim() });
  }

  function onChip(c) {
    run({ verb: c[0], target: c[1] || null, topic: c[2] || null, rest: '', raw: '' }, { c: 'input', cmd: c });
    $('cmd').focus();
  }

  function initialLang() {
    const saved = (E.save.read() || {}).lang;
    if (saved && E.i18n.has(saved)) return saved;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('zh-cn') || nav.startsWith('zh-sg') || nav === 'zh-hans') return 'zh-Hans';
    if (nav.startsWith('zh')) return 'zh-Hant';
    return 'en';
  }

  function boot() {
    E.ui.init({ log: $('log'), chips: $('chips'), onChip });
    E.fx.init({ getState: () => state });
    E.i18n.set(initialLang());
    applyStatic();
    updateSoundButton();
    $('title-art').innerHTML = E.art.scene('present.chinatown.street').svg;

    $('btn-sound').addEventListener('click', () => {
      E.fx.sfx.unlock();
      E.fx.sfx.toggle();
      updateSoundButton();
    });

    document.querySelectorAll('[data-lang]').forEach((b) => {
      b.addEventListener('click', () => setLang(b.dataset.lang));
    });
    $('btn-start').addEventListener('click', () => { E.save.clear(); newGame(); });
    $('btn-continue').addEventListener('click', resume);
    $('btn-menu').addEventListener('click', () => { persist(); showScreen('title'); });
    $('cmd-form').addEventListener('submit', onSubmit);
    $('log').addEventListener('click', () => E.ui.skip());
    document.addEventListener('keydown', (e) => {
      if (E.ui.busy && !$('game').hidden && e.key !== 'Tab') E.ui.skip();
    });

    showScreen('title');

    const jump = new URLSearchParams(location.search).get('jump');
    if (jump && jumpTo(jump)) $('btn-continue').hidden = false;
  }

  boot();
})(window.ECHO = window.ECHO || {});
