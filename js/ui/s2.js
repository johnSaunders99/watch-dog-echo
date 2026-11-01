// 第二季原型的介面：依目前的階段畫出整個畫面，每個動作之後重畫並存檔。
// 規則都在 js/engine/night.js；這裡只負責畫面、聲音、存檔和語言切換。
(function (E) {
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => E.i18n.t(k, v);
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (k, v) => esc(t(k, v));
  const P = (map) => esc(E.i18n.pick(map));
  const N = E.night;
  const data = () => E.s2.people;
  const stages = () => E.s2.ops.stages;
  const slot = E.save.slot('watchdogs-echo.s2.proto', 1);
  const LANG_KEY = 'watchdogs-echo.s2.lang';

  let s = null;
  let picked = [];       // 開場或組隊時選中的人
  let seen = 0;          // 已經處理過音效的紀錄行數
  let profileId = null;  // 對話框裡正在看的人
  let cineTimer = null;

  const who = (id) => N.person(s, id);
  const nm = (id) => P(E.people.name(who(id)));
  const face = (id) => E.faces.of(who(id));
  const pct = (risk) => Math.round((1 - risk) * 100);
  const nameVar = (id) => ({ l: E.people.name(who(id)) });

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 無法存的話就算了 */ } }

  // ===== 共用元件 =====
  function skills(p) {
    return `<div class="p-skills">${['hack', 'physical', 'social'].map((k) =>
      `<span><label>${T('s2.p.' + k)}</label><i>${'●'.repeat(p.skills[k])}<u>${'●'.repeat(3 - p.skills[k])}</u></i></span>`).join('')}</div>`;
  }

  function miniCard(card, sub) {
    return `<div class="mini kind-${card.kind}"><div class="mini-top"><b>${P(card.name)}</b><em>${T('s2.op.kind.' + card.kind)}</em></div>`
      + (sub ? `<small>${P(sub)}</small>` : '') + `<p>${P(card.desc)}</p></div>`;
  }

  // 人物檔案卡。full 為 false 時只顯示頭像、職業和能力（還沒掃描的路人）。
  function personCard(id, opt = {}) {
    const p = who(id);
    const job = E.people.occupationOf(p);
    const tier = E.people.tierOf(p);
    const m = E.roster.get(s.roster, id);
    const attrs = opt.act ? ` data-act="${opt.act}" data-id="${id}" role="button" tabindex="0"` : '';
    let h = `<article class="person tier-${tier}${opt.selected ? ' selected' : ''}${opt.cls ? ' ' + opt.cls : ''}"${attrs}>`;
    h += `<header class="p-head"><div class="p-face">${face(id)}</div><div class="p-id"><b class="p-name">${nm(id)}</b>`
      + `<span class="p-job">${P(job.name)}</span><span class="p-meta">`
      + (tier !== 'common' ? `<em class="tier">${T('s2.p.tier.' + tier)}</em>` : '')
      + `<em class="cat cat-${job.category}">${T('s2.p.cat.' + job.category)}</em><em>${T('s2.p.age', { n: p.age })}</em>`
      + `<em class="threat${p.threat >= 50 ? ' high' : ''}">${T('s2.p.threat', { n: p.threat })}</em></span></div></header>`;
    h += skills(p);
    if (!opt.full) return h + (opt.footer || '') + '</article>';

    const perk = E.people.perkOf(p);
    const flaw = E.people.flawOf(p);
    h += `<div class="p-perk"><label>${T('s2.p.perk')}</label><b>${P(perk.name)}</b><span>${P(perk.desc)}</span></div>`;
    h += `<div class="p-traits">${E.people.traitsOf(p).map((tr) => miniCard(tr.card, tr.name)).join('')}</div>`;
    h += `<div class="p-row flaw"><label>${T('s2.p.flaw')}</label><div><b>${P(flaw.name)}</b><span>${P(flaw.desc)}</span></div></div>`;
    h += `<div class="p-row"><label>${T('s2.p.quirks')}</label><div>${E.people.quirksOf(p).map((q) => `<span class="q"><b>${P(q.name)}</b><small>${P(q.desc)}</small></span>`).join('')}</div></div>`;
    const rels = N.relationsOf(s, id);
    if (rels.length) {
      h += `<div class="p-row rels"><label>${T('s2.p.relations')}</label><div>${rels.map((r) => {
        const where = E.roster.get(s.roster, r.other) ? T('s2.p.rel.team') : N.street(s).includes(r.other) ? T('s2.p.rel.street') : '';
        return `<span class="rel rel-${r.type}"><b>${P(data().relations[r.type].name)}</b>${nm(r.other)}${where ? `<small>${where}</small>` : ''}</span>`;
      }).join('')}</div></div>`;
    }
    if (m && m.scars && m.scars.length) {
      h += `<div class="p-row scars"><label>${T('s2.p.scars')}</label><div>${m.scars.map((k) => `<span class="q"><b>${P(data().scars[k].name)}</b><small>${P(data().scars[k].desc)}</small></span>`).join('')}</div></div>`;
    }
    h += `<p class="p-secret"><label>${T('s2.p.secret')}</label>${P(data().secrets[p.secret])}</p>`;
    if (!m) h += `<p class="p-problem"><label>${T('s2.p.problem')}</label>${P(E.people.problemText(p))}</p>`;
    return h + (opt.footer || '') + '</article>';
  }

  // Bagley 最近說的話。
  function bagleyBox() {
    const lines = [];
    for (let i = s.log.length - 1; i >= 0 && lines.length < 2; i--) {
      if (s.log[i].c === 'bagley') lines.unshift(s.log[i]);
      else if (lines.length) break;
    }
    if (!lines.length) return '';
    return `<div class="bagley"><div class="bagley-face">${E.art.avatar('bagley')}</div><div class="bagley-txt"><b>BAGLEY</b>${lines.map((e) => `<p>${T(e.k, e.v)}</p>`).join('')}</div></div>`;
  }

  function stageChips(ids, current) {
    return `<div class="chain">${ids.map((id, i) => `<span class="${i < current ? 'done' : i === current ? 'now' : ''}">${P(stages()[id].name)}</span>`).join('<i>›</i>')}</div>`;
  }

  function opCard(e) {
    return `<button class="op-card kind-${e.kind}" data-act="op" data-key="${esc(e.key)}">`
      + `<div class="op-top"><em class="kind">${T('s2.day.kind.' + e.kind)}</em>${e.left !== undefined ? `<em class="urgent">${T('s2.day.left', { n: e.left })}</em>` : ''}${e.family ? `<em class="family">${T('s2.day.familyShort')}</em>` : ''}</div>`
      + `<div class="op-main">${e.target ? `<div class="op-face">${face(e.target)}</div>` : ''}<div><div class="op-name">${P(e.name)}</div><div class="op-desc">${P(e.desc)}</div></div></div>`
      + stageChips(e.stages, -1)
      + `<div class="op-reward">${T('s2.day.reward', { n: e.reward.support })}</div></button>`;
  }

  // ===== 各階段 =====
  function renderStart() {
    return `<section class="panel">${bagleyBox()}<h2>${T('s2.start.title')}</h2><p class="hint">${T('s2.start.hint')}</p>`
      + `<div class="grid-people">${s.volunteers.map((id) => personCard(id, { full: true, act: 'vol', selected: picked.includes(id) })).join('')}</div>`
      + `<div class="bar-actions"><span class="hint">${T('s2.start.picked', { n: picked.length })}</span>`
      + `<button class="primary" data-act="begin"${picked.length === 2 ? '' : ' disabled'}>${T('s2.start.go')}</button></div></section>`;
  }

  function renderDay() {
    const ops = N.ops(s);
    const street = N.street(s);
    const owed = Object.keys(s.owed);
    const canRecruit = E.roster.canRecruit(s.roster);
    let h = `<section class="banner">${E.art.byKey('basement')}<div class="banner-txt"><div class="banner-night">${T('s2.ui.nightOf', { n: s.night, max: N.MAX_NIGHTS })}</div>`
      + `<div class="banner-loc">${P(data().districts.camden.name)}</div></div></section>`;
    h += bagleyBox();
    h += `<section class="panel"><h2>${T('s2.day.ops')}</h2><p class="hint">${T('s2.day.opsHint')}</p><div class="ops">${ops.map(opCard).join('')}</div>`
      + `<div class="bar-actions"><button data-act="rest">${T('s2.day.rest')}</button></div></section>`;
    if (owed.length) {
      h += `<section class="panel"><h2>${T('s2.day.owed')}</h2><p class="hint">${T('s2.day.owedHint')}</p><div class="grid-people">${owed.map((id) => personCard(id, {
        full: true,
        footer: `<div class="p-foot">${canRecruit ? `<button class="primary" data-act="recruit" data-id="${id}">${T('s2.day.recruit')}</button>` : `<span class="hint">${T('s2.day.full')}</span>`}</div>`,
      })).join('')}</div></section>`;
    }
    h += `<section class="panel"><h2>${T('s2.day.street')}</h2><p class="hint">${T('s2.day.streetHint')}</p><div class="grid-people">${street.map((id) => (s.scanned[id]
      ? personCard(id, { full: true, cls: 'scanned' })
      : personCard(id, { cls: 'unscanned', footer: `<div class="p-foot"><button data-act="scan" data-id="${id}">${T('s2.day.scan')}</button></div>` }))).join('')}</div></section>`;
    return h;
  }

  function renderSquad() {
    const e = N.ops(s).find((x) => x.key === s.pick);
    const avail = s.roster.members.filter((m) => m.status === 'active').map((m) => m.person.id);
    const check = N.squadCheck(s, picked);
    const combos = N.combosFor(s, picked);
    let reason = '';
    if (!check.ok && picked.length) reason = t(check.reason, check.a ? { a: nameVar(check.a), b: nameVar(check.b) } : {});
    let h = `<section class="panel brief">${opCard(e).replace('<button', '<div').replace(/<\/button>$/, '</div>').replace(/ data-act="op"/, '')}</section>`;
    h += `<section class="panel"><h2>${T('s2.squad.title')}</h2><div class="grid-people">${avail.map((id) => personCard(id, { full: true, act: 'squad', selected: picked.includes(id) })).join('')}</div>`;
    h += `<div class="bar-actions"><div class="squad-info">`
      + (picked.length ? `<span class="chip">${T('s2.squad.startAlert', { n: N.startAlert(s, picked) })}</span>` : '')
      + combos.map((c) => { const def = data().combos.find((x) => x.id === c); return `<span class="chip combo${c === 'derby' ? ' bad' : ''}" title="${P(def.desc)}">${T('s2.squad.combos')}：${P(def.name)}</span>`; }).join('')
      + (reason ? `<span class="warn">${esc(reason)}</span>` : '')
      + `</div><button data-act="back">${T('s2.squad.back')}</button><button class="primary" data-act="go"${check.ok ? '' : ' disabled'}>${T('s2.squad.go')}</button></div></section>`;
    return h;
  }

  function alertStatus(a) {
    return a >= 60 ? 's2.op.alert.60' : a >= 30 ? 's2.op.alert.30' : 's2.op.alert.0';
  }

  function renderOp() {
    const op = s.op;
    const st = N.stage(s);
    const combos = N.combos(s);
    const options = N.options(s).sort((a, b) => (b.candidates.some((c) => c.ok) ? 1 : 0) - (a.candidates.some((c) => c.ok) ? 1 : 0));
    const lvl = op.alert >= 60 ? 'hot' : op.alert >= 30 ? 'warm' : 'cool';
    let h = `<section class="op-head"><div class="op-art">${E.art.byKey(st.art)}<div class="op-overlay"><div class="op-title">${P(op.name)}</div>${stageChips(op.stages, op.i)}</div></div>`;
    h += `<div class="alert alert-${lvl}"><div class="alert-top"><span>${T('s2.op.alert')}</span><b>${op.alert}</b><em>${T(alertStatus(op.alert))}</em></div>`
      + `<div class="alert-bar"><i style="width:${op.alert}%"></i><u style="left:30%"></u><u style="left:60%"></u></div></div>`;
    h += `<div class="op-meta"><span class="chip">${T('s2.op.bandwidth')} <b class="pips">${'▮'.repeat(op.bw)}<u>${'▮'.repeat(Math.max(0, N.BANDWIDTH - op.bw))}</u></b></span>`
      + (op.keycard ? `<span class="chip good">${T('s2.op.keycard')}</span>` : '')
      + combos.map((c) => { const def = data().combos.find((x) => x.id === c); return `<span class="chip combo${c === 'derby' ? ' bad' : ''}" title="${P(def.desc)}">${P(def.name)}</span>`; }).join('')
      + `</div>`;
    h += `<div class="squad-strip">${N.members(s).map((id) => {
      const flags = [];
      if (op.temp.includes(id)) flags.push(T('s2.op.helper'));
      if (op.sulk[id]) flags.push(T('s2.op.sulking'));
      if (!N.able(s, id)) flags.push(T('s2.need.out'));
      return `<button class="strip-m${N.able(s, id) ? '' : ' out'}" data-act="profile" data-id="${id}">${face(id)}<span>${nm(id)}</span>${flags.length ? `<small>${flags.join(' · ')}</small>` : ''}</button>`;
    }).join('')}</div></section>`;

    h += `<section class="panel stage"><h2>${P(st.name)} <small>${T('s2.op.stage', { i: op.i + 1, n: op.stages.length })}</small></h2><p class="stage-desc">${P(st.desc)}</p><p class="hint">${T('s2.op.hint')}</p><div class="apprs">`;
    for (const o of options) {
      const a = o.approach;
      const any = o.candidates.some((c) => c.ok);
      const tags = [];
      if (a.sure) tags.push(`<em class="sure">${T('s2.op.sure')}</em>`);
      if (a.bandwidth) tags.push(`<em>${T('s2.op.bw', { n: a.bandwidth })}</em>`);
      if (a.injure) tags.push(`<em class="risky">${T('s2.op.injure')}</em>`);
      h += `<div class="appr${a.hidden ? ' is-hidden' : ''}${a.only || a.id === 'keycard' ? ' is-special' : ''}${any ? '' : ' none'}">`
        + `<div class="appr-head"><b>${P(a.name)}</b>${a.hidden ? `<em class="hid">${T('s2.op.hidden')}</em>` : ''}${tags.join('')}</div><div class="cands">`;
      h += o.candidates.map((c) => (c.ok
        ? `<button class="cand ${c.risk <= 0.2 ? 'hi' : c.risk <= 0.45 ? 'mid' : 'lo'}" data-act="do" data-a="${esc(a.id)}" data-who="${c.id}">${face(c.id)}<span class="cn">${nm(c.id)}</span><span class="pc">${pct(c.risk)}%</span><span class="cx">+${c.exposure}</span></button>`
        : `<div class="cand off">${face(c.id)}<span class="cn">${nm(c.id)}</span><span class="why">${T(c.reason)}</span></div>`)).join('');
      h += `</div></div>`;
    }
    h += `</div></section>`;

    const cards = N.cards(s);
    h += `<section class="panel hand"><h2>${T('s2.op.cards')}</h2><div class="cards">${cards.map((c) => `<button class="tcard kind-${c.card.kind}${c.used ? ' used' : ''}" data-act="card" data-owner="${c.owner}" data-id="${c.id}"${c.usable ? '' : ' disabled'}>`
      + `<div class="tc-top">${face(c.owner)}<span>${nm(c.owner)}</span><em>${T('s2.op.kind.' + c.card.kind)}</em></div>`
      + `<div class="tc-name">${P(c.card.name)}</div><div class="tc-desc">${P(c.card.desc)}</div>`
      + (c.used ? `<div class="tc-stamp">${T('s2.op.used')}</div>` : c.card.kind === 'passive' ? `<div class="tc-note">${T('s2.op.passive')}</div>` : '')
      + `</button>`).join('')}</div></section>`;
    h += `<div class="bar-actions"><button class="ghost" data-act="retreat">${T('s2.op.retreat')}</button></div>`;
    return h;
  }

  function renderResult() {
    const r = s.result;
    const title = { win: 's2.res.win', fail: 's2.res.fail', retreat: 's2.res.retreat', rest: 's2.res.rest' }[r.outcome];
    let from = s.log.length - 1;
    while (from > 0 && s.log[from].c !== 'op' && s.log[from].c !== 'night') from--;
    const lines = s.log.slice(from + 1).filter((e) => e.c !== 'stage');
    return `<section class="panel result res-${r.outcome}"><div class="res-title">${T(title)}</div>${r.name ? `<div class="res-op">${P(r.name)}</div>` : ''}`
      + `<div class="res-nums">${r.support ? `<b class="up">${T('s2.res.support', { n: r.support })}</b>` : ''}${r.heat ? `<b class="down">${T('s2.res.heat', { n: r.heat })}</b>` : ''}</div>`
      + `<div class="res-log">${lines.map((e) => `<div class="ln c-${e.c}">${T(e.k, e.v)}</div>`).join('')}</div>`
      + `<div class="bar-actions"><button class="primary" data-act="next">${T('s2.res.next')}</button></div></section>`;
  }

  function renderEnd() {
    const k = s.ended;
    const faces = (ids) => (ids.length ? ids.map((id) => `<span class="end-face">${face(id)}<small>${nm(id)}</small></span>`).join('') : `<span class="hint">${T('s2.end.none')}</span>`);
    return `<section class="panel endcard end-${k}"><div class="end-label">${T('s2.end.card')}</div><h2>${T('s2.end.' + k + '.title')}</h2><p class="end-text">${T('s2.end.' + k + '.text')}</p>`
      + `<div class="end-stats"><span>${T('s2.end.nights', { n: Math.min(s.night, N.MAX_NIGHTS) })}</span><span>${T('s2.end.ops', { n: s.stats.ops, w: s.stats.wins })}</span><span>${T('s2.ui.support')} ${s.support}%</span></div>`
      + `<div class="end-row"><label>${T('s2.end.recruited')}</label><div class="end-faces">${faces(s.stats.recruited)}</div></div>`
      + `<div class="end-row"><label>${T('s2.end.lost')}</label><div class="end-faces">${faces(s.stats.lost)}</div></div>`
      + `<p class="hint">${T('s2.end.note')}</p><div class="bar-actions"><button class="primary" data-act="again">${T('s2.end.again')}</button></div></section>`;
  }

  function renderModal() {
    const el = $('s2-modal');
    let h = '';
    if (s.phase === 'event' && s.event) {
      const ev = s.event;
      h = `<div class="modal-card ev"><div class="modal-face">${face(ev.who)}</div><h3>${T('s2.ev.' + ev.type + '.title')}</h3><p>${T('s2.ev.' + ev.type + '.text', { name: nameVar(ev.who) })}</p>`
        + `<div class="modal-actions">${ev.choices.map((c) => `<button data-act="answer" data-choice="${c}">${T('s2.ev.' + ev.type + '.' + c)}</button>`).join('')}</div></div>`;
    } else if (s.phase === 'react' && s.react) {
      const rc = s.react;
      const text = rc.type === 'reroll'
        ? t(rc.owner === rc.who ? 's2.react.reroll.self' : 's2.react.reroll.text', { name: nameVar(rc.owner), other: nameVar(rc.who) })
        : t('s2.react.escape.text', { name: nameVar(rc.who) });
      h = `<div class="modal-card react"><div class="modal-face">${face(rc.owner)}</div><h3>${T('s2.react.' + rc.type + '.title')}</h3><p>${esc(text)}</p>`
        + `<div class="modal-actions"><button class="primary" data-act="react" data-use="1">${T('s2.react.' + rc.type + '.use')}</button><button data-act="react" data-use="0">${T('s2.react.' + rc.type + '.skip')}</button></div></div>`;
    } else if (profileId) {
      h = `<div class="modal-card profile">${personCard(profileId, { full: true })}<div class="modal-actions"><button data-act="close">${T('s2.ui.close')}</button></div></div>`;
    }
    el.hidden = !h;
    el.innerHTML = h;
  }

  // ===== 整個畫面 =====
  function render() {
    $('m-night').textContent = t('s2.ui.nightOf', { n: Math.min(s.night, N.MAX_NIGHTS), max: N.MAX_NIGHTS });
    $('m-support').style.width = s.support + '%';
    $('m-support-v').textContent = s.support + '%';
    $('m-heat').style.width = s.heat + '%';
    $('m-heat-v').textContent = s.heat;
    $('m-towers').textContent = s.towers + '/4';

    $('s2-beds').textContent = t('s2.ui.beds', { n: E.roster.housed(s.roster).length, max: s.roster.capacity });
    $('s2-team').innerHTML = s.roster.members.map((m) => {
      const id = m.person.id;
      let st = T('s2.p.status.' + m.status);
      if (m.status === 'injured') st += ' · ' + m.injuredFor;
      if (m.status === 'arrested') st += ' · ' + T('s2.day.left', { n: E.roster.TRANSFER_AFTER - (s.night - m.since) });
      return `<button class="mem st-${m.status}" data-act="profile" data-id="${id}"><span class="mem-face">${face(id)}</span>`
        + `<span class="mem-txt"><b>${nm(id)}</b><small>${P(E.people.occupationOf(m.person).name)}</small></span><span class="mem-st">${st}</span></button>`;
    }).join('');

    const log = $('s2-log');
    log.innerHTML = s.log.slice(-150).map((e) => `<div class="ln c-${e.c}">${T(e.k, e.v)}</div>`).join('');
    log.scrollTop = log.scrollHeight;

    const main = $('s2-main');
    const phase = s.phase === 'event' || s.phase === 'react' ? 'op' : s.phase;
    main.dataset.phase = phase;
    main.innerHTML = { start: renderStart, day: renderDay, squad: renderSquad, op: renderOp, result: renderResult, end: renderEnd }[phase]();
    renderModal();
  }

  // 新出現的紀錄決定音效和畫面閃一下。
  function feedback() {
    const fresh = s.log.slice(seen);
    seen = s.log.length;
    if (!fresh.length) return;
    const has = (fn) => fresh.some(fn);
    const main = $('s2-main');
    if (has((e) => /^s2\.alert\./.test(e.k))) {
      E.fx.sfx.play('alarm');
      document.body.classList.remove('alarm');
      void document.body.offsetWidth;
      document.body.classList.add('alarm');
    } else if (has((e) => e.c === 'bad')) E.fx.sfx.play('loss');
    else if (has((e) => e.c === 'card')) E.fx.sfx.play('hack');
    else if (has((e) => e.c === 'ok' || e.c === 'gain')) E.fx.sfx.play('gain');
    else E.fx.sfx.play('blip');
    const flash = has((e) => e.c === 'bad') ? 'flash-bad' : has((e) => e.c === 'ok') ? 'flash-ok' : '';
    if (flash) {
      main.classList.remove('flash-bad', 'flash-ok');
      void main.offsetWidth;
      main.classList.add(flash);
    }
  }

  function cine(kind, html, ms) {
    const el = $('cine');
    el.className = 'cine show ' + kind;
    el.innerHTML = html;
    clearTimeout(cineTimer);
    cineTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function commit() {
    slot.write(s);
    render();
    feedback();
  }

  // ===== 操作 =====
  const actions = {
    vol(d) { picked = picked.includes(d.id) ? picked.filter((x) => x !== d.id) : picked.length < 2 ? picked.concat(d.id) : picked; },
    begin() { if (N.pickVolunteers(s, picked)) { picked = []; window.scrollTo(0, 0); } },
    scan(d) { N.scan(s, d.id); E.fx.sfx.play('prof'); },
    recruit(d) { N.recruitOwed(s, d.id); },
    op(d) { if (N.pickOp(s, d.key)) picked = []; window.scrollTo(0, 0); },
    squad(d) { picked = picked.includes(d.id) ? picked.filter((x) => x !== d.id) : picked.length < N.MAX_SQUAD ? picked.concat(d.id) : picked; },
    back() { N.cancel(s); picked = []; },
    go() {
      if (!N.launch(s, picked)) return;
      picked = [];
      window.scrollTo(0, 0);
      cine('title', `<div class="cine-title">${P(s.op ? s.op.name : s.result.name)}</div>`, 1600);
      E.fx.sfx.play('title');
    },
    rest() { N.rest(s); },
    do(d) { N.act(s, d.a, d.who); },
    card(d) { N.useCard(s, d.owner, d.id); },
    answer(d) { N.answer(s, d.choice); },
    react(d) { N.react(s, d.use === '1'); },
    retreat() { N.retreat(s); },
    next() {
      N.nextDay(s);
      window.scrollTo(0, 0);
      if (s.phase === 'end') {
        cine('ending', `<div class="cine-title">${T('s2.end.' + s.ended + '.title')}</div>`, 3600);
        E.fx.sfx.play('ending');
      }
    },
    again() { newRun(); },
    profile(d) { profileId = d.id; },
    close() { profileId = null; },
  };

  function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled || !s) return;
    E.fx.sfx.unlock();
    const before = s.phase;
    actions[el.dataset.act](el.dataset);
    // 行動結束時跳出結果卡。
    if (before !== 'result' && s.phase === 'result' && s.result.outcome !== 'rest') {
      const ok = s.result.outcome === 'win';
      cine(ok ? 'title' : 'desync', ok ? `<div class="cine-title">${T('s2.res.win')}</div>` : `<div class="cine-desync" data-text="${T('s2.res.' + s.result.outcome)}">${T('s2.res.' + s.result.outcome)}</div>`, 1500);
    }
    if (el.dataset.act !== 'profile' && el.dataset.act !== 'close') profileId = null;
    commit();
  }

  // ===== 開始、語言、音效 =====
  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-lang]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.lang === E.i18n.lang)));
    document.title = t('s2.ui.title') === 'CURFEW' ? 'CURFEW' : t('s2.ui.title') + ' CURFEW';
    $('s2-sound').textContent = E.fx.sfx.muted ? t('s2.ui.soundOff') : t('s2.ui.soundOn');
  }

  function setLang(code) {
    if (!E.i18n.set(code)) return;
    lsSet(LANG_KEY, code);
    applyStatic();
    if (s && !$('s2-game').hidden) render();
  }

  function show() {
    $('s2-title').hidden = true;
    $('s2-game').hidden = false;
    seen = s.log.length;
    render();
  }

  function newRun() {
    const fromUrl = new URLSearchParams(location.search).get('seed');
    s = N.create(fromUrl || Date.now().toString(36));
    picked = [];
    profileId = null;
    slot.write(s);
    show();
  }

  function init() {
    E.i18n.set(lsGet(LANG_KEY) || 'zh-Hant');
    $('s2-title-art').innerHTML = E.art.byKey('arches');
    applyStatic();
    const saved = slot.read();
    $('s2-continue').hidden = !saved;
    document.addEventListener('click', (ev) => {
      if (ev.target.id === 's2-modal' && profileId) { profileId = null; return renderModal(); }
      const lang = ev.target.closest('[data-lang]');
      if (lang) return setLang(lang.dataset.lang);
      onClick(ev);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && profileId) { profileId = null; renderModal(); }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('article[data-act]')) { ev.preventDefault(); onClick(ev); }
    });
    $('cine').addEventListener('click', () => $('cine').classList.remove('show'));
    $('s2-start').addEventListener('click', () => { E.fx.sfx.unlock(); E.fx.sfx.play('title'); newRun(); });
    $('s2-continue').addEventListener('click', () => { E.fx.sfx.unlock(); s = slot.read(); show(); });
    $('s2-new').addEventListener('click', () => { if (window.confirm(t('s2.ui.confirmNew'))) newRun(); });
    $('s2-sound').addEventListener('click', () => { E.fx.sfx.unlock(); E.fx.sfx.toggle(); applyStatic(); });
  }

  init();
})(window.ECHO = window.ECHO || {});
