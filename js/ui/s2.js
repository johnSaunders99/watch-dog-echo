// 第二季原型的介面：依目前的階段畫出整個畫面，每個動作之後重畫並存檔。
// 規則都在 js/engine/night.js 和 js/engine/puzzle.js；這裡只負責畫面、聲音、存檔和語言切換。
(function (E) {
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => E.i18n.t(k, v);
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (k, v) => esc(t(k, v));
  const P = (map) => esc(E.i18n.pick(map));
  const N = E.night;
  const data = () => E.s2.people;
  const stages = () => E.s2.ops.stages;
  // 第 3 版存檔：加入主線任務一和第一季的世界。舊版的原型存檔不相容，直接開新的一輪。
  const slot = E.save.slot('watchdogs-echo.s2.proto', 3);
  const LANG_KEY = 'watchdogs-echo.s2.lang';

  let s = null;
  let picks = {};        // 開場或組隊時選中的人：{ id: 'main' | 'decoy' }
  let seen = 0;          // 已經處理過音效的紀錄行數
  let profileId = null;  // 對話框裡正在看的人
  let retiring = null;   // 正在選要傳承哪張卡的人
  let hack = null;       // 手動駭入：{ stage: 'choose' | 'play' | 'solved' | 'timeout', aid, who, spec, pz, spins, deadline }
  let hackTimer = null;
  let cineTimer = null;
  let storySeen = 0;     // 主線任務已經播過的輸出行數
  let worldOpen = false; // 正在問玩家第一季的結局

  const who = (id) => N.person(s, id);
  const nm = (id) => P(E.people.name(who(id)));
  const face = (id) => E.faces.of(who(id));
  const pct = (risk) => Math.round((1 - risk) * 100);
  const nameVar = (id) => ({ l: E.people.name(who(id)) });
  const ids = () => Object.keys(picks);

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 無法存的話就算了 */ } }

  // ===== 共用元件 =====
  function skills(p) {
    return `<div class="p-skills">${['hack', 'physical', 'social'].map((k) =>
      `<span><label>${T('s2.p.' + k)}</label><i>${'●'.repeat(p.skills[k])}<u>${'●'.repeat(3 - p.skills[k])}</u></i></span>`).join('')}</div>`;
  }

  function miniCard(card, sub, attrs = '') {
    return `<div class="mini kind-${card.kind}"${attrs}><div class="mini-top"><b>${P(card.name)}</b><em>${T('s2.op.kind.' + card.kind)}</em></div>`
      + (sub ? `<small>${esc(sub)}</small>` : '') + `<p>${P(card.desc)}</p></div>`;
  }

  // 人物檔案卡。full 為 false 時只顯示頭像、職業和能力（還沒掃描的路人）。
  function personCard(id, opt = {}) {
    const p = who(id);
    const job = E.people.occupationOf(p);
    const tier = E.people.tierOf(p);
    const m = E.roster.get(s.roster, id);
    const threat = m ? m.threat : p.threat;
    const attrs = opt.act ? ` data-act="${opt.act}" data-id="${id}" role="button" tabindex="0"` : '';
    let h = `<article class="person tier-${tier}${opt.selected ? ' selected' : ''}${opt.cls ? ' ' + opt.cls : ''}"${attrs}>`;
    if (opt.badge) h += `<div class="p-badge">${opt.badge}</div>`;
    h += `<header class="p-head"><div class="p-face">${face(id)}</div><div class="p-id"><b class="p-name">${nm(id)}</b>`
      + `<span class="p-job">${P(job.name)}</span><span class="p-meta">`
      + (tier !== 'common' ? `<em class="tier">${T('s2.p.tier.' + tier)}</em>` : '')
      + `<em class="cat cat-${job.category}">${T('s2.p.cat.' + job.category)}</em><em>${T('s2.p.age', { n: p.age })}</em>`
      + `<em class="threat${threat >= N.WANTED ? ' wanted' : threat >= 50 ? ' high' : ''}">${T('s2.p.threat', { n: threat })}</em>`
      + (m && m.wins ? `<em>${T('s2.p.wins', { n: m.wins })}</em>` : '')
      + `</span></div></header>`;
    h += skills(p);
    if (!opt.full) return h + (opt.footer || '') + '</article>';

    const perk = E.people.perkOf(p);
    const flaw = E.people.flawOf(p);
    h += `<div class="p-perk"><label>${T('s2.p.perk')}</label><b>${P(perk.name)}</b><span>${P(perk.desc)}</span>`
      + `<span class="p-net"><label>${T('s2.p.networkFx')}</label>${perk.network ? P(perk.network) : T('s2.p.networkNone')}</span></div>`;
    h += `<div class="p-traits">${E.people.traitsOf(p).map((tr) => miniCard(tr.card, E.i18n.pick(tr.name))).join('')}`
      + (m && m.inherited ? miniCard(data().traits.find((x) => x.id === m.inherited.trait).card, t('s2.p.inherited', { name: nameVar(m.inherited.from) })) : '')
      + `</div>`;
    h += `<div class="p-row flaw"><label>${T('s2.p.flaw')}</label><div><b>${P(flaw.name)}</b><span>${P(flaw.desc)}</span></div></div>`;
    h += `<div class="p-row"><label>${T('s2.p.quirks')}</label><div>${E.people.quirksOf(p).map((q) => `<span class="q"><b>${P(q.name)}</b><small>${P(q.desc)}</small></span>`).join('')}</div></div>`;
    const rels = N.relationsOf(s, id);
    if (rels.length) {
      h += `<div class="p-row rels"><label>${T('s2.p.relations')}</label><div>${rels.map((r) => {
        const rm = E.roster.get(s.roster, r.other);
        const where = rm ? T('s2.p.status.' + rm.status) : N.street(s).includes(r.other) ? T('s2.p.rel.street') : '';
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

  function stageChips(list, current) {
    return `<div class="chain">${list.map((id, i) => `<span class="${i < current ? 'done' : i === current ? 'now' : ''}">${P(stages()[id].name)}</span>`).join('<i>›</i>')}</div>`;
  }

  function rewardText(r) {
    return r.beds ? T('s2.day.rewardBeds', { n: r.beds }) : T('s2.day.reward', { n: r.support });
  }

  function opCard(e, tag = 'button') {
    const attrs = tag === 'button' ? ` data-act="op" data-key="${esc(e.key)}"` : '';
    return `<${tag} class="op-card kind-${e.kind}"${attrs}>`
      + `<div class="op-top"><em class="kind">${T('s2.day.kind.' + e.kind)}</em>`
      + (e.timer ? `<em class="urgent">${T('s2.day.timed', { n: e.timer })}</em>` : '')
      + (e.split ? `<em class="split">${T('s2.day.split')}</em>` : '')
      + (e.left !== undefined ? `<em class="urgent">${T('s2.day.left', { n: e.left })}</em>` : '')
      + (e.family ? `<em class="family">${T('s2.day.familyShort')}</em>` : '') + `</div>`
      + `<div class="op-main">${e.target ? `<div class="op-face">${face(e.target)}</div>` : ''}<div><div class="op-name">${P(e.name)}</div><div class="op-desc">${P(e.desc)}</div></div></div>`
      + stageChips(e.stages, -1)
      + (e.decoy ? `<div class="chain-label">${T('s2.op.decoy')}</div>` + stageChips(e.decoy, -1) : '')
      + `<div class="op-reward">${rewardText(e.reward)}</div></${tag}>`;
  }

  // ===== 主線任務：文字冒險 =====
  const chipText = (cmd) => t('verb.' + cmd[0]) + (cmd[1] ? ' ' + t('ent.' + cmd[1]) : '') + (cmd[2] ? ' · ' + t('topic.' + cmd[2]) : '');

  function storyLine(e, order) {
    if (e.c === 'pause') return '';
    const anim = order >= 0 ? ` new" style="animation-delay:${Math.min(order, 12) * 0.16}s` : '';
    if (e.c === 'input') return `<div class="sl c-input${anim}">&gt; ${esc(e.cmd ? chipText(e.cmd) : e.raw)}</div>`;
    const who = e.c === 'prof' && e.who ? `<span class="sl-face">${face(e.who)}</span>` : '';
    return `<div class="sl c-${e.c}${anim}">${who}<span>${T(e.k, e.v)}</span></div>`;
  }

  function renderStory() {
    const st = s.story;
    const scene = E.scenes[st.scene];
    const parts = t(scene.location).split('//').map((x) => x.trim());
    const lvl = st.exposure >= 60 ? 'hot' : st.exposure >= 30 ? 'warm' : 'cool';
    const first = storySeen;
    let h = `<section class="op-head story-head"><div class="op-art">${E.art.byKey(scene.art)}<div class="op-overlay">`
      + `<div class="story-loc">${esc(parts[0] || '')}</div><div class="op-title">${esc(parts[1] || '')}</div><div class="story-sub">${esc(parts.slice(2).join(' · '))}</div></div></div>`
      + `<div class="alert alert-${lvl}"><div class="alert-top"><span>${T('s2.story.alert')}</span><b>${st.exposure}</b></div><div class="alert-bar"><i style="width:${st.exposure}%"></i></div></div></section>`;
    h += `<section class="panel story"><div class="story-log" id="story-log">${s.storyLog.map((e, i) => storyLine(e, i >= first ? i - first : -1)).join('')}</div>`
      + `<div class="story-chips">${E.engine.suggestions(st).map((c) => `<button class="chip" data-act="storyChip" data-cmd="${esc(JSON.stringify(c))}">${esc(chipText(c))}</button>`).join('')}</div>`
      + `<form id="story-form" class="story-form" autocomplete="off"><span>&gt;</span><input id="story-cmd" type="text" spellcheck="false" placeholder="${T('s2.story.placeholder')}" aria-label="Command"><button type="submit" class="primary">${T('s2.story.send')}</button></form>`
      + `<div class="bar-actions"><button class="ghost" data-act="skipStory">${T('s2.story.skip')}</button></div></section>`;
    return h;
  }

  // 打字輸入：語言切換在這裡處理，其他交給第一季的場景引擎。
  function storyInput(text) {
    const cmd = E.parser.parse(text, E.scenes[s.story.scene], s.story);
    if (!cmd) return;
    if (cmd.verb === 'lang') {
      const r = (cmd.rest || '').trim().toLowerCase();
      const code = Object.keys(E.langAliases).find((c) => E.langAliases[c].includes(r));
      s.storyLog.push({ c: 'input', raw: text.trim() }, code ? { c: 'sys', k: 'lang.switched' } : { c: 'err', k: 'lang.unknown' });
      if (code) setLang(code);
    } else if (cmd.verb !== 'restart') {
      N.storyCommand(s, cmd, { c: 'input', raw: text.trim() });
    }
    afterStory();
  }

  function afterStory() {
    if (s.phase === 'start') {
      picks = {};
      window.scrollTo(0, 0);
    }
    commit();
  }

  // 新出現的劇情行：標題跳出全螢幕卡，其他依類型播放音效。
  function storyFeedback() {
    if (!s.storyLog) return;
    const fresh = s.storyLog.slice(storySeen);
    storySeen = s.storyLog.length;
    const title = fresh.find((e) => e.c === 'title');
    if (title) {
      cine('title', `<div class="cine-title">${T(title.k, title.v)}</div>`, 2400);
      E.fx.sfx.play('title');
    } else if (fresh.some((e) => e.c === 'warn')) E.fx.sfx.play('alarm');
    else if (fresh.some((e) => e.c === 'prof')) E.fx.sfx.play('prof');
    else if (fresh.some((e) => e.c === 'cost')) E.fx.sfx.play('hack');
    else if (fresh.length) E.fx.sfx.play('blip');
    const log = $('story-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  // ===== 倫敦地圖：第二季原型只開放康登，其他區之後才會解鎖 =====
  const MAP = {
    camden: { d: 'M296 34 L414 26 L462 80 L440 142 L332 152 L282 104 Z', c: [372, 88] },
    soho: { d: 'M318 166 L430 160 L452 206 L404 236 L332 234 L304 200 Z', c: [378, 200] },
    westminster: { d: 'M196 196 L298 200 L322 240 L300 274 L214 280 L176 238 Z', c: [250, 240] },
    rotherhithe: { d: 'M424 318 L556 304 L598 346 L560 386 L446 390 L404 356 Z', c: [500, 350] },
    isle_of_dogs: { d: 'M636 262 L690 256 L712 306 L686 346 L644 334 L626 298 Z', c: [668, 302] },
  };
  const RIVER = 'M0 300 C100 292 160 312 230 300 C300 288 340 262 410 268 C480 274 520 300 590 290 C620 286 618 240 668 236 C724 232 744 296 724 340 C704 384 640 372 618 330 C600 300 660 286 720 292 C760 296 780 300 800 300';
  function renderMap() {
    const D = data().districts;
    let g = `<path d="${RIVER}" fill="none" stroke="#17324d" stroke-width="26" stroke-linecap="round"/><path d="${RIVER}" fill="none" stroke="#25507a" stroke-width="2" opacity="0.6"/>`;
    for (const [id, m] of Object.entries(MAP)) {
      const name = P(D[id].name);
      if (id === 'camden') {
        const a = 0.18 + s.support / 100 * 0.6;
        g += `<path d="${m.d}" fill="rgba(255,46,136,${a.toFixed(2)})" stroke="#ff2e88" stroke-width="2.5"/>`
          + `<text x="${m.c[0]}" y="${m.c[1] - 8}" class="map-name live">${name}</text>`
          + `<text x="${m.c[0]}" y="${m.c[1] + 14}" class="map-sub">${T('s2.ui.support')} ${s.support}%</text>`
          + Array.from({ length: s.towers }, (_, i) => `<path d="M${m.c[0] - 34 + i * 20} ${m.c[1] + 42} l6 -16 l6 16 Z" fill="#ffd23f"/>`).join('')
          + `<circle cx="${m.c[0] + 50}" cy="${m.c[1] + 34}" r="5" fill="#6cd6e2"/><text x="${m.c[0] + 60}" y="${m.c[1] + 38}" class="map-pin">${T('s2.map.here')}</text>`;
      } else {
        g += `<path d="${m.d}" fill="#121722" stroke="#2c3446" stroke-width="2" stroke-dasharray="6 5"/>`
          + `<text x="${m.c[0]}" y="${m.c[1] - 4}" class="map-name">${name}</text><text x="${m.c[0]}" y="${m.c[1] + 16}" class="map-sub">${T('s2.map.locked')}</text>`;
      }
    }
    return `<section class="map"><svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${g}</svg>`
      + `<div class="banner-txt"><div class="banner-night">${T('s2.ui.nightOf', { n: s.night, max: N.MAX_NIGHTS })}</div><div class="banner-loc">${P(D.camden.name)}</div></div></section>`;
  }

  // ===== 各階段 =====
  function renderStart() {
    const chosen = ids();
    const hero = s.hero;
    const need = hero ? 1 : 2;
    const cards = s.volunteers.map((id) => (id === hero
      ? personCard(id, { full: true, selected: true, cls: 'is-hero', badge: `<em class="hero">${T('s2.start.you')}</em>` })
      : personCard(id, { full: true, act: 'vol', selected: !!picks[id] })));
    return `<section class="panel">${bagleyBox()}<h2>${T(hero ? 's2.start.title2' : 's2.start.title')}</h2><p class="hint">${T(hero ? 's2.start.hint2' : 's2.start.hint')}</p>`
      + `<div class="grid-people">${cards.join('')}</div>`
      + `<div class="bar-actions"><span class="hint">${T('s2.start.picked', { n: chosen.length + (hero ? 1 : 0) })}</span>`
      + `<button class="primary" data-act="begin"${chosen.length === need ? '' : ' disabled'}>${T('s2.start.go')}</button></div></section>`;
  }

  function renderDay() {
    const ops = N.ops(s);
    const street = N.street(s);
    const owed = Object.keys(s.owed);
    let h = renderMap();
    if (s.tonight) {
      h += `<section class="counter counter-${s.tonight.type}"><b>${T('s2.counter.' + s.tonight.type + '.title')}</b><p>${T('s2.counter.' + s.tonight.type)}</p>`
        + (s.tonight.type === 'raid' ? `<p class="warn">${T('s2.day.raidHint')}</p>` : '') + `</section>`;
    } else h += bagleyBox();
    h += `<section class="panel"><h2>${T('s2.day.ops')}</h2><p class="hint">${T('s2.day.opsHint')}</p><div class="ops">${ops.map((e) => opCard(e)).join('')}</div>`
      + `<div class="bar-actions"><button data-act="rest">${T('s2.day.rest')}</button></div></section>`;
    if (owed.length) {
      h += `<section class="panel"><h2>${T('s2.day.owed')}</h2><p class="hint">${T('s2.day.owedHint')}</p><div class="grid-people">${owed.map((id) => personCard(id, {
        full: true,
        footer: `<div class="p-foot"><button class="primary" data-act="recruit" data-id="${id}">${T('s2.day.recruit')}</button></div>`,
      })).join('')}</div></section>`;
    }
    h += `<section class="panel"><h2>${T('s2.day.street')}</h2><p class="hint">${T('s2.day.streetHint')}</p><div class="grid-people">${street.map((id) => (s.scanned[id]
      ? personCard(id, { full: true, cls: 'scanned' })
      : personCard(id, { cls: 'unscanned', footer: `<div class="p-foot"><button data-act="scan" data-id="${id}">${T('s2.day.scan')}</button></div>` }))).join('')}</div></section>`;
    return h;
  }

  function renderSquad() {
    const e = N.picked(s);
    const pool = s.roster.members.filter((m) => m.status === 'active' || m.status === 'network').map((m) => m.person.id);
    const chosen = ids();
    const check = N.squadCheck(s, chosen, picks);
    const combos = N.combosFor(s, chosen);
    let reason = '';
    if (!check.ok && chosen.length) reason = t(check.reason, check.a ? { a: nameVar(check.a), b: nameVar(check.b) } : {});
    let h = `<section class="panel brief">${opCard(e, 'div')}</section>`;
    h += `<section class="panel"><h2>${T('s2.squad.title')}</h2>${e.split ? `<p class="hint">${T('s2.squad.laneHint')}</p>` : ''}<div class="grid-people">${pool.map((id) => {
      const lane = picks[id];
      const net = E.roster.get(s.roster, id).status === 'network';
      const badges = (net ? `<em class="net">${T('s2.squad.networkTag')}</em>` : '') + (lane && e.split ? `<em class="lane lane-${lane}">${T('s2.squad.lane.' + lane)}</em>` : '');
      return personCard(id, { full: true, act: 'squad', selected: !!lane, cls: (net ? 'is-net' : '') + (lane === 'decoy' ? ' is-decoy' : ''), badge: badges });
    }).join('')}</div>`;
    h += `<div class="bar-actions"><div class="squad-info">`
      + (chosen.length ? `<span class="chip">${T('s2.squad.startAlert', { n: N.startAlert(s, chosen) })}</span>` : '')
      + combos.map((c) => { const def = data().combos.find((x) => x.id === c); return `<span class="chip combo${c === 'derby' ? ' bad' : ''}" title="${P(def.desc)}">${T('s2.squad.combos')}：${P(def.name)}</span>`; }).join('')
      + (reason ? `<span class="warn">${esc(reason)}</span>` : '')
      + `</div><button data-act="back">${T('s2.squad.back')}</button><button class="primary" data-act="go"${check.ok ? '' : ' disabled'}>${T('s2.squad.go')}</button></div></section>`;
    return h;
  }

  function alertStatus(a) {
    return a >= 60 ? 's2.op.alert.60' : a >= 30 ? 's2.op.alert.30' : 's2.op.alert.0';
  }

  // 一條線（主力或佯攻）目前這一關的所有解法。
  function lanePanel(lane, split) {
    const op = s.op;
    const L = op.lanes[lane];
    const st = N.stage(s, lane);
    const label = split ? `<span class="lane-tag lane-${lane}">${T('s2.op.' + lane)}</span>` : '';
    if (!st) return `<section class="panel stage lane-${lane} done"><h2>${label}${T('s2.op.decoyDone')}</h2></section>`;
    const options = N.options(s, lane).sort((a, b) => (b.candidates.some((c) => c.ok) ? 1 : 0) - (a.candidates.some((c) => c.ok) ? 1 : 0));
    let h = `<section class="panel stage lane-${lane}"><h2>${label}${P(st.name)} <small>${T('s2.op.stage', { i: L.i + 1, n: L.stages.length })}</small></h2>`
      + `<p class="stage-desc">${P(st.desc)}</p>${lane === 'main' ? `<p class="hint">${T('s2.op.hint')}</p>` : ''}<div class="apprs">`;
    for (const o of options) {
      const a = o.approach;
      const any = o.candidates.some((c) => c.ok);
      const tags = [];
      if (a.sure) tags.push(`<em class="sure">${T('s2.op.sure')}</em>`);
      if (N.hackable(a)) tags.push(`<em class="hackable">⌨ ${T('s2.hack.title')}</em>`);
      if (a.bandwidth) tags.push(`<em>${T('s2.op.bw', { n: a.bandwidth })}</em>`);
      if (a.injure) tags.push(`<em class="risky">${T('s2.op.injure')}</em>`);
      h += `<div class="appr${a.hidden ? ' is-hidden' : ''}${a.only || a.id === 'keycard' || a.id === 'network_cab' ? ' is-special' : ''}${any ? '' : ' none'}">`
        + `<div class="appr-head"><b>${P(a.name)}</b>${a.hidden ? `<em class="hid">${T('s2.op.hidden')}</em>` : ''}${tags.join('')}</div><div class="cands">`;
      h += o.candidates.map((c) => (c.ok
        ? `<button class="cand ${c.risk <= 0.2 ? 'hi' : c.risk <= 0.45 ? 'mid' : 'lo'}" data-act="do" data-a="${esc(a.id)}" data-who="${c.id}">${face(c.id)}<span class="cn">${nm(c.id)}</span><span class="pc">${pct(c.risk)}%</span><span class="cx">+${c.exposure}</span></button>`
        : `<div class="cand off">${face(c.id)}<span class="cn">${nm(c.id)}</span><span class="why">${T(c.reason)}</span></div>`)).join('');
      h += `</div></div>`;
    }
    return h + `</div></section>`;
  }

  function renderOp() {
    const op = s.op;
    const split = !!op.lanes.decoy;
    const st = N.stage(s, 'main');
    const combos = N.combos(s);
    const lvl = op.alert >= 60 ? 'hot' : op.alert >= 30 ? 'warm' : 'cool';
    let h = `<section class="op-head"><div class="op-art">${E.art.byKey(st.art)}<div class="op-overlay"><div class="op-title">${P(op.name)}</div>`
      + stageChips(op.lanes.main.stages, op.lanes.main.i)
      + (split ? stageChips(op.lanes.decoy.stages, op.lanes.decoy.i) : '') + `</div></div>`;
    h += `<div class="alert alert-${lvl}"><div class="alert-top"><span>${T('s2.op.alert')}</span><b>${op.alert}</b><em>${T(alertStatus(op.alert))}</em></div>`
      + `<div class="alert-bar"><i style="width:${op.alert}%"></i><u style="left:30%"></u><u style="left:60%"></u></div></div>`;
    h += `<div class="op-meta">`
      + (op.timer !== null ? `<span class="chip timer${op.timer <= 2 ? ' bad' : ''}">⏱ ${T('s2.op.timer', { n: op.timer })}</span>` : '')
      + `<span class="chip">${T('s2.op.bandwidth')} <b class="pips">${'▮'.repeat(op.bw)}<u>${'▮'.repeat(Math.max(0, N.BANDWIDTH - op.bw))}</u></b></span>`
      + (split ? `<span class="chip combo">${T('s2.op.screen', { n: op.screen })}</span>` : '')
      + (s.tonight && s.tonight.type !== 'raid' ? `<span class="chip bad">${T('s2.counter.' + s.tonight.type + '.title')}</span>` : '')
      + (op.keycard ? `<span class="chip good">${T('s2.op.keycard')}</span>` : '')
      + combos.map((c) => { const def = data().combos.find((x) => x.id === c); return `<span class="chip combo${c === 'derby' ? ' bad' : ''}" title="${P(def.desc)}">${P(def.name)}</span>`; }).join('')
      + `</div>`;
    h += `<div class="squad-strip">${N.members(s).map((id) => {
      const flags = [];
      if (split) flags.push(T('s2.op.' + N.laneOf(s, id)));
      if (op.temp.includes(id)) flags.push(T('s2.op.helper'));
      if (op.called.includes(id)) flags.push(T('s2.p.status.network'));
      if (op.sulk[id]) flags.push(T('s2.op.sulking'));
      if (!N.able(s, id)) flags.push(T('s2.need.out'));
      return `<button class="strip-m${N.able(s, id) ? '' : ' out'}" data-act="profile" data-id="${id}">${face(id)}<span>${nm(id)}</span>${flags.length ? `<small>${flags.join(' · ')}</small>` : ''}</button>`;
    }).join('')}</div></section>`;

    h += lanePanel('main', split);
    if (split) h += lanePanel('decoy', split);

    const cards = N.cards(s);
    h += `<section class="panel hand"><h2>${T('s2.op.cards')}</h2><div class="cards">${cards.map((c) => `<button class="tcard kind-${c.card.kind}${c.used ? ' used' : ''}${c.inherited ? ' inherited' : ''}" data-act="card" data-owner="${c.owner}" data-id="${c.id}"${c.usable ? '' : ' disabled'}>`
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
      + `<div class="res-nums">${r.support ? `<b class="up">${T('s2.res.support', { n: r.support })}</b>` : ''}${r.beds ? `<b class="up">${T('s2.day.rewardBeds', { n: r.beds })}</b>` : ''}`
      + `${r.heat ? `<b class="down">${T('s2.res.heat', { n: r.heat })}</b>` : ''}</div>`
      + `<div class="res-log">${lines.map((e) => `<div class="ln c-${e.c}">${T(e.k, e.v)}</div>`).join('')}</div>`
      + `<div class="bar-actions"><button class="primary" data-act="next">${T('s2.res.next')}</button></div></section>`;
  }

  function renderEnd() {
    const k = s.ended;
    const faces = (list) => (list.length ? list.map((id) => `<span class="end-face">${face(id)}<small>${nm(id)}</small></span>`).join('') : `<span class="hint">${T('s2.end.none')}</span>`);
    return `<section class="panel endcard end-${k}"><div class="end-label">${T('s2.end.card')}</div><h2>${T('s2.end.' + k + '.title')}</h2><p class="end-text">${T('s2.end.' + k + '.text')}</p>`
      + `<div class="end-stats"><span>${T('s2.end.nights', { n: Math.min(s.night, N.MAX_NIGHTS) })}</span><span>${T('s2.end.ops', { n: s.stats.ops, w: s.stats.wins })}</span><span>${T('s2.ui.support')} ${s.support}%</span></div>`
      + `<div class="end-row"><label>${T('s2.end.recruited')}</label><div class="end-faces">${faces(s.stats.recruited)}</div></div>`
      + (s.stats.retired.length ? `<div class="end-row"><label>${T('s2.p.status.retired')}</label><div class="end-faces">${faces(s.stats.retired)}</div></div>` : '')
      + `<div class="end-row"><label>${T('s2.end.lost')}</label><div class="end-faces">${faces(s.stats.lost)}</div></div>`
      + `<p class="hint">${T('s2.end.note')}</p><div class="bar-actions"><button class="primary" data-act="again">${T('s2.end.again')}</button></div></section>`;
  }

  // ===== 手動駭入的小遊戲 =====
  const TILE = { I: 'M50 0 V100', L: 'M50 0 V50 H100', T: 'M50 0 V100 M50 50 H100' };
  function tileSvg(cell, spins) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><g style="transform:rotate(${spins * 90}deg)"><path d="${TILE[cell.type]}"/><circle cx="50" cy="50" r="9"/></g></svg>`;
  }
  function renderHack() {
    const h0 = hack;
    if (h0.stage === 'choose') {
      return `<div class="modal-card hack-choose"><div class="modal-face">${face(h0.who)}</div><h3>${T('s2.hack.choose')}</h3>`
        + `<div class="modal-actions stack"><button data-act="hackAuto">${T('s2.hack.auto', { n: pct(h0.risk), x: h0.exposure })}</button>`
        + `<button class="primary" data-act="hackManual">⌨ ${T('s2.hack.manual', { s: h0.spec.seconds, x: h0.spec.exposure })}</button>`
        + `<button class="ghost" data-act="hackCancel">${T('s2.act.cancel')}</button></div></div>`;
    }
    const pz = h0.pz;
    const lit = E.puzzle.lit(pz);
    let grid = '';
    for (let y = 0; y < pz.h; y++) {
      grid += `<span class="pz-end${y === pz.start ? ' src' : ''}">${y === pz.start ? '▶' : ''}</span>`;
      for (let x = 0; x < pz.w; x++) {
        const i = y * pz.w + x;
        grid += `<button class="pz-tile${lit.has(i) ? ' on' : ''}" data-act="tile" data-i="${i}">${tileSvg(pz.cells[i], h0.spins[i])}</button>`;
      }
      grid += `<span class="pz-end${y === pz.end ? ' dst' : ''}">${y === pz.end ? '◉' : ''}</span>`;
    }
    const status = h0.stage === 'solved' ? `<b class="pz-ok">${T('s2.hack.solved')}</b>` : h0.stage === 'timeout' ? `<b class="pz-bad">${T('s2.hack.timeout')}</b>` : '';
    return `<div class="modal-card hack-play stage-${h0.stage}"><h3>⌨ ${T('s2.hack.title')}　<small>${nm(h0.who)}</small></h3><p class="hint">${T('s2.hack.hint')}</p>`
      + `<div class="pz-timer"><i id="pz-bar"></i></div><div class="pz-status" id="pz-status">${status}</div>`
      + `<div class="pz-grid" style="grid-template-columns: 22px repeat(${pz.w}, var(--tile)) 22px">${grid}</div>`
      + `<div class="modal-actions"><button class="ghost" data-act="giveUp"${h0.stage === 'play' ? '' : ' disabled'}>${T('s2.hack.giveUp')}</button></div></div>`;
  }

  function startHack() {
    hack.pz = E.puzzle.generate(hack.spec.seed, hack.spec.size);
    hack.spins = hack.pz.cells.map((c) => c.rot);
    hack.stage = 'play';
    hack.total = hack.spec.seconds * 1000;
    hack.deadline = Date.now() + hack.total;
    clearInterval(hackTimer);
    hackTimer = setInterval(() => {
      if (!hack || hack.stage !== 'play') return clearInterval(hackTimer);
      const left = hack.deadline - Date.now();
      const bar = $('pz-bar');
      if (bar) {
        bar.style.width = Math.max(0, left / hack.total * 100) + '%';
        bar.classList.toggle('low', left < 8000);
      }
      if (left <= 0) endHack(false);
    }, 100);
  }

  // 點一格：只更新那一格和亮起來的線路，不重畫整個對話框，轉動動畫才看得到。
  function turnTile(i) {
    if (!hack || hack.stage !== 'play') return;
    const solved = E.puzzle.turn(hack.pz, i);
    hack.spins[i]++;
    E.fx.sfx.play('click');
    const tiles = document.querySelectorAll('.pz-tile');
    const g = tiles[i] && tiles[i].querySelector('g');
    if (g) g.style.transform = `rotate(${hack.spins[i] * 90}deg)`;
    const lit = E.puzzle.lit(hack.pz);
    tiles.forEach((el, j) => el.classList.toggle('on', lit.has(j)));
    if (solved) endHack(true);
  }

  function endHack(solved) {
    if (!hack || hack.stage !== 'play') return;
    clearInterval(hackTimer);
    hack.stage = solved ? 'solved' : 'timeout';
    E.fx.sfx.play(solved ? 'hack' : 'loss');
    const card = document.querySelector('.hack-play');
    if (card) card.classList.add('stage-' + hack.stage);
    const st = $('pz-status');
    if (st) st.innerHTML = solved ? `<b class="pz-ok">${T('s2.hack.solved')}</b>` : `<b class="pz-bad">${T('s2.hack.timeout')}</b>`;
    setTimeout(() => {
      const h0 = hack;
      hack = null;
      if (h0) N.act(s, h0.aid, h0.who, { solved });
      commit();
    }, solved ? 900 : 700);
  }

  // ===== 對話框：事件、反應、駭入、人物檔案 =====
  function profileActions(id) {
    const m = E.roster.get(s.roster, id);
    if (!m || s.phase !== 'day') return '';
    const btn = (act, key, v, ok = true, cls = '') => `<button class="${cls}" data-act="${act}" data-id="${id}"${ok ? '' : ' disabled'}>${T(key, v)}</button>`;
    const out = [];
    const hints = [];
    if (m.status === 'active' || m.status === 'injured') {
      out.push(btn('home', 's2.act.home'));
      hints.push(T('s2.act.homeHint'));
    }
    if (m.status === 'network') out.push(btn('callBack', 's2.act.callBack', {}, E.roster.canRecruit(s.roster)) + (E.roster.canRecruit(s.roster) ? '' : `<span class="hint">${T('s2.act.noBed')}</span>`));
    if (['active', 'injured', 'network'].includes(m.status)) {
      out.push(btn('lowkey', 's2.act.lowkey', { n: N.LOW_NIGHTS }));
      hints.push(T('s2.act.lowkeyHint', { n: N.LOW_NIGHTS }));
      out.push(btn('retire', 's2.act.retire', {}, N.canRetire(s, id), 'gold'));
      if (!N.canRetire(s, id)) hints.push(T('s2.act.retireNeed', { n: N.RETIRE_WINS }));
    }
    if (!out.length) return '';
    return `<div class="p-actions">${out.join('')}</div><p class="hint small">${hints.join('　')}</p>`;
  }

  function renderModal() {
    const el = $('s2-modal');
    let h = '';
    if (hack) {
      h = renderHack();
    } else if (s.phase === 'event' && s.event) {
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
    } else if (retiring) {
      const p = who(retiring);
      h = `<div class="modal-card retire"><div class="modal-face">${face(retiring)}</div><h3>${T('s2.act.retireTitle')}</h3><p class="hint">${T('s2.act.retireHint')}</p>`
        + `<div class="p-traits pick">${E.people.traitsOf(p).map((tr) => `<button class="pick-card" data-act="retirePick" data-trait="${tr.id}">${miniCard(tr.card, E.i18n.pick(tr.name))}</button>`).join('')}</div>`
        + `<div class="modal-actions"><button class="ghost" data-act="retireCancel">${T('s2.act.cancel')}</button></div></div>`;
    } else if (profileId) {
      h = `<div class="modal-card profile">${personCard(profileId, { full: true })}${profileActions(profileId)}<div class="modal-actions"><button data-act="close">${T('s2.ui.close')}</button></div></div>`;
    }
    el.hidden = !h;
    el.innerHTML = h;
    if (hack && hack.stage === 'play') {
      const bar = $('pz-bar');
      if (bar) bar.style.width = Math.max(0, (hack.deadline - Date.now()) / hack.total * 100) + '%';
    }
  }

  // ===== 側欄：隊伍分成安全屋、外圍網路、離隊 =====
  function renderTeam() {
    const row = (m) => {
      const id = m.person.id;
      let st = T('s2.p.status.' + m.status);
      if (m.status === 'injured') st += ' · ' + m.injuredFor;
      if (m.status === 'away') st += ' · ' + m.awayFor;
      if (m.status === 'arrested') st += ' · ' + T('s2.day.left', { n: E.roster.TRANSFER_AFTER - (s.night - m.since) });
      const threat = m.threat || 0;
      return `<button class="mem st-${m.status}" data-act="profile" data-id="${id}"><span class="mem-face">${face(id)}</span>`
        + `<span class="mem-txt"><b>${nm(id)}</b><small>${P(E.people.occupationOf(m.person).name)}</small></span>`
        + `<span class="mem-st">${st}<small class="${threat >= N.WANTED ? 'wanted' : threat >= 50 ? 'high' : ''}">${T('s2.p.threat', { n: threat })}</small></span></button>`;
    };
    const group = (label, list) => (list.length ? `<div class="team-group"><div class="team-label">${label}</div>${list.map(row).join('')}</div>` : '');
    const ms = s.roster.members;
    $('s2-team').innerHTML = group(T('s2.ui.core'), ms.filter((m) => ['active', 'injured', 'away', 'arrested'].includes(m.status)))
      + group(T('s2.ui.network'), ms.filter((m) => m.status === 'network'))
      + group(T('s2.ui.gone'), ms.filter((m) => m.status === 'retired' || m.status === 'lost'));
  }

  // ===== 整個畫面 =====
  function render() {
    $('m-night').textContent = t('s2.ui.nightOf', { n: Math.min(s.night, N.MAX_NIGHTS), max: N.MAX_NIGHTS });
    $('m-support').style.width = s.support + '%';
    $('m-support-v').textContent = s.support + '%';
    $('m-heat').style.width = s.heat + '%';
    $('m-heat-v').textContent = s.heat;
    $('m-towers').textContent = s.towers + '/4';
    $('m-world').textContent = t('s2.world.chip', { ending: { t: 's2.world.' + s.world } });
    $('m-world').title = t('s2.world.' + s.world + '.d');
    $('s2-beds').textContent = t('s2.ui.beds', { n: E.roster.housed(s.roster).length, max: s.roster.capacity });
    renderTeam();

    const log = $('s2-log');
    log.innerHTML = s.log.slice(-150).map((e) => `<div class="ln c-${e.c}">${T(e.k, e.v)}</div>`).join('');
    log.scrollTop = log.scrollHeight;

    const main = $('s2-main');
    const phase = s.phase === 'event' || s.phase === 'react' ? 'op' : s.phase;
    main.dataset.phase = phase;
    main.innerHTML = { story: renderStory, start: renderStart, day: renderDay, squad: renderSquad, op: renderOp, result: renderResult, end: renderEnd }[phase]();
    renderModal();
    if (phase === 'story') {
      const log2 = $('story-log');
      if (log2) log2.scrollTop = log2.scrollHeight;
      if (!window.matchMedia('(pointer: coarse)').matches && !hack && !profileId) $('story-cmd').focus();
    }
  }

  // 新出現的紀錄決定音效和畫面閃一下。
  function feedback() {
    const fresh = s.log.slice(seen);
    seen = s.log.length;
    if (!fresh.length) return;
    const has = (fn) => fresh.some(fn);
    const main = $('s2-main');
    if (has((e) => /^s2\.(alert|counter)\./.test(e.k))) {
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
    storyFeedback();
  }

  // ===== 操作 =====
  const toggle = (id, max, lanes) => {
    const order = lanes ? [undefined, 'main', 'decoy'] : [undefined, 'main'];
    const next = order[(order.indexOf(picks[id]) + 1) % order.length];
    if (next && !picks[id] && ids().length >= max) return;
    if (next) picks[id] = next;
    else delete picks[id];
  };

  const actions = {
    // 有主角時只要再挑一個人：點另一個人就直接換掉。
    vol(d) {
      if (d.id === s.hero) return;
      if (s.hero) picks = picks[d.id] ? {} : { [d.id]: 'main' };
      else toggle(d.id, 2, false);
    },
    begin() { if (N.pickVolunteers(s, ids())) { picks = {}; window.scrollTo(0, 0); } },
    storyChip(d) {
      const c = JSON.parse(d.cmd);
      N.storyCommand(s, { verb: c[0], target: c[1] || null, topic: c[2] || null, rest: '', raw: '' }, { c: 'input', cmd: c });
      if (s.phase === 'start') { picks = {}; window.scrollTo(0, 0); }
    },
    skipStory() { if (window.confirm(t('s2.story.skipConfirm'))) { N.skipStory(s); picks = {}; window.scrollTo(0, 0); } },
    scan(d) { N.scan(s, d.id); E.fx.sfx.play('prof'); },
    recruit(d) { N.recruitOwed(s, d.id); },
    op(d) { if (N.pickOp(s, d.key)) picks = {}; window.scrollTo(0, 0); },
    squad(d) { const e = N.picked(s); toggle(d.id, e.split ? N.MAX_SPLIT : N.MAX_SQUAD, e.split); },
    back() { N.cancel(s); picks = {}; },
    go() {
      if (!N.launch(s, ids(), picks)) return;
      picks = {};
      window.scrollTo(0, 0);
      cine('title', `<div class="cine-title">${P(s.op ? s.op.name : s.result.name)}</div>`, 1600);
      E.fx.sfx.play('title');
    },
    rest() { N.rest(s); },
    do(d) {
      if (s.phase !== 'op') return;
      const opt = N.options(s, N.laneOf(s, d.who)).find((o) => o.approach.id === d.a);
      const spec = opt && N.hackable(opt.approach) && N.puzzleSpec(s, d.a, d.who);
      if (spec) {
        const c = opt.candidates.find((x) => x.id === d.who);
        hack = { stage: 'choose', aid: d.a, who: d.who, spec, risk: c.risk, exposure: c.exposure };
        return;
      }
      N.act(s, d.a, d.who);
    },
    hackAuto() { const h0 = hack; hack = null; N.act(s, h0.aid, h0.who); },
    hackManual() { startHack(); },
    hackCancel() { hack = null; },
    giveUp() { endHack(false); },
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
      } else if (s.tonight) {
        cine('desync', `<div class="cine-desync" data-text="${T('s2.counter.' + s.tonight.type + '.title')}">${T('s2.counter.' + s.tonight.type + '.title')}</div>`, 1800);
      }
    },
    again() { newRun(); },
    profile(d) { profileId = d.id; },
    close() { profileId = null; },
    home(d) { N.sendHome(s, d.id); },
    callBack(d) { N.callBack(s, d.id); },
    lowkey(d) { N.layLow(s, d.id); },
    retire(d) { retiring = d.id; profileId = null; },
    retirePick(d) { N.retire(s, retiring, d.trait); retiring = null; },
    retireCancel() { profileId = retiring; retiring = null; },
  };
  // 這些操作只換對話框，不關掉人物檔案。
  const KEEP_PROFILE = ['profile', 'close', 'home', 'callBack', 'lowkey', 'retire', 'retirePick', 'retireCancel'];

  function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (el && el.dataset.act === 'world') return startRun(el.dataset.w, false);
    if (!el || el.disabled || !s) return;
    E.fx.sfx.unlock();
    if (el.dataset.act === 'tile') return turnTile(Number(el.dataset.i));
    const before = s.phase;
    actions[el.dataset.act](el.dataset);
    if (!KEEP_PROFILE.includes(el.dataset.act)) profileId = null;
    // 行動結束時跳出結果卡。
    if (before !== 'result' && s.phase === 'result' && s.result.outcome !== 'rest') {
      const ok = s.result.outcome === 'win';
      cine(ok ? 'title' : 'desync', ok ? `<div class="cine-title">${T('s2.res.win')}</div>` : `<div class="cine-desync" data-text="${T('s2.res.' + s.result.outcome)}">${T('s2.res.' + s.result.outcome)}</div>`, 1500);
    }
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
    if (worldOpen) worldPicker();
  }

  // fresh 為 true 時（新的一輪），主線任務的開場文字會一行一行出現。
  function show(fresh) {
    $('s2-title').hidden = true;
    $('s2-game').hidden = false;
    seen = s.log.length;
    storySeen = fresh ? 0 : (s.storyLog || []).length;
    render();
    if (fresh) storyFeedback();
  }

  // 新的一輪：讀得到第一季的結局就直接用，讀不到就讓 Bagley 問。
  function newRun() {
    const found = E.save.v1Ending();
    if (found) startRun(found, true);
    else worldPicker();
  }

  function worldPicker() {
    worldOpen = true;
    const el = $('s2-modal');
    el.hidden = false;
    el.innerHTML = `<div class="modal-card world"><div class="modal-face">${E.art.avatar('bagley')}</div><h3>${T('s2.world.title')}</h3><p>${T('s2.world.ask')}</p><div class="modal-actions stack">`
      + N.WORLDS.map((w) => `<button data-act="world" data-w="${w}"><b>${T('s2.world.' + w)}</b><small>${T('s2.world.' + w + '.d')}</small></button>`).join('')
      + `<button class="primary" data-act="world" data-w="stay">${T('s2.world.none')}</button></div></div>`;
  }

  function startRun(world, found) {
    worldOpen = false;
    const fromUrl = new URLSearchParams(location.search).get('seed');
    s = N.create(fromUrl || Date.now().toString(36), { world });
    if (found && s.storyLog) s.storyLog.unshift({ c: 'sys', k: 's2.world.found', v: { ending: { t: 's2.world.' + world } } });
    picks = {};
    profileId = null;
    retiring = null;
    hack = null;
    slot.write(s);
    show(true);
  }

  function init() {
    E.i18n.set(lsGet(LANG_KEY) || 'zh-Hant');
    $('s2-title-art').innerHTML = E.art.byKey('arches');
    applyStatic();
    const saved = slot.read();
    $('s2-continue').hidden = !saved;
    document.addEventListener('click', (ev) => {
      if (ev.target.id === 's2-modal' && profileId && !hack) { profileId = null; return renderModal(); }
      const lang = ev.target.closest('[data-lang]');
      if (lang) return setLang(lang.dataset.lang);
      onClick(ev);
    });
    document.addEventListener('submit', (ev) => {
      if (ev.target.id !== 'story-form') return;
      ev.preventDefault();
      const text = $('story-cmd').value;
      if (text.trim() && s && s.phase === 'story') { E.fx.sfx.unlock(); storyInput(text); }
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
