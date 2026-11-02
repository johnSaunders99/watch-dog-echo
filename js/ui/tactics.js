// 第二季戰術地圖的畫面：俯視的格子地圖、隊員、守衛的視野、能力按鈕。
// 規則都在 js/engine/tactics.js；這裡只負責畫出來，並把點擊轉成 E.night.tacMove／tacUse／tacEnd。
// 由 js/ui/s2.js 呼叫：E.tacUI.render(s, ctx) 回傳 HTML，E.tacUI.click(s, dataset) 處理點擊。
(function (E) {
  const N = E.night;
  const TS = 40; // 一格的大小（SVG 座標）
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = (k, v) => E.i18n.t(k, v);
  const T = (k, v) => esc(t(k, v));
  const P = (map) => esc(E.i18n.pick(map));
  const data = () => E.s2.people;

  let sel = null;  // 選中的隊員
  let mode = null; // 正在選目標的能力：{ ab, targets }

  const unitsOf = (s) => s.op.tac.units;
  const unitAt = (s, x, y) => unitsOf(s).find((u) => !u.out && !u.taken && u.x === x && u.y === y);
  const ready = (s) => unitsOf(s).filter((u) => !u.out && !u.taken && u.ap > 0);
  const nm = (s, id) => P(E.people.name(N.person(s, id)));

  function reset() { sel = null; mode = null; }

  // 選中的人沒有行動點了，就換下一個還能動的人。
  function autoSelect(s) {
    const u = unitsOf(s).find((x) => x.id === sel);
    if (u && !u.out && !u.taken && u.ap > 0) return;
    const next = ready(s)[0];
    sel = next ? next.id : null;
    mode = null;
  }

  // ===== 地圖 =====
  const COLORS = { '#': '#1a2030', '.': '#0f1622', ',': '#080c13', '=': '#0f1622', D: '#0f1622', d: '#0f1622', H: '#0f1622', S: '#0f1622', X: '#0f2a22', E: '#0f1622', T: '#0f1622', P: '#0f1622', F: '#0f1622' };
  function tileSvg(c, x, y) {
    const px = x * TS, py = y * TS;
    let g = `<rect x="${px}" y="${py}" width="${TS}" height="${TS}" fill="${COLORS[c] || '#0f1622'}"/>`;
    if (c === '#') g += `<rect x="${px + 2}" y="${py + 2}" width="${TS - 4}" height="${TS - 4}" fill="#222a3d"/>`;
    else g += `<rect x="${px}" y="${py}" width="${TS}" height="${TS}" fill="none" stroke="#18202e" stroke-width="1"/>`;
    if (c === ',') g += `<circle cx="${px + 10}" cy="${py + 12}" r="1.5" fill="#1e2636"/><circle cx="${px + 28}" cy="${py + 26}" r="1.5" fill="#1e2636"/>`;
    if (c === '=') g += `<path d="M${px + 4} ${py + 8} V${py + 32} M${px + 14} ${py + 8} V${py + 32} M${px + 26} ${py + 8} V${py + 32} M${px + 36} ${py + 8} V${py + 32} M${px + 2} ${py + 14} H${px + 38} M${px + 2} ${py + 26} H${px + 38}" stroke="#5a6684" stroke-width="2"/>`;
    if (c === 'D') g += `<rect x="${px + 4}" y="${py + 14}" width="${TS - 8}" height="12" rx="2" fill="#ffb547"/><circle cx="${px + TS / 2}" cy="${py + 20}" r="3" fill="#3a2a10"/>`;
    if (c === 'd') g += `<rect x="${px + 4}" y="${py + 17}" width="${TS - 8}" height="6" rx="2" fill="#4b5670"/>`;
    if (c === 'H') g += `<rect x="${px + 6}" y="${py + 8}" width="${TS - 12}" height="${TS - 14}" rx="3" fill="#2d3a2a" stroke="#4f6a48" stroke-width="2"/>`;
    if (c === 'X') g += `<rect x="${px + 3}" y="${py + 3}" width="${TS - 6}" height="${TS - 6}" fill="none" stroke="#5cf29a" stroke-width="2" stroke-dasharray="5 4"/><text x="${px + TS / 2}" y="${py + TS / 2 + 4}" class="tac-tx exit">EXIT</text>`;
    return g;
  }

  function objSvg(o) {
    const px = o.x * TS, py = o.y * TS, cx = px + TS / 2, cy = py + TS / 2;
    const col = o.done ? '#3c4660' : '#2ff3e0';
    if (o.kind === 'box') return `<rect x="${px + 8}" y="${py + 8}" width="24" height="24" rx="3" fill="#2a3350" stroke="${o.done ? '#3c4660' : '#ffd23f'}" stroke-width="2"/><path d="M${cx - 2} ${py + 12} l-4 9 h6 l-3 8" stroke="${o.done ? '#3c4660' : '#ffd23f'}" stroke-width="2" fill="none"/>`;
    if (o.kind === 'antenna') return `<path d="M${cx} ${py + 32} V${py + 12} M${cx - 8} ${py + 16} q8 -10 16 0 M${cx - 12} ${py + 10} q12 -14 24 0" stroke="${col}" stroke-width="2.5" fill="none"/>`;
    if (o.kind === 'files') return `<rect x="${px + 9}" y="${py + 10}" width="22" height="20" fill="${o.done ? '#3c4660' : '#e9e4dc'}"/><path d="M${px + 12} ${py + 16} h16 M${px + 12} ${py + 21} h16" stroke="#555" stroke-width="2"/>${o.done ? `<path d="M${cx} ${py + 6} q6 8 0 14 q-6 -6 0 -14" fill="#ff8a3d"/>` : ''}`;
    if (o.kind === 'person') return `<circle cx="${cx}" cy="${cy - 4}" r="7" fill="${col}"/><path d="M${cx - 10} ${py + 34} q10 -16 20 0" fill="${col}"/>`;
    if (o.kind === 'prisoner') return `<rect x="${px + 6}" y="${py + 6}" width="28" height="28" fill="none" stroke="#ff5d6c" stroke-width="2"/><path d="M${px + 13} ${py + 6} V${py + 34} M${px + 20} ${py + 6} V${py + 34} M${px + 27} ${py + 6} V${py + 34}" stroke="#ff5d6c" stroke-width="2"/>`;
    return `<rect x="${px + 9}" y="${py + 9}" width="22" height="16" rx="2" fill="#0b0f1c" stroke="${col}" stroke-width="2"/><rect x="${cx - 6}" y="${py + 27}" width="12" height="4" fill="${col}"/>`;
  }

  function foeSvg(f) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    if (f.kind === 'cam') {
      const col = f.off > 0 || f.down ? '#3c4660' : '#ff9a3d';
      return `<rect x="${cx - 9}" y="${cy - 6}" width="18" height="12" rx="2" fill="#1a1f2e" stroke="${col}" stroke-width="2"/><circle cx="${cx + f.face[0] * 6}" cy="${cy + f.face[1] * 6}" r="3" fill="${col}"/>`;
    }
    if (f.kind === 'drone') {
      const col = f.down ? '#3c4660' : f.loop > 0 ? '#6cd6e2' : '#c2b3ff';
      return `<g opacity="${f.down ? 0.5 : 1}"><path d="M${cx - 12} ${cy - 12} L${cx + 12} ${cy + 12} M${cx + 12} ${cy - 12} L${cx - 12} ${cy + 12}" stroke="${col}" stroke-width="2"/>`
        + [[-12, -12], [12, -12], [-12, 12], [12, 12]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="4" fill="none" stroke="${col}" stroke-width="1.5"/>`).join('')
        + `<circle cx="${cx}" cy="${cy}" r="6" fill="#1a1f2e" stroke="${col}" stroke-width="2"/>${f.loop > 0 ? `<text x="${cx}" y="${cy - 14}" class="tac-tx">∞</text>` : ''}</g>`;
    }
    const col = f.down ? '#3c4660' : f.state === 'alert' ? '#ff5d6c' : f.state === 'distracted' ? '#ffd23f' : '#9aa6c0';
    const [fx, fy] = f.face;
    const tip = `${cx + fx * 15},${cy + fy * 15} ${cx - fy * 7 + fx * 5},${cy + fx * 7 + fy * 5} ${cx + fy * 7 + fx * 5},${cy - fx * 7 + fy * 5}`;
    return `<g opacity="${f.down ? 0.55 : 1}"><circle cx="${cx}" cy="${cy}" r="12" fill="#151a26" stroke="${col}" stroke-width="2.5"/>`
      + (f.down ? `<text x="${cx}" y="${cy + 4}" class="tac-tx">Z</text>` : `<polygon points="${tip}" fill="${col}"/>`)
      + (f.state === 'distracted' && !f.down ? `<text x="${cx}" y="${cy - 16}" class="tac-tx warn">?</text>` : '')
      + (f.state === 'alert' && !f.down ? `<text x="${cx}" y="${cy - 16}" class="tac-tx bad">!</text>` : '') + `</g>`;
  }

  function unitSvg(s, u) {
    const px = u.x * TS, py = u.y * TS;
    const face = E.faces.of(N.person(s, u.id)).replace('<svg ', `<svg x="${px + 6}" y="${py + 6}" width="28" height="28" `);
    const ring = u.id === sel ? '#ff2e88' : u.escort ? '#ffd23f' : '#6cd6e2';
    return `<g class="tac-unit${u.id === sel ? ' sel' : ''}"><circle cx="${px + TS / 2}" cy="${py + TS / 2}" r="17" fill="#0b0f1c" stroke="${ring}" stroke-width="${u.id === sel ? 3 : 2}"/>${face}`
      + (u.disguise > 0 ? `<circle cx="${px + 33}" cy="${py + 8}" r="6" fill="#c2b3ff"/>` : '')
      + (s.op.hurt[u.id] ? `<circle cx="${px + 7}" cy="${py + 8}" r="5" fill="#ff5d6c"/>` : '')
      + `<text x="${px + TS / 2}" y="${py + TS - 1}" class="tac-tx ap">${'●'.repeat(u.ap)}</text></g>`;
  }

  function mapSvg(s) {
    const tac = s.op.tac;
    let g = '';
    for (let y = 0; y < tac.h; y++) for (let x = 0; x < tac.w; x++) g += tileSvg(tac.map[y][x], x, y);
    // 守衛、攝影機、無人機看得到的範圍
    const vis = N.tacVision(s);
    for (const f of tac.foes) {
      const cells = vis[f.id] || [];
      const col = f.kind === 'cam' ? '255,154,61' : f.kind === 'drone' ? '194,179,255' : f.state === 'alert' ? '255,93,108' : '255,93,108';
      const a = f.state === 'alert' ? 0.3 : 0.16;
      g += cells.map(([x, y]) => `<rect x="${x * TS + 1}" y="${y * TS + 1}" width="${TS - 2}" height="${TS - 2}" fill="rgba(${col},${a})"/>`).join('');
    }
    // 外圍情報、過目不忘：看得到巡邏路線
    const intel = tac.intel || unitsOf(s).some((u) => !u.escort && !u.out && !u.taken && N.traitIds(s, u.id).includes('memory'));
    if (intel) {
      for (const f of tac.foes) {
        if (f.kind === 'cam' || f.down || !f.route || f.route.length < 2) continue;
        g += `<polyline points="${f.route.concat([f.route[0]]).map(([x, y]) => `${x * TS + TS / 2},${y * TS + TS / 2}`).join(' ')}" fill="none" stroke="rgba(255,210,63,0.35)" stroke-width="2" stroke-dasharray="4 4"/>`;
      }
    }
    g += tac.objs.map(objSvg).join('');
    // 可以走的格子、能力可以選的目標
    const u = unitsOf(s).find((x) => x.id === sel);
    if (u && !mode) {
      // 藍色：走得到；橘色：走過去的路上會被看到（會停在被看到的那一格）。
      const r = N.tacReach(s, u.id);
      const risky = new Set(N.tacRisky(s, u.id));
      g += Object.keys(r).map((k) => { const [x, y] = k.split(',').map(Number); return `<rect class="tac-reach${risky.has(k) ? ' risky' : ''}" x="${x * TS + 3}" y="${y * TS + 3}" width="${TS - 6}" height="${TS - 6}" rx="4"/>`; }).join('');
    }
    if (mode) g += mode.targets.map(([x, y]) => `<rect class="tac-target" x="${x * TS + 2}" y="${y * TS + 2}" width="${TS - 4}" height="${TS - 4}" rx="4"/>`).join('');
    g += tac.foes.map(foeSvg).join('');
    g += unitsOf(s).filter((x) => !x.out && !x.taken).map((x) => unitSvg(s, x)).join('');
    // 點擊用的透明格子
    for (let y = 0; y < tac.h; y++) for (let x = 0; x < tac.w; x++) g += `<rect class="tac-hit" data-act="tacTile" data-x="${x}" data-y="${y}" x="${x * TS}" y="${y * TS}" width="${TS}" height="${TS}"/>`;
    return `<svg class="tac-map" viewBox="0 0 ${tac.w * TS} ${tac.h * TS}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
  }

  // ===== 這個人會什麼：每一項都寫出來源（類別、專長、特質、弱點、小習慣） =====
  function capList(s, id) {
    const c = N.tacCaps(s, id);
    if (c.escort) return [{ k: 'tac.cap.escort' }];
    const p = N.person(s, id);
    const D = data();
    const cat = { t: 's2.p.cat.' + c.cat };
    const perk = { l: D.perks[c.perk].name };
    const tr = (x) => ({ l: D.traits.find((z) => z.id === x).name });
    const fl = (x) => ({ l: D.flaws.find((z) => z.id === x).name });
    const qk = (x) => ({ l: D.quirks.find((z) => z.id === x).name });
    const traits = N.traitIds(s, id), quirks = p.quirks, flaw = p.flaw;
    const out = [];
    const add = (k, v, src, cls) => out.push({ k, v, src, cls });
    const moveSrc = traits.includes('fast') ? tr('fast') : quirks.includes('marathon') ? qk('marathon') : c.perk === 'sprint' ? perk : flaw === 'bad_knees' ? fl('bad_knees') : null;
    add('tac.cap.move', { n: c.move }, moveSrc, flaw === 'bad_knees' ? 'bad' : '');
    if (c.hack) add('tac.cap.hack', { n: c.hackRange }, c.cat === 'hacker' ? cat : perk);
    if (c.climb) add('tac.cap.climb', {}, c.cat === 'physical' ? cat : traits.includes('nimble') ? tr('nimble') : perk);
    else if (flaw === 'acrophobia' || flaw === 'bad_knees') add('tac.cap.noclimb', {}, fl(flaw), 'bad');
    if (c.takedown) add(c.anyAngle ? 'tac.cap.takedownAny' : 'tac.cap.takedown', {}, traits.includes('strong') ? tr('strong') : quirks.includes('ex_army') ? qk('ex_army') : cat);
    if (c.talk) add('tac.cap.talk', { n: c.talkRange, t: c.talkTurns }, c.cat === 'social' ? cat : traits.includes('silver') ? tr('silver') : quirks.includes('choir') ? qk('choir') : perk);
    if (c.disguise) add('tac.cap.disguise', { n: c.disguiseTurns }, c.perk === 'disguise' ? perk : cat);
    if (c.unlock) add('tac.cap.unlock', {}, perk);
    if (c.heal) add('tac.cap.heal', {}, perk);
    if (c.cab) add('tac.cap.cab', {}, c.perk === 'getaway' ? perk : tr('driver'));
    add('tac.cap.force', { n: c.strong ? 1 : 2 }, c.strong ? cat : null, c.strong ? '' : 'dim');
    if (c.quiet) add('tac.cap.quiet', {}, tr('careful'));
    if (traits.includes('calm')) add('tac.cap.calm', {}, tr('calm'));
    if (traits.includes('fast')) add('tac.cap.fast', {}, tr('fast'));
    if (traits.includes('unremarkable')) add('tac.cap.unremarkable', {}, tr('unremarkable'));
    if (traits.includes('nightowl')) add('tac.cap.nightowl', {}, tr('nightowl'));
    if (traits.includes('memory')) add('tac.cap.memory', {}, tr('memory'));
    if (c.loud) add('tac.cap.loud', {}, fl('loudmouth'), 'bad');
    if (flaw === 'record') add('tac.cap.record', {}, fl('record'), 'bad');
    if (c.dark) add('tac.cap.dark', {}, fl('dark'), 'bad');
    if (flaw === 'nervous') add('tac.cap.nervous', {}, fl('nervous'), 'bad');
    if (flaw === 'phone') add('tac.cap.phone', {}, fl('phone'), 'bad');
    if (c.lost) add('tac.cap.lost', {}, fl('no_sense'), 'bad');
    if (c.clumsy) add('tac.cap.clumsy', {}, fl('clumsy'), 'bad');
    if (flaw === 'honest') add('tac.cap.honest', {}, fl('honest'), 'bad');
    if (flaw === 'hothead') add('tac.cap.hothead', {}, fl('hothead'), 'bad');
    if (quirks.includes('smoker')) add('tac.cap.smoker', {}, qk('smoker'), 'bad');
    if (flaw === 'allergic') add('tac.cap.allergic', {}, fl('allergic'), 'bad');
    return out;
  }

  // ===== 整個畫面 =====
  function render(s, ui) {
    const tac = s.op.tac;
    autoSelect(s);
    const lvl = s.op.alert >= 60 ? 'hot' : s.op.alert >= 30 ? 'warm' : 'cool';
    const left = tac.objs.filter((o) => !o.done).length;
    let h = `<section class="op-head tac-head"><div class="tac-top"><div class="op-title">${P(s.op.name)}</div>`
      + `<span class="chip">${tac.limit ? T('tac.turnOf', { n: tac.turn, max: tac.limit }) : T('tac.turn', { n: tac.turn })}</span>`
      + `<span class="chip">${T('s2.op.bandwidth')} <b class="pips">${'▮'.repeat(Math.max(0, s.op.bw))}</b></span>`
      + `<span class="chip ${left ? '' : 'good'}">${left ? T('tac.objLeft', { n: left }) : T('tac.objDone')}</span></div>`
      + `<div class="alert alert-${lvl}"><div class="alert-top"><span>${T('s2.op.alert')}</span><b>${s.op.alert}</b><em>${T(ui.alertStatus(s.op.alert))}</em></div>`
      + `<div class="alert-bar"><i style="width:${s.op.alert}%"></i><u style="left:30%"></u><u style="left:60%"></u></div></div></section>`;
    h += `<section class="panel tac">${mapSvg(s)}<p class="hint tac-hint">${T(mode ? 'tac.pickTarget' : 'tac.help')}</p>`;
    // 隊員列
    h += `<div class="tac-squad">${unitsOf(s).map((u) => {
      const st = u.out ? T('tac.out') : u.taken ? T('tac.taken') : `${'●'.repeat(u.ap)}<u>${'●'.repeat(Math.max(0, E.tactics.AP - u.ap))}</u>`;
      const tags = [u.disguise > 0 ? T('tac.disguised', { n: u.disguise }) : '', s.op.hurt[u.id] ? T('tac.hurt') : '', u.escort ? T('tac.escort') : ''].filter(Boolean).join(' · ');
      return `<button class="tac-mem${u.id === sel ? ' sel' : ''}${u.out || u.taken ? ' off' : ''}" data-act="tacSel" data-id="${u.id}"${u.out || u.taken ? ' disabled' : ''}>`
        + `<span class="tm-face">${E.faces.of(N.person(s, u.id))}</span><span class="tm-txt"><b>${nm(s, u.id)}</b><small>${st}${tags ? ' · ' + tags : ''}</small></span></button>`;
    }).join('')}</div>`;
    // 選中的人：能力按鈕和能力說明
    const u = unitsOf(s).find((x) => x.id === sel);
    if (u) {
      const abs = N.tacAbilities(s, u.id);
      h += `<div class="tac-abs">${abs.map((a) => `<button class="tac-ab${mode && mode.ab === a.id ? ' on' : ''}" data-act="tacAb" data-ab="${a.id}"${a.kind ? ` data-kind="${a.kind}"` : ''}>`
        + `<b>${T(a.id === 'use' ? 'tac.obj.' + a.kind : 'tac.ab.' + a.id)}</b><small>${T('tac.cost', { n: a.ap })}${a.bw ? ' · ' + T('tac.costBw', { n: a.bw }) : ''}</small></button>`).join('')}`
        + (mode ? `<button class="ghost" data-act="tacCancel">${T('tac.cancel')}</button>` : '')
        + (!abs.length ? `<span class="hint">${T('tac.noAbility')}</span>` : '') + `</div>`;
      h += `<div class="tac-caps"><label>${T('tac.caps', { name: { l: E.people.name(N.person(s, u.id)) } })}</label>${capList(s, u.id).map((c) => `<span class="tcap ${c.cls || ''}">${T(c.k, c.v)}${c.src ? `<small>${esc(t('tac.src', { src: c.src }))}</small>` : ''}</span>`).join('')}</div>`;
    }
    h += `<div class="bar-actions"><button class="ghost" data-act="retreat">${T('s2.op.retreat')}</button><button class="ghost" data-act="tacLegend">${T('tac.legend')}</button><button class="primary" data-act="tacEnd">${T('tac.end')}</button></div>`;
    if (ui.legend) h += legend();
    h += `</section>`;
    return h;
  }

  function legend() {
    const items = ['wall', 'dark', 'fence', 'door', 'hide', 'exit', 'guard', 'cam', 'drone', 'vision'];
    return `<div class="tac-legend">${items.map((k) => `<span><b>${T('tac.leg.' + k)}</b>${T('tac.leg.' + k + '.d')}</span>`).join('')}</div>`;
  }

  // ===== 點擊 =====
  function click(s, d) {
    const act = d.act;
    if (act === 'tacSel') { sel = d.id; mode = null; return; }
    if (act === 'tacCancel') { mode = null; return; }
    if (act === 'tacEnd') { mode = null; N.tacEnd(s); sel = null; return; }
    if (act === 'tacAb') {
      const a = N.tacAbilities(s, sel).find((x) => x.id === d.ab && (!d.kind || x.kind === d.kind));
      if (!a) return;
      // 只有一個目標、而且就是自己腳下的（偽裝、叫車）：直接用。
      if (a.targets.length === 1 && ['disguise', 'cab'].includes(a.id)) { N.tacUse(s, sel, a.id, a.targets[0][0], a.targets[0][1]); mode = null; return; }
      mode = { ab: a.id, targets: a.targets };
      return;
    }
    if (act === 'tacTile') {
      const x = Number(d.x), y = Number(d.y);
      if (mode) {
        if (mode.targets.some(([tx, ty]) => tx === x && ty === y)) N.tacUse(s, sel, mode.ab, x, y);
        mode = null;
        return;
      }
      const u = unitAt(s, x, y);
      if (u) { sel = u.id; return; }
      if (sel && N.tacReach(s, sel)[x + ',' + y] !== undefined) N.tacMove(s, sel, x, y);
    }
  }

  E.tacUI = { render, click, reset };
})(window.ECHO = window.ECHO || {});
