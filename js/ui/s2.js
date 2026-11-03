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
  // 第 4 版存檔：整個戰役（五個行政區、主線任務一到八）。舊版的原型存檔不相容，直接開新的一輪。
  const slot = E.save.slot('watchdogs-echo.s2.proto', 4);
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
  let tut = null;        // 戰術教學關的沙盒（不存檔；有的話主畫面改畫教學，結束後回到原本的畫面）
  let tutSeen = 0;       // 教學關已經處理過音效的紀錄行數
  const TUT_KEY = 'watchdogs-echo.s2.tutorial'; // 'offered' 問過要不要玩教學、'done' 玩完了
  let goalsOpen = false; // 主線任務的目標清單有沒有展開
  const teamOpen = {};   // 側欄每一組有沒有展開（玩家自己點過才記下來）

  const who = (id) => N.person(s, id);
  const nm = (id) => P(E.people.name(who(id)));
  const face = (id) => E.faces.of(who(id));
  const pct = (risk) => Math.round((1 - risk) * 100);
  const nameVar = (id) => ({ l: E.people.name(who(id)) });
  const ids = () => Object.keys(picks);
  const BAD_COMBOS = ['derby', 'feud']; // 扣分的默契組合

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 無法存的話就算了 */ } }

  // ===== 共用元件 =====
  function skills(p) {
    return `<div class="p-skills">${['hack', 'physical', 'social'].map((k) =>
      `<span><label>${T('s2.p.' + k)}</label><i>${'●'.repeat(p.skills[k])}<u>${'●'.repeat(3 - p.skills[k])}</u></i></span>`).join('')}</div>`;
  }

  function miniCard(card, sub, attrs = '') {
    return `<div class="mini kind-${card.kind}"${attrs}><div class="mini-top"><b>${P(card.name)}</b><em>${T('s2.op.kind.' + card.kind)}</em></div>`
      + (sub ? `<small>${esc(sub)}</small>` : '') + `<p>${P(card.desc)}</p>` + tacLine(card.tac) + `</div>`;
  }
  // 戰術地圖上的效果（「地圖」那一行）。
  const tacLine = (fx) => (fx ? `<p class="p-tac"><i>${T('s2.p.tacFx')}</i>${P(fx)}</p>` : '');

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
      + (m && m.critical ? `<em class="threat wanted">${T('s2.p.critical')}</em>` : '')
      + (m && m.hunted ? `<em class="threat high">${T('s2.p.hunted')}</em>` : '')
      + `</span></div></header>`;
    h += skills(p);
    if (!opt.full) return h + (opt.footer || '') + '</article>';

    const perk = E.people.perkOf(p);
    const flaw = E.people.flawOf(p);
    h += `<div class="p-perk"><label>${T('s2.p.perk')}</label><b>${P(perk.name)}</b><span>${P(perk.desc)}</span>`
      + (perk.tac ? `<span class="p-net p-tac"><label>${T('s2.p.tacFx')}</label>${P(perk.tac)}</span>` : '')
      + `<span class="p-net"><label>${T('s2.p.networkFx')}</label>${perk.network ? P(perk.network) : T('s2.p.networkNone')}</span></div>`;
    h += `<div class="p-traits">${E.people.traitsOf(p).map((tr) => miniCard(tr.card, E.i18n.pick(tr.name))).join('')}`
      + (m && m.inherited ? miniCard(data().traits.find((x) => x.id === m.inherited.trait).card, t('s2.p.inherited', { name: nameVar(m.inherited.from) })) : '')
      + `</div>`;
    h += `<div class="p-row flaw"><label>${T('s2.p.flaw')}</label><div><b>${P(flaw.name)}</b>`
      + (flaw.level ? `<em class="lvl lvl-${flaw.level}">${T('s2.p.level.' + flaw.level)}</em>` : '')
      + `<span>${P(flaw.desc)}</span>${tacLine(flaw.tac)}</div></div>`;
    h += `<div class="p-row"><label>${T('s2.p.quirks')}</label><div>${E.people.quirksOf(p).map((q) => `<span class="q"><b>${P(q.name)}</b><small>${P(q.desc)}</small>${q.tac ? `<small class="p-tac"><i>${T('s2.p.tacFx')}</i>${P(q.tac)}</small>` : ''}</span>`).join('')}</div></div>`;
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
    h += `<p class="p-secret"><label>${T('s2.p.secret')}</label>${P(p.bio || data().secrets[p.secret])}</p>`;
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
    const art = typeof scene.art === 'function' ? scene.art(st) : scene.art;
    const parts = t(scene.location).split('//').map((x) => x.trim());
    const lvl = st.exposure >= 60 ? 'hot' : st.exposure >= 30 ? 'warm' : 'cool';
    const first = storySeen;
    let h = `<section class="op-head story-head"><div class="op-art">${E.art.byKey(art)}<div class="op-overlay">`
      + `<div class="story-loc">${esc(parts[0] || '')}</div><div class="op-title">${esc(parts[1] || '')}</div><div class="story-sub">${esc(parts.slice(2).join(' · '))}</div></div></div>`
      + `<div class="alert alert-${lvl}"><div class="alert-top"><span>${T('s2.story.alert')}</span><b>${st.exposure}</b>`
      + `<em>${T('s2.op.bandwidth')} <b class="pips">${'▮'.repeat(st.bandwidth)}<u>${'▮'.repeat(Math.max(0, st.bandwidthMax - st.bandwidth))}</u></b></em></div>`
      + `<div class="alert-bar"><i style="width:${st.exposure}%"></i></div></div></section>`;
    h += `<section class="panel story"><div class="story-log" id="story-log">${s.storyLog.map((e, i) => storyLine(e, i >= first ? i - first : -1)).join('')}</div>`;
    // 打完了：先讓玩家讀完最後幾行，按下繼續才結算。
    if (s.storyDone) return h + `<div class="bar-actions"><button class="primary" id="story-end" data-act="storyEnd">${T('s2.story.end')} →</button></div></section>`;
    h += goalsHtml(st)
      + `<div class="story-chips">${E.engine.suggestions(st).map((c) => `<button class="chip" data-act="storyChip" data-cmd="${esc(JSON.stringify(c))}">${esc(chipText(c))}</button>`).join('')}</div>`
      + `<form id="story-form" class="story-form" autocomplete="off"><span>&gt;</span><input id="story-cmd" type="text" spellcheck="false" placeholder="${T('s2.story.placeholder')}" aria-label="Command"><button type="submit" class="primary">${T('s2.story.send')}</button></form>`
      + `<div class="bar-actions"><button class="ghost" data-act="skipStory">${T('s2.story.skip')}</button></div></section>`;
    return h;
  }

  // 目標：建議指令上面一行是現在要做的事；點「提示」展開全部目標、場景的規則和怎麼做（展開的狀態會保留）。
  function goalsHtml(st) {
    const list = E.engine.goals(st);
    const items = list.filter((g) => !g.note);
    const now = items.find((g) => !g.done && !g.opt) || items.find((g) => !g.done);
    if (!now) return '';
    const need = items.filter((g) => !g.opt);
    return `<div class="goals"><div class="goal-now"><b>${T('s2.story.goal')}</b><span>${T(now.k, now.v)}</span><em>${need.filter((g) => g.done).length}/${need.length}</em></div>`
      + `<details class="goal-more" id="goal-more"${goalsOpen ? ' open' : ''}><summary>${T('s2.story.goalMore')}</summary>`
      + list.filter((g) => g.note).map((g) => `<p class="goal-note">${T(g.k, g.v)}</p>`).join('')
      + `<ul>${items.map((g) => `<li class="${g.done ? 'done' : g === now ? 'now' : ''}">${g.done ? '✓' : g === now ? '▸' : '○'} ${T(g.k, g.v)}${g.opt ? ` <small>${T('s2.story.goalOpt')}</small>` : ''}</li>`).join('')}</ul>`
      + (now.how ? `<p class="goal-how"><b>${T('s2.story.goalHow')}</b>${T(now.how)}</p>` : '') + `</details></div>`;
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
    commit();
  }

  // 熄燈：全螢幕播放康登大街，路燈從塔那頭一盞一盞熄掉，接著住家的窗一扇一扇亮起來。
  function blackout() {
    // 全螢幕時整張畫都要看得到（直式手機也是），所以改成不裁切。
    cine('blackout', `<div class="cine-street">${E.art.byKey('highstreet').replace('xMidYMid slice', 'xMidYMid meet')}</div>`
      + `<div class="cine-cap c1">${T('m2.out.2')}</div><div class="cine-cap c2">${T('m2.out.6')}</div>`, 9000);
    E.fx.sfx.play('loss');
    [1.05, 1.5, 1.95, 2.4].forEach((sec) => setTimeout(() => E.fx.sfx.play('click'), sec * 1000));
    setTimeout(() => E.fx.sfx.play('ending'), 3600);
  }

  // 斷電：倫敦地圖上的五個區，從康登開始一區一區暗下來，最後天上出現星星。
  function mapout() {
    const stars = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 60}%;--d:${(4 + (i % 7) * 0.3).toFixed(1)}s"></i>`).join('');
    cine('mapout', `<div class="cine-map">${mapSvg({ dark: true })}</div><div class="cine-stars">${stars}</div><div class="cine-cap c2">${T('m7.out.2')}</div>`, 9000);
    E.fx.sfx.play('loss');
    [1.1, 1.8, 2.5, 3.2].forEach((sec) => setTimeout(() => E.fx.sfx.play('click'), sec * 1000));
    setTimeout(() => E.fx.sfx.play('ending'), 4200);
  }

  // 新出現的劇情行：標題跳出全螢幕卡，其他依類型播放音效。
  function storyFeedback() {
    if (!s.storyLog) return;
    const fresh = s.storyLog.slice(storySeen);
    storySeen = s.storyLog.length;
    const title = fresh.find((e) => e.c === 'title');
    const moment = fresh.find((e) => e.c === 'moment');
    if (fresh.some((e) => e.c === 'blackout')) blackout();
    else if (fresh.some((e) => e.c === 'mapout')) mapout();
    else if (moment) {
      cine('moment', `<div class="cine-moment">${T(moment.k, moment.v)}</div>`, 3200);
      E.fx.sfx.play('cameo');
    } else if (title) {
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
  // 倫敦地圖：解放過的區是青色，現在這一區依民心變粉紅，換區時可以選的區會亮起來，其他的鎖著。
  // dark 為真時是斷電演出用的版本：每一區都帶著 --d，由 CSS 一區一區關掉。
  function mapSvg(opt = {}) {
    const D = data().districts;
    let g = `<path d="${RIVER}" fill="none" stroke="#17324d" stroke-width="26" stroke-linecap="round"/><path d="${RIVER}" fill="none" stroke="#25507a" stroke-width="2" opacity="0.6"/>`;
    N.ORDER.forEach((id, i) => {
      const m = MAP[id];
      const name = P(D[id].name);
      const free = s.liberated.includes(id);
      const here = id === s.district && s.phase !== 'travel';
      const next = s.phase === 'travel' && (s.travel || []).includes(id);
      const d = ` style="--d:${(0.4 + i * 0.7).toFixed(1)}s"`;
      if (opt.dark) {
        g += `<path class="map-out" d="${m.d}"${d} fill="#ffd23f" fill-opacity="0.55" stroke="#ffd23f" stroke-width="2"/><text x="${m.c[0]}" y="${m.c[1] + 4}" class="map-name live">${name}</text>`;
      } else if (here) {
        const a = 0.18 + s.support / 100 * 0.6;
        g += `<path d="${m.d}" fill="rgba(255,46,136,${a.toFixed(2)})" stroke="#ff2e88" stroke-width="2.5"/>`
          + `<text x="${m.c[0]}" y="${m.c[1] - 8}" class="map-name live">${name}</text>`
          + `<text x="${m.c[0]}" y="${m.c[1] + 14}" class="map-sub">${T('s2.ui.support')} ${s.support}%</text>`
          + Array.from({ length: s.towers }, (_, k) => `<path d="M${m.c[0] - 34 + k * 20} ${m.c[1] + 42} l6 -16 l6 16 Z" fill="#ffd23f"/>`).join('')
          + `<circle cx="${m.c[0] + 50}" cy="${m.c[1] + 34}" r="5" fill="#6cd6e2"/><text x="${m.c[0] + 60}" y="${m.c[1] + 38}" class="map-pin">${T('s2.map.here')}</text>`;
      } else if (free) {
        g += `<path d="${m.d}" fill="rgba(108,214,226,0.35)" stroke="#6cd6e2" stroke-width="2"/>`
          + `<text x="${m.c[0]}" y="${m.c[1] - 4}" class="map-name live">${name}</text><text x="${m.c[0]}" y="${m.c[1] + 16}" class="map-sub free">${T('s2.map.free')}</text>`;
      } else {
        g += `<path d="${m.d}" fill="${next ? 'rgba(255,210,63,0.16)' : '#121722'}" stroke="${next ? '#ffd23f' : '#2c3446'}" stroke-width="2" stroke-dasharray="6 5"/>`
          + `<text x="${m.c[0]}" y="${m.c[1] - 4}" class="map-name${next ? ' live' : ''}">${name}</text><text x="${m.c[0]}" y="${m.c[1] + 16}" class="map-sub">${T(next ? 's2.map.next' : 's2.map.locked')}</text>`;
      }
    });
    return `<svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${g}</svg>`;
  }
  function renderMap() {
    const D = data().districts;
    return `<section class="map">${mapSvg()}`
      + `<div class="banner-txt"><div class="banner-night">${T('s2.ui.nightOf', { n: s.dnight, max: N.nightsIn(s) })}</div><div class="banner-loc">${P(D[s.district].name)}</div></div></section>`;
  }

  // 換區：解放了一區，從剩下的區裡選下一個。
  function renderTravel() {
    const D = data().districts;
    const PERK = { soho: 'supply', isle_of_dogs: 'insider', rotherhithe: 'tunnels' };
    return `<section class="map">${mapSvg()}</section>`
      + `<section class="panel"><h2>${T('s2.travel.title', { district: { l: D[s.district].name } })}</h2><p class="hint">${T('s2.travel.hint')}</p><div class="ops">`
      + s.travel.map((d) => `<button class="op-card travel" data-act="travel" data-d="${d}"><div class="op-main"><div><div class="op-name">${P(D[d].name)}</div>`
        + `<div class="op-desc">${T('s2.dist.' + d + '.d')}</div></div></div><div class="op-reward">${T('s2.perk.' + PERK[d])}</div></button>`).join('')
      + `</div></section>`;
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
    // 解放的條件：西敏要先有民心才能斷電；其他區民心高了卻還沒打主線任務，提醒一下。
    const main = N.mainNow(s);
    const rule = s.district === 'westminster' ? (s.mains.m7 !== 'done' && !main ? 's2.ui.m7need' : '') : (s.support >= 60 && main ? 's2.ui.mainNeeded' : '');
    h += `<section class="panel"><h2>${T('s2.day.ops')}</h2><p class="hint">${T('s2.day.opsHint')}</p>${rule ? `<p class="hint warn">${T(rule)}</p>` : ''}<div class="ops">${ops.map((e) => opCard(e)).join('')}</div>`
      + `<div class="bar-actions"><button data-act="rest">${T('s2.day.rest')}</button></div></section>`;
    if (owed.length) {
      h += `<section class="panel"><h2>${T('s2.day.owed')}</h2><p class="hint">${T('s2.day.owedHint')}</p><div class="grid-people">${owed.map((id) => personCard(id, {
        full: true,
        footer: `<div class="p-foot"><button class="primary" data-act="recruit" data-id="${id}">${T('s2.day.recruit')}</button></div>`,
      })).join('')}</div></section>`;
    }
    const keptN = street.filter((id) => N.kept(s, id)).length;
    h += `<section class="panel"><h2>${T('s2.day.street')} <span class="chip">${T('s2.day.keepCount', { n: keptN, max: N.MAX_KEEP })}</span></h2><p class="hint">${T('s2.day.streetHint')}</p><div class="grid-people">${street.map((id) => {
      if (!s.scanned[id]) return personCard(id, { cls: 'unscanned', footer: `<div class="p-foot"><button data-act="scan" data-id="${id}">${T('s2.day.scan')}</button></div>` });
      if (N.kept(s, id)) {
        return personCard(id, { full: true, cls: 'scanned kept', badge: `<em class="kept">${T('s2.day.kept')}</em>`,
          footer: `<div class="p-foot"><button class="ghost" data-act="unkeep" data-id="${id}">${T('s2.day.unkeep')}</button></div>` });
      }
      const last = N.leavesAfter(s, id);
      const full = keptN >= N.MAX_KEEP;
      return personCard(id, { full: true, cls: 'scanned',
        footer: `<div class="p-foot"><small class="${last <= s.dnight ? 'warn' : ''}">${T(last <= s.dnight ? 's2.day.leaving' : 's2.day.staying')}</small>`
          + `<button class="primary" data-act="keep" data-id="${id}"${full ? ' disabled' : ''}>${full ? T('s2.day.keepFull', { n: N.MAX_KEEP }) : T('s2.day.keep')}</button></div>` });
    }).join('')}</div></section>`;
    return h;
  }

  function renderSquad() {
    const e = N.picked(s);
    // 有戰術地圖的行動（文字冒險的主線任務除外），可以選擇親自潛入。
    const tac = !e.story && N.tacPlan(s);
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
      + combos.map((c) => { const def = data().combos.find((x) => x.id === c); return `<span class="chip combo${BAD_COMBOS.includes(c) ? ' bad' : ''}" title="${P(def.desc)}">${T('s2.squad.combos')}：${P(def.name)}</span>`; }).join('')
      + (reason ? `<span class="warn">${esc(reason)}</span>` : '')
      + `</div><button data-act="back">${T('s2.squad.back')}</button>`
      + (tac ? `<button data-act="go"${check.ok ? '' : ' disabled'}>${T('s2.squad.goQuick')}</button><button class="primary" data-act="goTac"${check.ok ? '' : ' disabled'}>${T('s2.squad.goTac')}</button>`
        : `<button class="primary" data-act="go"${check.ok ? '' : ' disabled'}>${T('s2.squad.go')}</button>`) + `</div>`
      + (tac ? `<p class="hint small">${T('s2.squad.tacHint')}</p>`
        + `<p class="hint small tut-hint">${lsGet(TUT_KEY) === 'done' ? '' : T('tac.tut.squadHint') + ' '}<button class="ghost" data-act="tutorial">${T('tac.tut.open')} →</button></p>` : '')
      + `</section>`;
    return h;
  }

  // 教學關打完：重點整理，再玩一次或回去。
  function renderTutDone() {
    return `<section class="panel result res-win tut-done"><div class="res-title">${T('tac.tut.done.title')}</div><p class="hint">${T('tac.tut.done.intro')}</p>`
      + `<ul class="tut-tips">${E.s2.tutorial.tips.map((k) => `<li>${T('tac.tut.tip.' + k)}</li>`).join('')}</ul>`
      + `<div class="bar-actions"><button data-act="tutorial">${T('tac.tut.again')}</button><button class="primary" data-act="tutExit">${T('tac.tut.back')}</button></div></section>`;
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
      + combos.map((c) => { const def = data().combos.find((x) => x.id === c); return `<span class="chip combo${BAD_COMBOS.includes(c) ? ' bad' : ''}" title="${P(def.desc)}">${P(def.name)}</span>`; }).join('')
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
    const D = data().districts;
    const faces = (list) => (list.length ? list.map((id) => `<span class="end-face">${face(id)}<small>${nm(id)}</small></span>`).join('') : `<span class="hint">${T('s2.end.none')}</span>`);
    return `<section class="panel endcard end-${k}"><div class="end-label">${T('s2.end.card')}</div><h2>${T('s2.end.' + k + '.title')}</h2><p class="end-text">${T('s2.end.' + k + '.text')}</p>`
      + (s.endLines || []).map((e) => `<p class="end-epi">${T(e.k, e.v)}</p>`).join('')
      + `<div class="end-stats"><span>${T('s2.end.nights', { n: s.night })}</span><span>${T('s2.end.ops', { n: s.stats.ops, w: s.stats.wins })}</span>`
      + `<span>${T('s2.end.order')}：${s.liberated.map((d) => P(D[d].name)).join(' → ') || T('s2.end.none')}</span></div>`
      + `<div class="end-row"><label>${T('s2.end.recruited')}</label><div class="end-faces">${faces(s.stats.recruited)}</div></div>`
      + (s.stats.retired.length ? `<div class="end-row"><label>${T('s2.p.status.retired')}</label><div class="end-faces">${faces(s.stats.retired)}</div></div>` : '')
      + `<div class="end-row"><label>${T('s2.end.lost')}</label><div class="end-faces">${faces(s.stats.lost)}</div></div>`
      + ((s.stats.dead || []).length ? `<div class="end-row"><label>${T('s2.end.dead')}</label><div class="end-faces">${faces(s.stats.dead)}</div></div>` : '')
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
    if (m.critical) {
      out.push(btn('clinic', 's2.ui.clinic', {}, true, 'gold'));
      hints.push(T('s2.ui.criticalHint'));
    } else if (['active', 'injured', 'network'].includes(m.status)) {
      out.push(btn('lowkey', 's2.act.lowkey', { n: N.LOW_NIGHTS }));
      hints.push(T('s2.act.lowkeyHint', { n: N.LOW_NIGHTS }));
    }
    if (['active', 'injured', 'network'].includes(m.status)) {
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
      if (m.status === 'injured') st += ' · ' + m.injuredFor + (m.critical ? ' · ' + T('s2.p.critical') : '');
      if (m.status === 'away') st += ' · ' + m.awayFor;
      if (m.status === 'arrested') st += ' · ' + T('s2.day.left', { n: E.roster.TRANSFER_AFTER - (s.night - m.since) });
      const threat = m.threat || 0;
      return `<button class="mem st-${m.status}" data-act="profile" data-id="${id}"><span class="mem-face">${face(id)}</span>`
        + `<span class="mem-txt"><b>${nm(id)}</b><small>${P(E.people.occupationOf(m.person).name)}</small></span>`
        + `<span class="mem-st">${st}<small class="${threat >= N.WANTED ? 'wanted' : threat >= 50 ? 'high' : ''}">${T('s2.p.threat', { n: threat })}</small></span></button>`;
    };
    // 每一組都可以收合；外圍和離隊的人多了，預設收起來，只顯示人數。
    const group = (key, label, list) => {
      if (!list.length) return '';
      const open = teamOpen[key] !== undefined ? teamOpen[key] : key === 'core' || list.length <= 4;
      return `<div class="team-group"><button class="team-label" data-act="teamToggle" data-g="${key}" aria-expanded="${open}">${open ? '▾' : '▸'} ${label} <small>${list.length}</small></button>`
        + (open ? list.map(row).join('') : '') + '</div>';
    };
    const ms = s.roster.members;
    $('s2-team').innerHTML = group('core', T('s2.ui.core'), ms.filter((m) => ['active', 'injured', 'away', 'arrested'].includes(m.status)))
      + group('network', T('s2.ui.network'), ms.filter((m) => m.status === 'network'))
      + group('gone', T('s2.ui.gone'), ms.filter((m) => ['retired', 'lost', 'dead'].includes(m.status)));
  }

  // ===== 整個畫面 =====
  function render() {
    $('m-night').textContent = E.i18n.pick(data().districts[s.district].name) + ' · ' + t('s2.ui.nightOf', { n: Math.min(s.dnight, N.nightsIn(s)), max: N.nightsIn(s) });
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
    log.innerHTML = (tut || s).log.slice(-150).map((e) => `<div class="ln c-${e.c}">${T(e.k, e.v)}</div>`).join('');
    log.scrollTop = log.scrollHeight;

    const main = $('s2-main');
    // 教學關：主畫面改畫教學（隊伍、頂端的數字照舊是這一輪的）。
    if (tut) {
      main.dataset.phase = 'tac';
      main.innerHTML = tut.phase === 'tac' ? E.tacUI.render(tut, { alertStatus, tutorial: true }) : renderTutDone();
      renderModal();
      return;
    }
    const phase = s.phase === 'event' ? 'op' : s.phase === 'react' ? (s.op && s.op.mode === 'tac' ? 'tac' : 'op') : s.phase;
    main.dataset.phase = phase;
    const renderTac = () => E.tacUI.render(s, { alertStatus });
    main.innerHTML = { story: renderStory, start: renderStart, day: renderDay, travel: renderTravel, squad: renderSquad, op: renderOp, tac: renderTac, result: renderResult, end: renderEnd }[phase]();
    renderModal();
    if (phase === 'story') {
      const log2 = $('story-log');
      if (log2) log2.scrollTop = log2.scrollHeight;
      const input = $('story-cmd') || $('story-end');
      if (input && !window.matchMedia('(pointer: coarse)').matches && !hack && !profileId) input.focus();
    }
  }

  // 新出現的紀錄決定音效和畫面閃一下。
  function feedback() {
    const fresh = tut ? tut.log.slice(tutSeen) : s.log.slice(seen);
    if (tut) tutSeen = tut.log.length;
    else seen = s.log.length;
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
    },
    storyEnd() { if (N.storyFinish(s)) { picks = {}; window.scrollTo(0, 0); } },
    skipStory() {
      if (!window.confirm(t(s.storyId === 'm2' ? 's2.story.skipConfirm2' : 's2.story.skipConfirm'))) return;
      N.skipStory(s);
      picks = {};
      window.scrollTo(0, 0);
    },
    scan(d) { N.scan(s, d.id); E.fx.sfx.play('prof'); },
    keep(d) { N.keep(s, d.id, true); },
    unkeep(d) { N.keep(s, d.id, false); },
    travel(d) { if (N.travel(s, d.d)) window.scrollTo(0, 0); },
    clinic(d) { N.clinic(s, d.id); },
    recruit(d) { N.recruitOwed(s, d.id); },
    // 主線任務一定要主角帶隊：主角能出門的話，先幫玩家選好。
    op(d) {
      if (N.pickOp(s, d.key)) {
        picks = {};
        const hero = E.roster.get(s.roster, s.hero);
        if (N.picked(s).story && hero && ['active', 'network'].includes(hero.status)) picks[s.hero] = 'main';
      }
      window.scrollTo(0, 0);
    },
    squad(d) { const e = N.picked(s); toggle(d.id, e.split ? N.MAX_SPLIT : N.MAX_SQUAD, e.split); },
    back() { N.cancel(s); picks = {}; },
    go() {
      if (!N.launch(s, ids(), picks)) return;
      picks = {};
      window.scrollTo(0, 0);
      // 主線任務：換成文字冒險，開場的標題卡由劇情自己播。
      if (s.phase === 'story') { storySeen = 0; return; }
      cine('title', `<div class="cine-title">${P(s.op ? s.op.name : s.result.name)}</div>`, 1600);
      E.fx.sfx.play('title');
    },
    rest() { N.rest(s); },
    goTac() {
      // 第一次親自潛入：問一次要不要先玩教學關（組好的隊伍留著，玩完回來直接出發）。
      if (!lsGet(TUT_KEY)) {
        lsSet(TUT_KEY, 'offered');
        if (window.confirm(t('tac.tut.offer'))) return startTutorial();
      }
      if (!N.launch(s, ids(), picks, 'tac')) return;
      picks = {};
      E.tacUI.reset();
      window.scrollTo(0, 0);
      cine('title', `<div class="cine-title">${P(s.op.name)}</div>`, 1400);
      E.fx.sfx.play('title');
    },
    // 戰術地圖的操作都交給 js/ui/tactics.js（教學關的時候操作的是教學的沙盒）。
    tacSel(d) { E.tacUI.click(tut || s, d); },
    tacTile(d) { E.tacUI.click(tut || s, d); },
    tacPick(d) { E.tacUI.click(tut || s, d); },
    tacClose(d) { E.tacUI.click(tut || s, d); },
    tacEnd(d) { E.tacUI.click(tut || s, d); },
    tacUndo(d) { E.tacUI.click(tut || s, d); },
    tacGuide(d) { E.tacUI.click(tut || s, d); },
    tacGuideOk(d) { E.tacUI.click(tut || s, d); },
    tacCard(d) { E.tacUI.click(tut || s, d); },
    tutorial() { startTutorial(); },
    tutSkip() { if (tut) N.tutorialSkip(tut); },
    tutExit() { endTutorial(); },
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
      } else if (s.phase === 'travel' || (s.phase === 'story' && s.storyId === 'm6')) {
        const freed = s.liberated[s.liberated.length - 1];
        cine('ending', `<div class="cine-title">${T('s2.log.liberated', { district: { l: data().districts[freed].name } })}</div>`, 3200);
        E.fx.sfx.play('ending');
        storySeen = s.storyLog ? s.storyLog.length : 0; // 解放的全螢幕卡優先，劇情的標題卡就不跳了
      } else if (s.tonight) {
        cine('desync', `<div class="cine-desync" data-text="${T('s2.counter.' + s.tonight.type + '.title')}">${T('s2.counter.' + s.tonight.type + '.title')}</div>`, 1800);
      }
    },
    again() { newRun(); },
    profile(d) { profileId = d.id; },
    teamToggle(d) { const g = d.g; const el = document.querySelector('[data-act=teamToggle][data-g=' + g + ']'); teamOpen[g] = !(el && el.getAttribute('aria-expanded') === 'true'); },
    close() { profileId = null; },
    home(d) { N.sendHome(s, d.id); },
    callBack(d) { N.callBack(s, d.id); },
    lowkey(d) { N.layLow(s, d.id); },
    retire(d) { retiring = d.id; profileId = null; },
    retirePick(d) { N.retire(s, retiring, d.trait); retiring = null; },
    retireCancel() { profileId = retiring; retiring = null; },
  };
  // ===== 戰術教學關 =====
  // 開一份新的沙盒；結束時丟掉，回到原本的畫面（組隊畫面、或正在打的地圖）。
  function startTutorial() {
    tut = N.tutorial();
    tutSeen = tut.log.length;
    E.tacUI.reset();
    window.scrollTo(0, 0);
    cine('title', `<div class="cine-title">${P(tut.op.name)}</div>`, 1400);
    E.fx.sfx.play('title');
  }
  function endTutorial() {
    if (tut && tut.phase !== 'tac') lsSet(TUT_KEY, 'done');
    tut = null;
    seen = s.log.length;
    E.tacUI.reset();
    window.scrollTo(0, 0);
  }

  // 這些操作只換對話框，不關掉人物檔案。
  const KEEP_PROFILE = ['profile', 'close', 'home', 'callBack', 'lowkey', 'retire', 'retirePick', 'retireCancel', 'teamToggle'];

  function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (el && el.dataset.act === 'world') return startRun(el.dataset.w, false);
    if (!el || el.disabled || !s) return;
    E.fx.sfx.unlock();
    if (el.dataset.act === 'tile') return turnTile(Number(el.dataset.i));
    const before = s.phase;
    const tutBefore = tut && tut.phase;
    actions[el.dataset.act](el.dataset);
    if (!KEEP_PROFILE.includes(el.dataset.act)) profileId = null;
    resultCard(before);
    tutCard(tutBefore);
    commit();
  }

  // 教學關打完的那一刻：跳出「教學完成」。
  function tutCard(before) {
    if (!tut || before !== 'tac' || tut.phase === 'tac') return;
    cine('title', `<div class="cine-title">${T('tac.tut.done.title')}</div>`, 1800);
    E.fx.sfx.play('ending');
  }

  // 行動結束時跳出結果卡。
  function resultCard(before) {
    if (before !== 'result' && s.phase === 'result' && s.result.outcome !== 'rest') {
      const ok = s.result.outcome === 'win';
      cine(ok ? 'title' : 'desync', ok ? `<div class="cine-title">${T('s2.res.win')}</div>` : `<div class="cine-desync" data-text="${T('s2.res.' + s.result.outcome)}">${T('s2.res.' + s.result.outcome)}</div>`, 1500);
    }
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
    // 目標清單展開或收起：記下來，重畫的時候照舊。
    document.addEventListener('toggle', (ev) => { if (ev.target.id === 'goal-more') goalsOpen = ev.target.open; }, true);
    document.addEventListener('submit', (ev) => {
      if (ev.target.id !== 'story-form') return;
      ev.preventDefault();
      const text = $('story-cmd').value;
      if (text.trim() && s && s.phase === 'story') { E.fx.sfx.unlock(); storyInput(text); }
    });
    document.addEventListener('keydown', (ev) => {
      // 戰術地圖的快捷鍵（對話框打開的時候不算）。
      const play = tut || s;
      if (play && play.phase === 'tac' && !profileId && !hack) {
        const before = s.phase;
        const tutBefore = tut && tut.phase;
        if (E.tacUI.key(play, ev)) { ev.preventDefault(); if (tut) tutCard(tutBefore); else resultCard(before); commit(); return; }
      }
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
