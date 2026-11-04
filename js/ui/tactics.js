// 第二季戰術地圖的畫面：俯視的格子地圖、隊員、守衛、攝影機、無人機、目標，全部用程式畫成看得出是什麼的樣子。
// 操作都在地圖上：點隊員選人、點藍色格子移動、點門／守衛／目標上的圖示直接動手（同一格有好幾種做法時跳出小選單）。
// 地圖正下方是隊員列、撤回和結束回合，再下面是選中的人的招式卡（點卡片直接用；要選目標的，地圖上會閃出可以選的格子）。
// 第一次玩會先跳出一張圖解。
// 規則都在 js/engine/tactics.js；這裡只負責畫，並把點擊轉成 E.night.tacMove／tacUse／tacEnd／tacUndo。
// 由 js/ui/s2.js 呼叫：E.tacUI.render(s, ui) 回傳 HTML，E.tacUI.click(s, dataset) 處理點擊，E.tacUI.key(s, event) 處理鍵盤。
(function (E) {
  const N = E.night;
  const TS = 40; // 一格的大小（SVG 座標）
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = (k, v) => E.i18n.t(k, v);
  const T = (k, v) => esc(t(k, v));
  const P = (map) => esc(E.i18n.pick(map));
  const data = () => E.s2.people;
  const GUIDE_KEY = 'watchdogs-echo.s2.tacGuide';

  let sel = null;   // 選中的隊員
  let pop = null;   // 地圖上的小選單：{ x, y, items: [{ ab, x, y, kind, ap, bw }] }
  let tip = null;   // 點敵人或目標時的說明：{ x, y, k, v }
  let guide = null; // 圖解有沒有打開（null：還沒決定，看這個瀏覽器有沒有看過）
  let aim = null;   // 用招式卡選目標中：能力的 id
  let tutAt = null; // 教學關：上一次畫面時在第幾步（換步驟時幫玩家選好要動手的人）
  let spots = {};   // 上一次畫面時每個人和敵人的位置（移動的動畫用）

  const unitsOf = (s) => s.op.tac.units;
  const liveUnits = (s) => unitsOf(s).filter((u) => !u.out && !u.taken);
  const unitAt = (s, x, y) => liveUnits(s).find((u) => u.x === x && u.y === y);
  const ready = (s) => liveUnits(s).filter((u) => u.ap > 0);
  const nm = (s, id) => P(E.people.name(N.person(s, id)));
  const tileAt = (s, x, y) => E.tactics.tile(s.op.tac, x, y);
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 存不了就算了 */ } }

  function reset() { sel = null; pop = null; tip = null; aim = null; tutAt = null; spots = {}; }

  // 選中的人沒有行動點了，就換下一個還能動的人。
  function autoSelect(s) {
    const u = unitsOf(s).find((x) => x.id === sel);
    if (u && !u.out && !u.taken && u.ap > 0) return;
    const next = ready(s)[0];
    sel = next ? next.id : null;
    pop = null;
    aim = null;
  }

  // ===== 地板、牆、圍欄、門、藏身處 =====
  // 每種主題一種地板材質（SVG pattern），牆有立體的頂面和正面。
  const FLOOR = { site: 'tx-gravel', office: 'tx-carpet', yard: 'tx-concrete', home: 'tx-wood', street: 'tx-asphalt', tunnel: 'tx-brick' };
  function defs() {
    const p = (id, base, body) => `<pattern id="${id}" width="${TS}" height="${TS}" patternUnits="userSpaceOnUse"><rect width="${TS}" height="${TS}" fill="${base}"/>${body}</pattern>`;
    return `<defs>`
      + p('tx-gravel', '#2a2722', '<circle cx="6" cy="8" r="1.4" fill="#3a352c"/><circle cx="22" cy="5" r="1" fill="#35302a"/><circle cx="31" cy="17" r="1.6" fill="#3d382f"/><circle cx="12" cy="24" r="1.2" fill="#34302a"/><circle cx="27" cy="32" r="1.1" fill="#3a352c"/><circle cx="5" cy="35" r="1.5" fill="#322e28"/>')
      + p('tx-carpet', '#1f2436', '<path d="M0 20 H40 M20 0 V40" stroke="#252b40" stroke-width="1"/>')
      + p('tx-concrete', '#262a31', '<path d="M4 30 l7 -4 l5 3 l9 -6" stroke="#1d2027" stroke-width="1" fill="none"/><circle cx="30" cy="8" r="1" fill="#2e333b"/>')
      + p('tx-wood', '#2c221c', '<path d="M0 10 H40 M0 20 H40 M0 30 H40 M14 0 V10 M30 10 V20 M8 20 V30 M24 30 V40" stroke="#221a15" stroke-width="1.2"/>')
      + p('tx-asphalt', '#1b1f27', '<circle cx="7" cy="9" r="1" fill="#262b35"/><circle cx="29" cy="24" r="1.2" fill="#242934"/><circle cx="17" cy="33" r="0.8" fill="#2a303b"/>')
      + p('tx-brick', '#241c1a', '<path d="M0 10 H40 M0 20 H40 M0 30 H40 M10 0 V10 M30 0 V10 M0 10 V20 M20 10 V20 M10 20 V30 M30 20 V30 M0 30 V40 M20 30 V40" stroke="#181210" stroke-width="1.4"/>')
      + `<linearGradient id="tx-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff1b8" stop-opacity="0.45"/><stop offset="1" stop-color="#fff1b8" stop-opacity="0"/></linearGradient>`
      + `<radialGradient id="tx-exit"><stop offset="0" stop-color="#5cf29a" stop-opacity="0.5"/><stop offset="1" stop-color="#5cf29a" stop-opacity="0"/></radialGradient>`
      + `</defs>`;
  }

  const isWall = (c) => c === '#';
  function floorSvg(s, c, x, y) {
    const px = x * TS, py = y * TS;
    let g = `<rect x="${px}" y="${py}" width="${TS}" height="${TS}" fill="url(#${FLOOR[s.op.tac.theme] || 'tx-asphalt'})"/>`;
    // 牆在上面：地板上落一道影子
    if (isWall(tileAt(s, x, y - 1))) g += `<rect x="${px}" y="${py}" width="${TS}" height="7" fill="#000" opacity="0.35"/>`;
    if (c === ',') g += `<rect x="${px}" y="${py}" width="${TS}" height="${TS}" fill="#03050a" opacity="0.62"/>`;
    return g;
  }

  function wallSvg(s, x, y) {
    const px = x * TS, py = y * TS;
    const front = !isWall(tileAt(s, x, y + 1)) && y + 1 < s.op.tac.h;
    let g = `<rect x="${px}" y="${py}" width="${TS}" height="${TS}" fill="#353c51"/>`
      + `<path d="M${px} ${py + 13} H${px + TS} M${px} ${py + 26} H${px + TS} M${px + 20} ${py} V${py + 13} M${px + 8} ${py + 13} V${py + 26} M${px + 30} ${py + 26} V${py + 40}" stroke="#2a3042" stroke-width="1.5"/>`;
    if (front) g += `<rect x="${px}" y="${py + TS - 10}" width="${TS}" height="10" fill="#22283a"/><rect x="${px}" y="${py + TS - 10}" width="${TS}" height="1.5" fill="#465070"/>`;
    return g;
  }

  // 圍欄和門要知道自己是橫的還是直的：左右是牆或圍欄就是橫的。
  const horizontal = (s, x, y) => ['#', '=', 'D', 'd'].includes(tileAt(s, x - 1, y)) || ['#', '=', 'D', 'd'].includes(tileAt(s, x + 1, y));
  function fenceSvg(s, x, y) {
    const px = x * TS, py = y * TS, h = horizontal(s, x, y);
    const mid = h ? py + TS / 2 : px + TS / 2;
    let g = '';
    // 鐵絲網：交叉的細線，兩端各一根柱子
    if (h) {
      g += `<rect x="${px}" y="${mid - 5}" width="${TS}" height="10" fill="#7f8aa6" opacity="0.18"/>`;
      for (let i = -10; i < TS; i += 6) g += `<path d="M${px + i} ${mid - 5} l10 10 M${px + i + 10} ${mid - 5} l-10 10" stroke="#9aa6c2" stroke-width="0.8" opacity="0.7"/>`;
      g += `<rect x="${px}" y="${mid - 6}" width="4" height="12" fill="#c8cfdf"/><rect x="${px + TS - 4}" y="${mid - 6}" width="4" height="12" fill="#c8cfdf"/>`;
    } else {
      g += `<rect x="${mid - 5}" y="${py}" width="10" height="${TS}" fill="#7f8aa6" opacity="0.18"/>`;
      for (let i = -10; i < TS; i += 6) g += `<path d="M${mid - 5} ${py + i} l10 10 M${mid - 5} ${py + i + 10} l10 -10" stroke="#9aa6c2" stroke-width="0.8" opacity="0.7"/>`;
      g += `<rect x="${mid - 6}" y="${py}" width="12" height="4" fill="#c8cfdf"/><rect x="${mid - 6}" y="${py + TS - 4}" width="12" height="4" fill="#c8cfdf"/>`;
    }
    return `<g clip-path="none">${g}</g>`;
  }

  function doorSvg(s, x, y, locked) {
    const px = x * TS, py = y * TS, h = horizontal(s, x, y);
    // 門框（牆的顏色），中間是門板
    let g = h ? `<rect x="${px}" y="${py + 12}" width="4" height="16" fill="#353c51"/><rect x="${px + TS - 4}" y="${py + 12}" width="4" height="16" fill="#353c51"/>`
      : `<rect x="${px + 12}" y="${py}" width="16" height="4" fill="#353c51"/><rect x="${px + 12}" y="${py + TS - 4}" width="16" height="4" fill="#353c51"/>`;
    if (locked) {
      g += h ? `<rect x="${px + 4}" y="${py + 15}" width="${TS - 8}" height="10" fill="#7a5532" stroke="#3a2614" stroke-width="1.5"/>` : `<rect x="${px + 15}" y="${py + 4}" width="10" height="${TS - 8}" fill="#7a5532" stroke="#3a2614" stroke-width="1.5"/>`;
      // 大鎖
      const cx = px + TS / 2, cy = py + TS / 2;
      g += `<path d="M${cx - 5} ${cy - 2} v-4 a5 5 0 0 1 10 0 v4" stroke="#ffd23f" stroke-width="2.2" fill="none"/><rect x="${cx - 7}" y="${cy - 2}" width="14" height="11" rx="2" fill="#ffb547" stroke="#5a3d10" stroke-width="1"/><circle cx="${cx}" cy="${cy + 3}" r="1.8" fill="#5a3d10"/>`;
    } else {
      // 打開的門：門板貼在一邊
      g += h ? `<rect x="${px + 4}" y="${py + 6}" width="4" height="${TS - 12}" fill="#7a5532"/>` : `<rect x="${px + 6}" y="${py + 4}" width="${TS - 12}" height="4" fill="#7a5532"/>`;
    }
    return g;
  }

  // 藏身處：工地和院子是貨櫃、街上是垃圾子母車、辦公室是辦公桌、住家是沙發。
  function hideSvg(s, x, y) {
    const px = x * TS, py = y * TS;
    const th = s.op.tac.theme;
    if (th === 'street') return `<rect x="${px + 5}" y="${py + 8}" width="30" height="24" rx="3" fill="#2f5a3a" stroke="#1a3322" stroke-width="2"/><rect x="${px + 5}" y="${py + 8}" width="30" height="7" rx="2" fill="#3c7049"/><path d="M${px + 12} ${py + 19} v9 M${px + 20} ${py + 19} v9 M${px + 28} ${py + 19} v9" stroke="#1a3322" stroke-width="1.5"/>`;
    if (th === 'office') return `<rect x="${px + 4}" y="${py + 10}" width="32" height="20" rx="2" fill="#5a4630" stroke="#2e2318" stroke-width="2"/><circle cx="${px + 30}" cy="${py + 12}" r="7" fill="#2f6a3e"/><circle cx="${px + 26}" cy="${py + 9}" r="5" fill="#3c8a50"/><rect x="${px + 9}" y="${py + 14}" width="12" height="8" fill="#0b0f1c"/>`;
    if (th === 'home') return `<rect x="${px + 4}" y="${py + 9}" width="32" height="22" rx="5" fill="#5a3240" stroke="#2e1820" stroke-width="2"/><rect x="${px + 4}" y="${py + 9}" width="32" height="7" rx="3" fill="#6e3e50"/><rect x="${px + 7}" y="${py + 18}" width="12" height="10" rx="2" fill="#7a4658"/><rect x="${px + 21}" y="${py + 18}" width="12" height="10" rx="2" fill="#7a4658"/>`;
    return `<rect x="${px + 3}" y="${py + 7}" width="34" height="26" fill="#7a3a24" stroke="#3a1a0e" stroke-width="2"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${px + 7 + i * 5.2} ${py + 9} V${py + 31}" stroke="#5a2a18" stroke-width="1.5"/>`).join('')}`;
  }

  // 撤離點：綠色的光，加上指向地圖外的箭頭。
  function exitSvg(s, x, y) {
    const px = x * TS, py = y * TS, cx = px + TS / 2, cy = py + TS / 2;
    const tac = s.op.tac;
    const dir = x <= 1 ? [-1, 0] : x >= tac.w - 2 ? [1, 0] : y <= 1 ? [0, -1] : [0, 1];
    const ang = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
    return `<circle cx="${cx}" cy="${cy}" r="20" fill="url(#tx-exit)"/><rect x="${px + 3}" y="${py + 3}" width="${TS - 6}" height="${TS - 6}" rx="4" fill="none" stroke="#5cf29a" stroke-width="2" stroke-dasharray="5 3"/>`
      + `<g transform="translate(${cx} ${cy - 3}) rotate(${ang})"><path d="M-8 -5 H3 V-10 L11 0 L3 10 V5 H-8 Z" fill="#5cf29a"/></g>`
      + `<text x="${cx}" y="${py + TS - 4}" class="tac-tx exit">${T('tac.exitTag')}</text>`;
  }

  // ===== 目標 =====
  function objSvg(o) {
    const px = o.x * TS, py = o.y * TS, cx = px + TS / 2, cy = py + TS / 2;
    const on = !o.done;
    let g = '';
    if (o.kind === 'box') {
      // 監控塔的塔腳和中間的控制箱
      g = [[5, 5], [31, 5], [5, 31], [31, 31]].map(([dx, dy]) => `<rect x="${px + dx}" y="${py + dy}" width="5" height="5" fill="#8a94ad"/>`).join('')
        + `<path d="M${px + 8} ${py + 8} L${px + 33} ${py + 33} M${px + 33} ${py + 8} L${px + 8} ${py + 33}" stroke="#5a6684" stroke-width="2"/>`
        + `<rect x="${px + 12}" y="${py + 11}" width="16" height="18" rx="2" fill="#3b4256" stroke="${on ? '#ffd23f' : '#5a6684'}" stroke-width="2"/>`
        + `<path d="M${cx + 1} ${py + 14} l-5 7 h5 l-3 6" stroke="${on ? '#ffd23f' : '#5a6684'}" stroke-width="2" fill="none"/>`
        + (on ? `<circle cx="${cx}" cy="${py + 8}" r="3" fill="#ff4757" class="blink"/>` : '');
    } else if (o.kind === 'crate') {
      // 物資箱：金色框的木箱，上面印著獅心防務的盾牌（和藏身用的木箱分得出來）
      g = on ? `<rect x="${px + 7}" y="${py + 10}" width="26" height="22" rx="2" fill="#8a6a3e" stroke="#ffd23f" stroke-width="2"/><path d="M${px + 7} ${py + 21} H${px + 33} M${cx} ${py + 10} V${py + 32}" stroke="#4e3a20" stroke-width="2"/>`
        + `<path d="M${cx - 5} ${py + 14} h10 v4 q0 4 -5 6 q-5 -2 -5 -6 Z" fill="#ffd23f" opacity="0.85"/><circle cx="${px + 33}" cy="${py + 9}" r="3" fill="#ff4757" class="blink"/>`
        : `<rect x="${px + 9}" y="${py + 18}" width="22" height="14" rx="2" fill="none" stroke="#5a6684" stroke-width="2" stroke-dasharray="3 2"/>`;
    } else if (o.kind === 'wall') {
      // 要噴漆的牆：噴完之後是 DedSec 的笑臉
      g = `<rect x="${px + 3}" y="${py + 5}" width="${TS - 6}" height="${TS - 10}" fill="#4a3a3e" stroke="#2e1c1f" stroke-width="2"/><path d="M${px + 3} ${py + 15} H${px + TS - 3} M${px + 3} ${py + 25} H${px + TS - 3} M${cx} ${py + 5} V${py + 15} M${px + 12} ${py + 15} V${py + 25} M${px + 28} ${py + 15} V${py + 25}" stroke="#2e1c1f" stroke-width="1.2"/>`
        + (on ? `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#ff2e88" stroke-width="2" stroke-dasharray="2 2"/>`
          : `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="#ff2e88" stroke-width="2.5"/><circle cx="${cx - 3}" cy="${cy - 2}" r="1.4" fill="#ff2e88"/><circle cx="${cx + 3}" cy="${cy - 2}" r="1.4" fill="#ff2e88"/><path d="M${cx - 4} ${cy + 3} q4 3 8 0" stroke="#ff2e88" stroke-width="1.8" fill="none"/>`);
    } else if (o.kind === 'antenna') {
      g = `<rect x="${cx - 2}" y="${py + 14}" width="4" height="22" fill="#8a94ad"/><path d="M${cx - 13} ${py + 14} a13 9 0 0 0 26 0 Z" fill="#c8cfdf" stroke="#5a6684"/><path d="M${cx} ${py + 14} L${cx + 7} ${py + 6}" stroke="#c8cfdf" stroke-width="2"/>`
        + (on ? `<circle cx="${cx + 8}" cy="${py + 5}" r="3" fill="#ff4757" class="blink"/>` : '');
    } else if (o.kind === 'files') {
      g = on ? `<rect x="${px + 9}" y="${py + 6}" width="22" height="28" rx="2" fill="#6b7389" stroke="#3a4054"/><path d="M${px + 9} ${py + 15} H${px + 31} M${px + 9} ${py + 24} H${px + 31}" stroke="#3a4054" stroke-width="1.5"/><rect x="${px + 17}" y="${py + 9}" width="6" height="3" fill="#c8cfdf"/><rect x="${px + 12}" y="${py + 3}" width="14" height="5" fill="#e9e4dc" transform="rotate(-8 ${cx} ${py + 5})"/>`
        : `<rect x="${px + 9}" y="${py + 6}" width="22" height="28" rx="2" fill="#2a2a2e"/><path d="M${cx} ${py + 8} q8 10 0 18 q-8 -8 0 -18" fill="#ff8a3d" opacity="0.85"/>`;
    } else if (o.kind === 'person') {
      g = `<ellipse cx="${cx}" cy="${cy + 3}" rx="12" ry="8" fill="#5a7a9a"/><circle cx="${cx}" cy="${cy}" r="6" fill="#3a2a20"/>` + (on ? `<path d="M${cx + 6} ${py + 2} h12 v8 h-8 l-3 3 v-3 h-1 Z" fill="#fff"/><text x="${cx + 12}" y="${py + 9}" class="tac-tx dark">!</text>` : '');
    } else if (o.kind === 'prisoner') {
      g = `<ellipse cx="${cx}" cy="${cy + 4}" rx="11" ry="7" fill="#6b5a4a"/><circle cx="${cx}" cy="${cy}" r="6" fill="#2a1f18"/>`
        + `<rect x="${px + 3}" y="${py + 3}" width="${TS - 6}" height="${TS - 6}" fill="none" stroke="#9aa6c2" stroke-width="2"/>${[11, 20, 29].map((dx) => `<path d="M${px + dx} ${py + 3} V${py + TS - 3}" stroke="#9aa6c2" stroke-width="2.5"/>`).join('')}`;
    } else {
      // 終端：桌子、螢幕、鍵盤
      g = `<rect x="${px + 4}" y="${py + 8}" width="32" height="24" rx="2" fill="#4a3b2c" stroke="#2a2018" stroke-width="1.5"/><rect x="${px + 10}" y="${py + 10}" width="20" height="12" rx="1" fill="#0b0f1c" stroke="#5a6684"/>`
        + `<rect x="${px + 12}" y="${py + 12}" width="16" height="8" fill="${on ? '#2ff3e0' : '#26304a'}" opacity="${on ? 0.8 : 1}"/><rect x="${px + 11}" y="${py + 25}" width="18" height="4" rx="1" fill="#1a1f2e"/>`;
    }
    if (o.done) g += `<circle cx="${px + 32}" cy="${py + 8}" r="7" fill="#5cf29a"/><path d="M${px + 28.5} ${py + 8} l2.5 2.5 l4.5 -5" stroke="#05140c" stroke-width="2" fill="none"/>`;
    return g;
  }

  // ===== 敵人 =====
  const angleOf = (f) => Math.atan2(f.face[1], f.face[0]) * 180 / Math.PI;
  function guardSvg(f) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    if (f.down) {
      return `<g transform="translate(${cx} ${cy}) rotate(80)"><ellipse rx="13" ry="7" fill="#26324a" opacity="0.8"/><circle cx="9" r="5.5" fill="#1a1f2b"/></g><text x="${cx + 10}" y="${cy - 8}" class="tac-tx dim">Zz</text>`;
    }
    const uniform = f.state === 'alert' ? '#5a1f2a' : '#24324e';
    // 手電筒的光、身體（肩膀和頭盔）、面對的方向
    let g = `<g transform="translate(${cx} ${cy}) rotate(${angleOf(f)})">`
      + (f.state !== 'distracted' ? `<path d="M6 0 L58 -22 L58 22 Z" fill="url(#tx-beam)"/>` : '')
      + `<ellipse cx="1" cy="1" rx="10" ry="14" fill="#000" opacity="0.3"/><ellipse rx="9" ry="13" fill="${uniform}" stroke="#0e121b" stroke-width="1.5"/>`
      + `<rect x="4" y="5" width="9" height="3.5" rx="1.5" fill="#c8cfdf"/>`
      + `<circle r="6.5" fill="#1a1f2b" stroke="#3a4560" stroke-width="1.2"/><path d="M3 -4 a5 5 0 0 1 0 8" stroke="#6cd6e2" stroke-width="2" fill="none"/></g>`;
    if (f.state === 'alert') g += `<circle cx="${cx}" cy="${cy - 19}" r="7" fill="#ff4757"/><text x="${cx}" y="${cy - 15}" class="tac-tx dark">!</text>`;
    if (f.state === 'distracted') g += `<path d="M${cx - 9} ${cy - 27} h18 v10 h-11 l-4 4 v-4 h-3 Z" fill="#ffd23f"/><text x="${cx}" y="${cy - 19}" class="tac-tx dark">…</text>`;
    return g;
  }

  // 守衛犬：俯視的狗，尾巴、耳朵、項圈。叫的時候頭上有聲波；交上朋友的狗坐著，頭上一顆愛心。
  // 守衛要去查看的那一格：問號，和一條從守衛拉過去的虛線。
  function checkMark(cx, cy) {
    return `<circle cx="${cx}" cy="${cy}" r="17" fill="rgba(255,71,87,0.1)" stroke="#ff4757" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="${cx - 13}" cy="${cy - 13}" r="7" fill="#ff4757"/><text x="${cx - 13}" y="${cy - 9}" class="tac-tx dark">?</text>`;
  }
  function checkSvg(f) {
    const cx = f.target[0] * TS + TS / 2, cy = f.target[1] * TS + TS / 2;
    return `<line x1="${f.x * TS + TS / 2}" y1="${f.y * TS + TS / 2}" x2="${cx}" y2="${cy}" stroke="#ff4757" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.7"/>` + checkMark(cx, cy);
  }

  function dogSvg(f) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    const fur = '#8a5a36', dark = '#5a3820';
    let g = `<g transform="translate(${cx} ${cy}) rotate(${angleOf(f)})">`
      + `<ellipse cx="1" cy="2" rx="13" ry="8" fill="#000" opacity="0.3"/>`
      + (f.friend ? `<path d="M-9 0 q-8 -6 -10 2" stroke="${fur}" stroke-width="3" fill="none" stroke-linecap="round" class="wag"/>` : `<path d="M-10 0 q-7 0 -9 -5" stroke="${fur}" stroke-width="3" fill="none" stroke-linecap="round"/>`)
      + `<ellipse rx="10" ry="6.5" fill="${fur}" stroke="${dark}" stroke-width="1.2"/>`
      + `<path d="M-3 -6 v12" stroke="#d94040" stroke-width="2.2"/>`
      + `<ellipse cx="9" rx="5.5" ry="5" fill="${fur}" stroke="${dark}" stroke-width="1.2"/><ellipse cx="14" rx="2.6" ry="2.2" fill="${dark}"/><circle cx="15.5" r="1.1" fill="#111"/>`
      + `<path d="M7 -4 l-3 -4 l4 1 Z M7 4 l-3 4 l4 -1 Z" fill="${dark}"/></g>`;
    if (f.friend) g += `<path d="M${cx} ${cy - 13} c-2 -4 -8 -3 -7 1 c1 3 7 6 7 6 c0 0 6 -3 7 -6 c1 -4 -5 -5 -7 -1 Z" fill="#ff5d8f"/>`;
    else if (f.state === 'alert') g += `<path d="M${cx + 8} ${cy - 16} q4 4 0 8 M${cx + 12} ${cy - 19} q6 7 0 14" stroke="#ff4757" stroke-width="2" fill="none"/><circle cx="${cx}" cy="${cy - 19}" r="7" fill="#ff4757"/><text x="${cx}" y="${cy - 15}" class="tac-tx dark">!</text>`;
    return g;
  }

  function droneSvg(f) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    const col = f.down ? '#5a6684' : f.loop > 0 ? '#6cd6e2' : '#c2b3ff';
    let g = `<ellipse cx="${cx + 4}" cy="${cy + 10}" rx="12" ry="5" fill="#000" opacity="${f.down ? 0 : 0.35}"/>`
      + `<g transform="translate(${cx} ${cy})" opacity="${f.down ? 0.6 : 1}"><path d="M-10 -10 L10 10 M10 -10 L-10 10" stroke="#3a4560" stroke-width="3"/>`
      + [[-11, -11], [11, -11], [-11, 11], [11, 11]].map(([dx, dy]) => `<circle cx="${dx}" cy="${dy}" r="6.5" fill="${col}" opacity="0.25"/><circle cx="${dx}" cy="${dy}" r="6.5" fill="none" stroke="${col}" stroke-width="1.2"/>`).join('')
      + `<rect x="-6" y="-5" width="12" height="10" rx="3" fill="#1a1f2e" stroke="${col}" stroke-width="1.5"/>`
      + (f.down ? '' : `<circle cy="0" r="2.2" fill="${f.loop > 0 ? '#6cd6e2' : '#ff4757'}" class="blink"/>`) + `</g>`;
    if (f.loop > 0) g += `<text x="${cx}" y="${cy - 19}" class="tac-tx cyan">∞</text>`;
    return g;
  }

  function camSvg(s, f) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    const off = f.off > 0 || f.down;
    // 牆上的支架，機身朝向監視的方向，鏡頭在前面
    return `<g transform="translate(${cx} ${cy}) rotate(${angleOf(f)})"><rect x="-12" y="-3" width="8" height="6" fill="#5a6684"/>`
      + `<rect x="-6" y="-7" width="18" height="14" rx="3" fill="${off ? '#3a4054' : '#c8cfdf'}" stroke="#1a1f2b" stroke-width="1.5"/>`
      + `<circle cx="12" r="4.5" fill="#0b0f1c" stroke="${off ? '#3a4054' : '#ff9a3d'}" stroke-width="2"/>`
      + (off ? '' : `<circle cx="-2" cy="-3" r="1.8" fill="#ff4757" class="blink"/>`) + `</g>`
      + (off ? `<path d="M${cx - 6} ${cy - 6} l12 12 M${cx + 6} ${cy - 6} l-12 12" stroke="#ff5d6c" stroke-width="2.5"/>` : '');
  }

  function unitSvg(s, u) {
    const px = u.x * TS, py = u.y * TS;
    const face = E.faces.of(N.person(s, u.id), { round: true }).replace('<svg ', `<svg x="${px + 4}" y="${py + 4}" width="32" height="32" `);
    const mine = u.id === sel;
    const ring = mine ? '#ff2e88' : u.escort ? '#ffd23f' : '#6cd6e2';
    return `<g class="tac-unit${mine ? ' sel' : ''}"><circle cx="${px + TS / 2}" cy="${py + TS / 2 + 2}" r="17" fill="#000" opacity="0.35"/>`
      + `<circle cx="${px + TS / 2}" cy="${py + TS / 2}" r="17" fill="#0b0f1c" stroke="${ring}" stroke-width="${mine ? 3.5 : 2}"/>${face}`
      + (u.disguise > 0 ? `<rect x="${px + 26}" y="${py + 1}" width="13" height="9" rx="2" fill="#c2b3ff"/><text x="${px + 32.5}" y="${py + 8.5}" class="tac-tx dark small">${u.disguise}</text>` : '')
      + (s.op.hurt[u.id] ? `<rect x="${px + 1}" y="${py + 1}" width="10" height="10" rx="2" fill="#ff5d6c"/><path d="M${px + 6} ${py + 3} v6 M${px + 3} ${py + 6} h6" stroke="#fff" stroke-width="2"/>` : '')
      + `<g transform="translate(${px + TS / 2 - (u.ap - 1) * 4} ${py + TS - 2})">${Array.from({ length: u.ap }, (_, i) => `<circle cx="${i * 8}" r="3" fill="#6cd6e2" stroke="#0b0f1c"/>`).join('')}</g></g>`;
  }

  // ===== 能力的小圖示（畫在可以動手的格子上） =====
  const GOLD = '#ffd23f'; // 招式卡一律金色
  const AB_COLOR = { hack: '#2ff3e0', climb: '#ff9a3d', takedown: '#ff9a3d', force: '#ff9a3d', breach: '#ff9a3d', talk: '#c2b3ff', disguise: GOLD, unlock: '#5cf29a', heal: '#5cf29a', cab: GOLD, use: '#ff2e88', pet: '#5cf29a',
    summon: GOLD, code: GOLD, ghost: GOLD, soothe: GOLD, lift: GOLD, boost: GOLD, cover: GOLD, radio: GOLD, pigeon: GOLD, sergei: GOLD };
  const colorOf = (ab, card) => (card ? GOLD : { move: '#6cd6e2', select: '#9aa6c0' }[ab] || AB_COLOR[ab] || '#ff2e88');
  function glyph(ab) {
    const w = '#0b0f1c';
    switch (ab) {
      case 'hack': return `<path d="M-6 -1 a8.5 8.5 0 0 1 12 0 M-3.5 2 a4.5 4.5 0 0 1 7 0" stroke="${w}" stroke-width="2" fill="none"/><circle cy="5" r="1.6" fill="${w}"/>`;
      case 'climb': return `<path d="M-5 1 l5 -5 l5 5 M-5 6 l5 -5 l5 5" stroke="${w}" stroke-width="2" fill="none"/>`;
      case 'takedown': return `<rect x="-5.5" y="-4" width="11" height="8" rx="2.5" fill="${w}"/><path d="M-2.5 -4 v3 M0.5 -4 v3 M3 -4 v3" stroke="#fff" stroke-width="1"/>`;
      case 'force': return `<path d="M0 -7 l2 4 l5 -1 l-3 4 l4 3 l-5 0 l-1 5 l-2 -4 l-4 3 l1 -5 l-4 -2 l5 -1 Z" fill="${w}"/>`;
      case 'talk': return `<path d="M-6 -5 h12 v8 h-6 l-3 3 v-3 h-3 Z" fill="${w}"/>`;
      case 'unlock': return `<circle cx="-3" cy="0" r="3.2" stroke="${w}" stroke-width="2" fill="none"/><path d="M0 0 h6 M4 0 v3" stroke="${w}" stroke-width="2"/>`;
      case 'heal': return `<path d="M0 -5 v10 M-5 0 h10" stroke="${w}" stroke-width="3"/>`;
      case 'disguise': return `<path d="M-6 -2 q6 -6 12 0 q-2 5 -6 5 q-4 0 -6 -5 Z" fill="${w}"/><circle cx="-2.5" cy="-1" r="1.2" fill="#fff"/><circle cx="2.5" cy="-1" r="1.2" fill="#fff"/>`;
      case 'cab': return `<path d="M-6 2 v-3 l2 -3 h8 l2 3 v3 Z" fill="${w}"/><circle cx="-3.5" cy="3" r="1.6" fill="${w}"/><circle cx="3.5" cy="3" r="1.6" fill="${w}"/>`;
      case 'summon': return `<circle cx="-2" cy="-2.5" r="2.6" fill="${w}"/><path d="M-6.5 5 q4.5 -7 9 0" fill="${w}"/><path d="M4 -4 v6 M1 -1 h6" stroke="${w}" stroke-width="1.8"/>`;
      case 'code': return `${[-4, 0, 4].map((x) => [-3, 1].map((y) => `<rect x="${x - 1.4}" y="${y - 1.4}" width="2.8" height="2.8" fill="${w}"/>`).join('')).join('')}<rect x="-1.4" y="4" width="2.8" height="2.8" fill="${w}"/>`;
      case 'ghost': return `<path d="M-5 5 v-5 a5 5 0 0 1 10 0 v5 l-2.5 -2 l-2.5 2 l-2.5 -2 Z" fill="${w}"/><circle cx="-2" cy="-1" r="1" fill="#fff"/><circle cx="2" cy="-1" r="1" fill="#fff"/>`;
      case 'soothe': return `<path d="M-6 -4 h12 v7 h-6 l-3 3 v-3 h-3 Z" fill="${w}"/><path d="M-3 0 q3 2 6 0" stroke="#fff" stroke-width="1.2" fill="none"/>`;
      case 'lift': return `<rect x="-5" y="-3.5" width="10" height="7" rx="1.5" fill="${w}"/><rect x="-3.5" y="-2" width="3" height="2" fill="#fff"/>`;
      case 'breach': return `<path d="M-6 -5 l4 10 M0 -5 l-1 4 l2 2 l-1 4 M6 -5 l-4 10" stroke="${w}" stroke-width="2" fill="none"/>`;
      case 'boost': return `<path d="M0 -6 l1.8 3.8 l4.2 .6 l-3 2.9 l.7 4.1 l-3.7 -2 l-3.7 2 l.7 -4.1 l-3 -2.9 l4.2 -.6 Z" fill="${w}"/>`;
      case 'cover': return `<path d="M-6 5 l6 -10 l6 10 Z" fill="${w}"/><path d="M0 -5 v10" stroke="#fff" stroke-width="1"/>`;
      case 'radio': return `<rect x="-5" y="-1" width="10" height="7" rx="1.5" fill="${w}"/><path d="M-3 -1 l6 -5" stroke="${w}" stroke-width="1.6"/><circle cx="2" cy="2.5" r="1.8" fill="#fff"/>`;
      case 'pigeon': return `<path d="M-6 1 q3 -6 8 -3 l4 -1 l-3 3 q-1 5 -6 4 Z" fill="${w}"/><circle cx="3" cy="-2.5" r=".9" fill="#fff"/>`;
      // 謝爾蓋：四個旋翼的小無人機
      case 'sergei': return `<rect x="-2.5" y="-2" width="5" height="4" rx="1" fill="${w}"/><path d="M-2 -1.5 L-5 -4.5 M2 -1.5 L5 -4.5 M-2 1.5 L-5 4.5 M2 1.5 L5 4.5" stroke="${w}" stroke-width="1.4"/>${[[-5, -4.5], [5, -4.5], [-5, 4.5], [5, 4.5]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.1" fill="${w}"/>`).join('')}`;
      case 'move': return `<path d="M-6 0 H3 M-1 -5 L5 0 L-1 5" stroke="${w}" stroke-width="2.4" fill="none"/>`;
      case 'select': return `<circle cy="-2.5" r="3" fill="${w}"/><path d="M-5.5 6 q5.5 -8 11 0" fill="${w}"/>`;
      case 'pet': return `<circle cx="0" cy="2" r="3.2" fill="${w}"/>${[[-4.5, -2], [-1.5, -4.5], [1.5, -4.5], [4.5, -2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${w}"/>`).join('')}`;
      default: return `<circle r="4" stroke="${w}" stroke-width="2" fill="none"/><circle r="1.5" fill="${w}"/>`;
    }
  }
  function badge(ab, x, y, count, card) {
    const cx = x * TS + TS - 9, cy = y * TS + 9;
    // 位置放在外層，跳動的動畫放在內層（CSS 的 transform 會蓋掉 SVG 的 transform）。
    return `<g transform="translate(${cx} ${cy})"><g class="tac-badge"><circle r="9.5" fill="${colorOf(ab, card)}" stroke="#0b0f1c" stroke-width="1.5"/>${glyph(ab)}</g></g>`
      + (count > 1 ? `<g transform="translate(${cx - 12} ${cy + 1})"><circle r="6" fill="#fff"/><text y="3" class="tac-tx dark small">${count}</text></g>` : '');
  }

  // 選中的人，每一格可以做哪些事（移動以外）。
  function actionsByTile(s) {
    const out = {};
    if (!sel) return out;
    for (const a of N.tacAbilities(s, sel)) {
      if (aim && a.id !== aim) continue;
      for (const [x, y] of a.targets) (out[x + ',' + y] = out[x + ',' + y] || []).push({ ab: a.id, x, y, kind: a.kind, ap: a.ap, bw: a.bw || 0, card: !!a.card, noise: a.noise || 0 });
    }
    return out;
  }

  // 會移動的東西：畫完之後比對位置，換了位置的滑過去（motion）。
  const mover = (id, o, inner) => `<g data-mv="${id}" data-mx="${o.x}" data-my="${o.y}">${inner}</g>`;
  function motion(root) {
    const now = {};
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const el of root.querySelectorAll('[data-mv]')) {
      const x = Number(el.dataset.mx), y = Number(el.dataset.my), was = spots[el.dataset.mv];
      now[el.dataset.mv] = [x, y];
      if (still || !was || !el.animate || (was[0] === x && was[1] === y)) continue;
      const dist = Math.abs(was[0] - x) + Math.abs(was[1] - y);
      el.animate([{ transform: `translate(${(was[0] - x) * TS}px, ${(was[1] - y) * TS}px)` }, { transform: 'translate(0, 0)' }], { duration: Math.min(320, 100 + 40 * dist), easing: 'ease-out' });
    }
    spots = now;
  }

  // ===== 整張地圖 =====
  // marks：教學關要亮起來的格子。
  function mapSvg(s, marks = []) {
    const tac = s.op.tac;
    let g = defs();
    for (let y = 0; y < tac.h; y++) {
      for (let x = 0; x < tac.w; x++) {
        const c = tac.map[y][x];
        if (c === '#') continue;
        g += floorSvg(s, c, x, y);
      }
    }
    for (let y = 0; y < tac.h; y++) for (let x = 0; x < tac.w; x++) if (tac.map[y][x] === '#') g += wallSvg(s, x, y);
    // 敵人看得到的格子（淡淡的紅、橘、紫）
    const vis = N.tacVision(s);
    for (const f of tac.foes) {
      const col = f.kind === 'cam' ? '255,154,61' : f.kind === 'drone' ? '194,179,255' : f.kind === 'dog' ? '214,150,80' : '255,80,95';
      const a = f.state === 'alert' ? 0.32 : 0.2;
      g += (vis[f.id] || []).map(([x, y]) => `<rect x="${x * TS + 1}" y="${y * TS + 1}" width="${TS - 2}" height="${TS - 2}" fill="rgba(${col},${a})"/>`).join('');
    }
    for (let y = 0; y < tac.h; y++) {
      for (let x = 0; x < tac.w; x++) {
        const c = tac.map[y][x];
        if (c === '=') g += fenceSvg(s, x, y);
        else if (c === 'D' || c === 'd') g += doorSvg(s, x, y, c === 'D');
        else if (c === 'H') g += hideSvg(s, x, y);
        else if (c === 'X') g += exitSvg(s, x, y);
      }
    }
    // 外圍情報、過目不忘、酒保：看得到巡邏路線
    if (tac.intel) {
      for (const f of tac.foes) {
        if (f.kind === 'cam' || f.down || !f.route || f.route.length < 2) continue;
        g += `<polyline points="${f.route.concat([f.route[0]]).map(([x, y]) => `${x * TS + TS / 2},${y * TS + TS / 2}`).join(' ')}" fill="none" stroke="rgba(255,210,63,0.4)" stroke-width="2" stroke-dasharray="4 4"/>`;
      }
    }
    g += tac.objs.map(objSvg).join('');
    // 可以走的格子：藍色安全、橘色路上會被看到
    const u = unitsOf(s).find((x) => x.id === sel);
    if (u) {
      const r = N.tacReach(s, u.id);
      const risky = new Set(N.tacRisky(s, u.id));
      g += Object.keys(r).map((k) => { const [x, y] = k.split(',').map(Number); return `<rect class="tac-reach${risky.has(k) ? ' risky' : ''}" x="${x * TS + 4}" y="${y * TS + 4}" width="${TS - 8}" height="${TS - 8}" rx="5"/>`; }).join('');
    }
    for (const f of tac.foes) g += f.kind === 'cam' ? camSvg(s, f) : f.kind === 'drone' ? '' : mover('f:' + f.id, f, f.kind === 'dog' ? dogSvg(f) : guardSvg(f));
    g += liveUnits(s).map((x) => mover('u:' + x.id, x, unitSvg(s, x))).join('');
    // 問號畫在人上面：查看的那一格可能還站著人。
    g += tac.foes.filter((f) => f.kind === 'guard' && !f.down && f.state === 'alert' && f.target && !f.chase).map(checkSvg).join('');
    for (const f of tac.foes) if (f.kind === 'drone') g += mover('f:' + f.id, f, droneSvg(f)); // 無人機飛在最上層
    // 可以動手的格子：畫上能力的小圖示
    const acts = actionsByTile(s);
    for (const k of Object.keys(acts)) {
      const [x, y] = k.split(',').map(Number);
      if (u && u.x === x && u.y === y) continue; // 自己腳下的（偽裝、叫車）放在自己的選單裡
      g += `<rect class="tac-target${aim ? ' aim' : ''}" x="${x * TS + 2}" y="${y * TS + 2}" width="${TS - 4}" height="${TS - 4}" rx="5"/>` + badge(acts[k][0].ab, x, y, acts[k].length, acts[k][0].card);
    }
    if (u && acts[u.x + ',' + u.y]) g += badge(acts[u.x + ',' + u.y][0].ab, u.x, u.y, acts[u.x + ',' + u.y].length, acts[u.x + ',' + u.y][0].card);
    // 教學關：這一步要點的地方，一圈會呼吸的光
    g += marks.map(([x, y]) => `<circle class="tut-mark" cx="${x * TS + TS / 2}" cy="${y * TS + TS / 2}" r="${TS * 0.62}"/>`).join('');
    // 點擊用的透明格子
    for (let y = 0; y < tac.h; y++) for (let x = 0; x < tac.w; x++) g += `<rect class="tac-hit" data-act="tacTile" data-x="${x}" data-y="${y}" x="${x * TS}" y="${y * TS}" width="${TS}" height="${TS}"/>`;
    return `<svg class="tac-map" viewBox="0 0 ${tac.w * TS} ${tac.h * TS}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
  }

  // ===== 地圖上的小選單和說明 =====
  function at(s, x, y) {
    const t = s.op.tac, up = y >= t.h * 0.6;
    return { cls: up ? ' up' : '', style: `left:clamp(var(--half), ${((x + 0.5) / t.w * 100).toFixed(2)}%, calc(100% - var(--half)));top:${((up ? y : y + 1) / t.h * 100).toFixed(2)}%` };
  }
  // 選單上的字：駭入要說清楚會發生什麼（鎖門和開門差很多）。
  function abLabel(s, a) {
    if (a.ab === 'use') return T('tac.obj.' + a.kind);
    if (a.ab === 'select') return T('tac.ab.select', { name: { l: E.people.name(N.person(s, a.id)) } });
    if (a.ab !== 'hack') return T('tac.ab.' + a.ab);
    const f = s.op.tac.foes.find((v) => v.x === a.x && v.y === a.y && !v.down);
    const c = tileAt(s, a.x, a.y);
    return T('tac.ab.' + (f ? (f.kind === 'cam' ? 'hackCam' : 'hackDrone') : c === 'd' ? 'lockDoor' : c === 'D' ? 'hackDoor' : 'hack'));
  }
  function costText(a) {
    if (a.ab === 'select') return '';
    return [a.ap ? T('tac.cost', { n: a.ap }) : T('tac.card.free'), a.bw ? T('tac.costBw', { n: a.bw }) : '', a.noise ? T('tac.costNoise', { n: a.noise }) : '', a.seen ? T('tac.costSeen') : ''].filter(Boolean).join(' · ');
  }
  function popHtml(s) {
    if (!pop) return '';
    const p = at(s, pop.x, pop.y);
    return `<div class="tac-pop${p.cls}" style="${p.style}">`
      + pop.items.map((a) => `<button data-act="tacPick" data-ab="${a.ab}" data-x="${a.x}" data-y="${a.y}"${a.kind ? ` data-kind="${a.kind}"` : ''}${a.id ? ` data-id="${a.id}"` : ''}>`
        + `<svg viewBox="-11 -11 22 22" class="tp-ic"><circle r="10" fill="${colorOf(a.ab, a.card)}"/>${glyph(a.ab)}</svg><span><b>${abLabel(s, a)}</b><small>${costText(a)}</small></span></button>`).join('')
      + `<button class="ghost" data-act="tacClose">${T('tac.cancel')}</button></div>`;
  }
  function tipHtml(s) {
    if (!tip) return '';
    const p = at(s, tip.x, tip.y);
    return `<div class="tac-tip${p.cls}" style="${p.style}" data-act="tacClose" role="button"><b>${T(tip.title)}</b><span>${T(tip.k, tip.v)}</span></div>`;
  }

  // 點到敵人或目標：說明它是什麼、正在做什麼。
  function describe(s, x, y) {
    const tac = s.op.tac;
    const f = tac.foes.find((v) => v.x === x && v.y === y);
    if (f) {
      if (f.kind === 'cam') return { title: 'tac.leg.cam', k: f.off > 0 ? 'tac.tip.camOff' : 'tac.leg.cam.d', v: { n: f.off } };
      if (f.kind === 'drone') return { title: 'tac.leg.drone', k: f.down ? 'tac.tip.down' : f.loop > 0 ? 'tac.tip.droneLoop' : 'tac.leg.drone.d' };
      if (f.kind === 'dog') return { title: 'tac.leg.dog', k: f.friend ? 'tac.tip.dogFriend' : f.state === 'alert' ? 'tac.tip.dogAlert' : 'tac.leg.dog.d' };
      return { title: 'tac.leg.guard', k: f.down ? 'tac.tip.down' : f.state === 'alert' ? (f.chase ? 'tac.tip.hunt' : 'tac.tip.alert') : f.state === 'distracted' ? 'tac.tip.distracted' : 'tac.tip.patrol' };
    }
    const o = tac.objs.find((v) => v.x === x && v.y === y);
    if (o) return { title: 'tac.obj.' + o.kind, k: o.done ? 'tac.tip.objDone' : 'tac.tip.obj' };
    const c = tileAt(s, x, y);
    const map = { D: 'door', '=': 'fence', H: 'hide', X: 'exit', ',': 'dark' };
    if (map[c]) return { title: 'tac.leg.' + map[c], k: 'tac.leg.' + map[c] + '.d' };
    return null;
  }

  // ===== 這個人會什麼：每一項都寫出來源（類別、專長、特質、弱點、小習慣） =====
  function capList(s, id) {
    const c = N.tacCaps(s, id);
    if (c.escort) return [{ k: 'tac.cap.escort' }];
    const tac = s.op.tac;
    const u = unitsOf(s).find((x) => x.id === id);
    const p = N.person(s, id);
    const D = data();
    const cat = { t: 's2.p.cat.' + c.cat };
    const perk = { l: D.perks[c.perk].name };
    const tr = (x) => ({ l: D.traits.find((z) => z.id === x).name });
    const fl = (x) => ({ l: D.flaws.find((z) => z.id === x).name });
    const qk = (x) => ({ l: D.quirks.find((z) => z.id === x).name });
    const traits = N.traitIds(s, id), quirks = p.quirks, flaw = p.flaw;
    const has = (x) => traits.includes(x), hq = (x) => quirks.includes(x);
    const perkUnlock = E.tactics.UNLOCKS.includes(c.perk);
    const out = [];
    const add = (k, v, src, cls, ab) => out.push({ k, v, src, cls, ab });
    if (u && u.helper) add('tac.cap.helper', {}, null, 'good');
    const moveSrc = has('fast') ? tr('fast') : hq('marathon') ? qk('marathon') : ['sprint', 'rooftops'].includes(c.perk) ? perk : c.bike ? qk('cyclist') : flaw === 'bad_knees' ? fl('bad_knees') : null;
    add('tac.cap.move', { n: c.move }, moveSrc, flaw === 'bad_knees' ? 'bad' : '');
    // 駭入
    if (c.hack) add('tac.cap.hack', { n: c.hackRange }, c.cat === 'hacker' ? cat : p.skills.hack >= 2 ? { t: 's2.p.hack' } : perk, '', 'hack');
    if (c.perk === 'legacy') { add('tac.cap.freeHack', {}, perk); add('tac.cap.silentHack', {}, perk); add('tac.cap.remote', {}, perk); }
    if (c.perk === 'network_access') { add('tac.cap.silentHack', {}, perk); add('tac.cap.officeHack', {}, perk, tac.theme === 'office' ? '' : 'dim'); }
    if (c.perk === 'backdoor') add('tac.cap.backdoor', {}, perk);
    if (c.perk === 'botnet') add('tac.cap.botnet', {}, perk);
    if (c.perk === 'take_over') add('tac.cap.takeOver', {}, perk);
    // 身體
    if (c.climb) add(c.climbCost === 0 ? 'tac.cap.climbFree' : c.climbCost > 1 ? 'tac.cap.climbSlow' : 'tac.cap.climb', {}, c.cat === 'physical' ? cat : has('nimble') ? tr('nimble') : perk, c.climbCost > 1 ? 'bad' : '', 'climb');
    else if (flaw === 'acrophobia') add('tac.cap.noclimb', {}, fl(flaw), 'bad');
    if (c.takedown) add(c.anyAngle ? 'tac.cap.takedownAny' : 'tac.cap.takedown', {}, has('strong') ? tr('strong') : hq('ex_army') ? qk('ex_army') : c.perk === 'river_route' ? perk : cat, '', 'takedown');
    add('tac.cap.force', { n: c.strong || c.lift ? 1 : 2 }, c.lift ? perk : c.strong ? (has('strong') ? tr('strong') : cat) : null, c.strong || c.lift ? '' : 'dim', 'force');
    if (c.lift) add('tac.cap.lift', {}, perk, '', 'breach');
    // 社交
    if (c.teaOnly) add('tac.cap.tea', { n: c.talkRange, t: c.talkTurns }, qk('tea'), '', 'talk');
    else if (c.talk) add('tac.cap.talk', { n: c.talkRange, t: c.talkTurns }, c.cat === 'social' ? cat : has('silver') ? tr('silver') : hq('choir') ? qk('choir') : perk, '', 'talk');
    if (c.talkAlert) add('tac.cap.talkAlert', {}, has('silver') ? tr('silver') : perk);
    if (c.talkDrone) add('tac.cap.talkDrone', {}, perk);
    // 開門、急救、其他專長
    if (c.unlock) add(perkUnlock ? 'tac.cap.unlock' : 'tac.cap.keycard', {}, perkUnlock ? perk : null, '', 'unlock');
    else if (c.needles) add('tac.cap.needles', {}, qk('knitting'), '', 'unlock');
    if (c.heal) add('tac.cap.heal', {}, perk, '', 'heal');
    if (c.perk === 'bail') add('tac.cap.lawyer', {}, perk, tac.used.bail ? 'dim' : '');
    if (c.perk === 'unsuspicious') add('tac.cap.plain', {}, perk);
    if (c.perk === 'master_keys') add('tac.cap.cleaner', {}, perk);
    // 被動的特質和小習慣
    if (c.quiet && has('careful')) add('tac.cap.quiet', {}, tr('careful'));
    // 天賦（隊友事件送的）
    if (c.gifts.includes('quietstep')) add('tac.cap.soft', {}, { t: 's2.p.gifts' }, 'good');
    if (c.sergei) add('tac.cap.sergei', {}, { t: 's2.p.gifts' }, tac.used['sergei:' + id] ? 'dim' : '', 'sergei');
    if (has('calm')) add('tac.cap.calm', {}, tr('calm'), tac.used['calm:' + id] ? 'dim' : '');
    if (c.slip) add('tac.cap.fast', {}, has('fast') ? tr('fast') : perk, tac.used['fast:' + id] ? 'dim' : '');
    if (has('unremarkable')) add('tac.cap.unremarkable', {}, tr('unremarkable'));
    if (has('nightowl')) add('tac.cap.nightowl', {}, tr('nightowl'));
    if (c.intel) add('tac.cap.memory', {}, has('memory') ? tr('memory') : perk);
    const partners = liveUnits(s).filter((o) => o.id !== id && !o.escort);
    if (hq('cantonese')) add('tac.cap.canto', {}, qk('cantonese'), partners.some((o) => N.person(s, o.id).quirks.includes('cantonese')) ? '' : 'dim');
    if (hq('birdwatcher')) add('tac.cap.birdwatcher', {}, qk('birdwatcher'));
    if (hq('dogs_love')) add('tac.cap.dogsLove', {}, qk('dogs_love'), '', 'pet');
    if (hq('cyclist')) add('tac.cap.bike', {}, qk('cyclist'), c.bike ? '' : 'dim');
    if (hq('night_shift')) add('tac.cap.nightShift', {}, qk('night_shift'), tac.turn === 1 ? '' : 'dim');
    // 弱點和會出包的小習慣
    if (c.loud) add('tac.cap.loud', {}, fl('loudmouth'), 'bad');
    if (flaw === 'record') add('tac.cap.record', {}, fl('record'), 'bad');
    if (c.dark) add('tac.cap.dark', {}, fl('dark'), 'bad');
    if (flaw === 'nervous') add('tac.cap.nervous', {}, fl('nervous'), 'bad');
    if (flaw === 'phone') add('tac.cap.phone', {}, fl('phone'), 'bad');
    if (c.lost) add('tac.cap.lost', {}, fl('no_sense'), 'bad');
    if (c.clumsy) add('tac.cap.clumsy', {}, fl('clumsy'), 'bad');
    if (flaw === 'honest') add('tac.cap.honest', {}, fl('honest'), 'bad');
    if (flaw === 'hothead') add('tac.cap.hothead', {}, fl('hothead'), 'bad');
    if (hq('smoker')) add('tac.cap.smoker', {}, qk('smoker'), 'bad');
    if (flaw === 'allergic') add('tac.cap.allergic', {}, fl('allergic'), 'bad');
    if (hq('dogs_fear')) add('tac.cap.dogsFear', {}, qk('dogs_fear'), 'bad');
    // 德比戰、死對頭：同一張地圖上有誰
    const rivals = N.relationsOf(s, id).filter((r) => r.type === 'rival').map((r) => r.other);
    for (const o of partners) {
      const oq = N.person(s, o.id).quirks;
      const fan = (hq('man_utd') && oq.includes('liverpool')) ? 'man_utd' : (hq('liverpool') && oq.includes('man_utd')) ? 'liverpool' : null;
      if (fan) add('tac.cap.derby', { other: { l: E.people.name(N.person(s, o.id)) } }, qk(fan), 'bad');
      else if (rivals.includes(o.id)) add('tac.cap.derby', { other: { l: E.people.name(N.person(s, o.id)) } }, { l: D.relations.rival.name }, 'bad');
      if (N.relationsOf(s, id).some((r) => r.type === 'friend' && r.other === o.id)) add('tac.cap.friend', { other: { l: E.people.name(N.person(s, o.id)) } }, { l: D.relations.friend.name }, 'good');
    }
    return out;
  }

  // ===== 招式卡 =====
  // 卡片從哪裡來（特質、專長；偽裝也可能來自社交類）、在地圖上做什麼。
  function cardInfo(s, id, ab) {
    const d = E.tactics.CARDS[ab];
    const D = data();
    const p = N.person(s, id);
    const job = E.people.occupationOf(p);
    if (ab === 'disguise') {
      const c = N.tacCaps(s, id);
      return { src: job.perk === 'disguise' ? E.i18n.pick(D.perks.disguise.name) : t('s2.p.cat.' + job.category), desc: t('tac.cap.disguise', { n: c.disguiseTurns }) };
    }
    if (d.src === 'gift') return { src: t('s2.p.gifts'), desc: E.i18n.pick(E.s2.days.gifts[d.key].tac) };
    if (d.src === 'perk' || (d.perk && job.perk === d.perk)) return { src: E.i18n.pick(D.perks[job.perk].name), desc: E.i18n.pick(D.perks[job.perk].tac) };
    const trait = D.traits.find((x) => x.id === d.key);
    return { src: E.i18n.pick(trait.name), desc: E.i18n.pick(trait.card.tac) };
  }
  function cardsHtml(s, id) {
    const list = N.tacCards(s, id);
    if (!list.length) return '';
    const abil = N.tacAbilities(s, id);
    return `<div class="tac-cards"><label>${T('tac.cards')}</label><div class="tc-row">` + list.map((cd) => {
      const a = abil.find((x) => x.id === cd.ab);
      const info = cardInfo(s, id, cd.ab);
      const state = cd.used ? T('tac.card.used') : !a ? T('tac.card.wait') : a.ap ? T('tac.cost', { n: a.ap }) : T('tac.card.free');
      return `<button class="tac-card${aim === cd.ab ? ' aiming' : ''}${cd.used ? ' used' : ''}" data-act="tacCard" data-ab="${cd.ab}" title="${esc(info.desc)}"${a && !cd.used ? '' : ' disabled'}>`
        + `<svg viewBox="-11 -11 22 22" class="tc-ic"><circle r="10" fill="${GOLD}"/>${glyph(cd.ab)}</svg>`
        + `<span><b>${T('tac.ab.' + cd.ab)}</b><small>${esc(info.src)} · ${state}</small><em>${esc(info.desc)}</em></span></button>`;
    }).join('') + `</div></div>`;
  }

  // ===== 第一次玩的圖解 =====
  function sample(inner) { return `<svg viewBox="0 0 ${TS} ${TS}" class="tg-ic">${defs()}${inner}</svg>`; }
  function guideHtml(s) {
    const fakeS = { op: { tac: { theme: s.op.tac.theme, w: 3, h: 3, map: ['...', '...', '...'] }, hurt: {} } };
    const items = [
      ['you', `<circle cx="20" cy="20" r="17" fill="#0b0f1c" stroke="#ff2e88" stroke-width="3"/><circle cx="20" cy="17" r="6" fill="#c8cfdf"/><path d="M9 33 q11 -12 22 0" fill="#c8cfdf"/>`],
      ['guard', guardSvg({ x: 0, y: 0, face: [1, 0], state: 'patrol' })],
      ['cam', camSvg(fakeS, { x: 0, y: 0, face: [1, 0], off: 0 })],
      ['drone', droneSvg({ x: 0, y: 0, loop: 0 })],
      ['dog', dogSvg({ x: 0, y: 0, face: [1, 0], state: 'patrol' })],
      ['door', `<rect width="40" height="40" fill="url(#tx-asphalt)"/>` + doorSvg(fakeS, 0, 0, true).replace(/<rect x="0"/g, '<rect x="0"')],
      ['fence', `<rect width="40" height="40" fill="url(#tx-asphalt)"/>` + fenceSvg(fakeS, 0, 0)],
      ['hide', `<rect width="40" height="40" fill="url(#tx-asphalt)"/>` + hideSvg(fakeS, 0, 0)],
      ['dark', `<rect width="40" height="40" fill="url(#tx-asphalt)"/><rect width="40" height="40" fill="#03050a" opacity="0.62"/>`],
      ['exit', `<rect width="40" height="40" fill="url(#tx-asphalt)"/><circle cx="20" cy="20" r="20" fill="url(#tx-exit)"/><rect x="3" y="3" width="34" height="34" rx="4" fill="none" stroke="#5cf29a" stroke-width="2" stroke-dasharray="5 3"/><path d="M12 12 H23 V7 L31 17 L23 27 V22 H12 Z" fill="#5cf29a"/>`],
      ['objective', objSvg({ x: 0, y: 0, kind: s.op.tac.objs[0] ? s.op.tac.objs[0].kind : 'terminal', done: false })],
      ['vision', `<rect width="40" height="40" fill="url(#tx-asphalt)"/><rect x="1" y="1" width="38" height="38" fill="rgba(255,80,95,0.3)"/>`],
      ['route', `<rect width="40" height="40" fill="url(#tx-asphalt)"/><rect x="4" y="4" width="32" height="32" rx="5" fill="rgba(108,214,226,0.2)" stroke="#6cd6e2" stroke-width="1.5"/><rect x="12" y="12" width="16" height="16" rx="3" fill="rgba(255,154,61,0.3)" stroke="#ff9a3d" stroke-width="1.5"/>`],
      ['badge', `<rect width="40" height="40" fill="url(#tx-asphalt)"/>` + badge('hack', 0, 0, 1).replace('translate(31 9)', 'translate(20 20)')],
      ['noise', `<rect width="40" height="40" fill="url(#tx-asphalt)"/>` + checkMark(20, 20)],
    ];
    return `<div class="tac-guide"><div class="tg-card"><h3>${T('tac.guide.title')}</h3><p class="hint">${T('tac.guide.intro')}</p><div class="tg-grid">`
      + items.map(([k, svg]) => `<div class="tg-item${k === 'noise' ? ' wide' : ''}">${sample(svg)}<span><b>${T('tac.guide.' + k)}</b><small>${T('tac.guide.' + k + '.d')}</small></span></div>`).join('')
      + `</div><div class="bar-actions"><button class="primary" data-act="tacGuideOk">${T('tac.guide.ok')}</button></div></div></div>`;
  }

  // ===== 教學關：Bagley 在地圖上方說這一步要做什麼 =====
  function coachHtml(s, st) {
    if (!st) return '';
    const steps = E.s2.tutorial.steps;
    const i = steps.indexOf(st);
    const role = st.who || st.name;
    const v = role ? { name: { l: E.people.name(N.person(s, s.tutorial.roles[role])) } } : {};
    return `<section class="tut-coach"><div class="bagley-face">${E.art.avatar('bagley')}</div>`
      + `<div class="tut-txt"><b>BAGLEY · ${T('tac.tut.stepOf', { i: i + 1, n: steps.length })}</b><p>${T('tac.tut.step.' + st.id, v)}</p></div>`
      + (i < steps.length - 1 ? `<button class="ghost" data-act="tutSkip">${T('tac.tut.skip')}</button>` : '') + `</section>`;
  }

  // ===== 整個畫面 =====
  // ui.tutorial：這是教學關（s 是教學用的沙盒）。
  function render(s, ui) {
    const tac = s.op.tac;
    const tut = ui.tutorial ? N.tutorialStep(s) : null;
    // 教學關不自動跳出圖解（教學本身就在教），要看再按「圖解」。
    if (guide === null && !ui.tutorial) guide = !lsGet(GUIDE_KEY);
    // 教學換到下一步（或剛結束回合、還沒選人）：先幫玩家選好這一步要動手的人。
    if (tut && (tut.id !== tutAt || !sel)) {
      tutAt = tut.id;
      const wu = tut.who && unitsOf(s).find((x) => x.id === s.tutorial.roles[tut.who]);
      if (wu && !wu.out && !wu.taken && wu.ap > 0) { sel = wu.id; pop = null; aim = null; }
    }
    autoSelect(s);
    const lvl = s.op.alert >= 60 ? 'hot' : s.op.alert >= 30 ? 'warm' : 'cool';
    const left = tac.objs.filter((o) => !o.done).length;
    const spent = !ready(s).length;
    let h = `<section class="op-head tac-head"><div class="tac-top"><div class="op-title">${P(s.op.name)}</div>`
      + `<span class="chip">${tac.limit ? T('tac.turnOf', { n: tac.turn, max: tac.limit }) : T('tac.turn', { n: tac.turn })}</span>`
      + `<span class="chip">${T('s2.op.bandwidth')} <b class="pips">${'▮'.repeat(Math.max(0, s.op.bw))}</b></span>`
      + `<span class="chip ${left ? '' : 'good'}">${left ? T('tac.objLeft', { n: left }) : T('tac.objDone')}</span></div>`
      + `<div class="alert alert-${lvl}"><div class="alert-top"><span>${T('s2.op.alert')}</span><b>${s.op.alert}</b><em>${T(ui.alertStatus(s.op.alert))}</em></div>`
      + `<div class="alert-bar"><i style="width:${s.op.alert}%"></i><u style="left:30%"></u><u style="left:60%"></u></div></div></section>`;
    if (ui.tutorial) h += coachHtml(s, tut);
    // 這次潛入的特殊狀況（大霧、換班……）
    if (tac.event) h += `<section class="tac-event ev-${tac.event}"><em>${T('tac.ev.label')}</em><b>${T('tac.ev.' + tac.event)}</b><span>${T('tac.ev.' + tac.event + '.d')}</span></section>`;
    h += `<section class="panel tac"><div class="tac-stage" style="max-width:calc(62vh * ${tac.w} / ${tac.h})">${mapSvg(s, tut && tut.mark ? tut.mark(tac) : [])}${popHtml(s)}${tipHtml(s)}${guide ? guideHtml(s) : ''}</div>`;
    // 地圖正下方：隊員、撤回、結束回合
    h += `<div class="tac-bar"><div class="tac-squad">${unitsOf(s).map((u, i) => {
      const off = u.out || u.taken;
      const st = u.out ? T('tac.out') : u.taken ? T('tac.taken') : `${'●'.repeat(u.ap)}<u>${'●'.repeat(Math.max(0, E.tactics.AP - u.ap))}</u>`;
      return `<button class="tac-mem${u.id === sel ? ' sel' : ''}${off ? ' off' : ''}" data-act="tacSel" data-id="${u.id}"${off ? ' disabled' : ''} title="${i + 1}">`
        + `<span class="tm-face">${E.faces.of(N.person(s, u.id))}</span><span class="tm-txt"><b>${nm(s, u.id)}</b><small>${st}</small></span></button>`;
    }).join('')}</div><div class="tac-turn">`
      + (tac.undo ? `<button class="ghost" data-act="tacUndo" title="U">↶ ${T('tac.undo')}</button>` : '')
      + `<button class="primary${tut && tut.ui === 'end' ? ' tut-glow' : spent ? ' nudge' : ''}" data-act="tacEnd" title="Space">${T('tac.end')} ⏎</button></div></div>`;
    const u = unitsOf(s).find((x) => x.id === sel);
    if (u) h += cardsHtml(s, u.id);
    h += `<p class="hint tac-hint${aim ? ' aim' : ''}">${T(aim ? 'tac.card.aim' : pop ? (pop.items[0].ab === 'move' ? 'tac.pickMove' : 'tac.pickOne') : spent ? 'tac.noAp' : 'tac.help')}</p>`;
    if (u) {
      h += `<div class="tac-caps"><label>${T('tac.caps', { name: { l: E.people.name(N.person(s, u.id)) } })}</label>${capList(s, u.id).map((c) => `<span class="tcap ${c.cls || ''}">`
        + (c.ab ? `<svg viewBox="-11 -11 22 22" class="tc-ic"><circle r="10" fill="${colorOf(c.ab)}"/>${glyph(c.ab)}</svg>` : '')
        + `${T(c.k, c.v)}${c.src ? `<small>${esc(t('tac.src', { src: c.src }))}</small>` : ''}</span>`).join('')}</div>`;
    }
    h += `<div class="bar-actions">` + (ui.tutorial ? `<button class="ghost" data-act="tutExit">${T('tac.tut.exit')}</button>`
      : `<button class="ghost" data-act="retreat">${T('s2.op.retreat')}</button><button class="ghost" data-act="tutorial">${T('tac.tut.open')}</button>`)
      + `<button class="ghost" data-act="tacGuide">${T('tac.legend')}</button></div></section>`;
    return h;
  }

  // ===== 點擊和鍵盤 =====
  function act(s, a) {
    N.tacUse(s, sel, a.ab, a.x, a.y);
    pop = null;
    aim = null;
  }

  function click(s, d) {
    const k = d.act;
    tip = k === 'tacTile' ? null : tip;
    if (k === 'tacGuide') { guide = !guide; return; }
    if (k === 'tacGuideOk') { guide = false; lsSet(GUIDE_KEY, '1'); return; }
    if (k === 'tacClose') { pop = null; tip = null; return; }
    if (k === 'tacSel') { sel = d.id; pop = null; aim = null; return; }
    if (k === 'tacEnd') { pop = null; aim = null; N.tacEnd(s); sel = null; return; }
    if (k === 'tacUndo') { pop = null; aim = null; N.tacUndo(s); return; }
    if (k === 'tacPick') {
      if (d.ab === 'select') { sel = d.id; pop = null; return; }
      if (d.ab === 'move') { pop = null; N.tacMove(s, sel, Number(d.x), Number(d.y)); return; }
      act(s, { ab: d.ab, x: Number(d.x), y: Number(d.y) });
      return;
    }
    // 招式卡：只有一個目標（通常是自己腳下）就直接用；好幾個目標就讓玩家在地圖上選。
    if (k === 'tacCard') {
      const a = N.tacAbilities(s, sel).find((x) => x.id === d.ab);
      pop = null;
      if (!a) return;
      if (a.targets.length === 1) return act(s, { ab: a.id, x: a.targets[0][0], y: a.targets[0][1] });
      aim = aim === a.id ? null : a.id;
      return;
    }
    if (k !== 'tacTile') return;
    const x = Number(d.x), y = Number(d.y);
    // 選單開著的時候：再點同一格就走過去（逃命的時候不用瞄準選單），點別的地方就關掉。
    if (pop) {
      const again = pop.x === x && pop.y === y && pop.items[0].ab === 'move';
      pop = null;
      if (again) N.tacMove(s, sel, x, y);
      return;
    }
    const here = actionsByTile(s)[x + ',' + y] || [];
    if (aim) {
      // 選目標中：點到可以選的格子就用，點到別的地方就取消。
      if (here.length) act(s, here[0]);
      aim = null;
      return;
    }
    const u = unitAt(s, x, y);
    // 點自己：有偽裝、叫車之類的就打開選單；點別的隊員：換人（除非是要急救他）
    if (u && u.id === sel) { if (here.length) pop = { x, y, items: here }; return; }
    if (u && !here.some((a) => a.ab === 'heal')) { sel = u.id; return; }
    // 隊友身上可以急救：也要能換人，不替玩家決定。
    if (u) { pop = { x, y, items: here.concat([{ ab: 'select', id: u.id, x, y }]) }; return; }
    const walk = !!sel && N.tacReach(s, sel)[x + ',' + y] !== undefined;
    // 走得到又能動手的格子（例如突襲時開著的門、飛過去的無人機）：先問，走路排第一個。
    if (walk && here.length) {
      const seen = N.tacRisky(s, sel).includes(x + ',' + y);
      pop = { x, y, items: [{ ab: 'move', x, y, ap: 1, seen }].concat(here) };
      return;
    }
    // 只有一件事可以做就直接做；聲音傳三格以上、或要把開著的門鎖上（可能是自己的退路），先跳選單，讓玩家看到代價。
    const lock = here.length === 1 && here[0].ab === 'hack' && tileAt(s, x, y) === 'd';
    if (here.length === 1 && here[0].noise < 3 && !lock) return act(s, here[0]);
    if (here.length) { pop = { x, y, items: here }; return; }
    if (walk) { N.tacMove(s, sel, x, y); return; }
    const info = describe(s, x, y);
    if (info) { tip = Object.assign({ x, y }, info); return; }
    // 走不到的地板：說一聲，不要什麼反應都沒有。
    if (sel && '.d'.includes(tileAt(s, x, y))) tip = { x, y, title: 'tac.far.t', k: 'tac.far' };
  }

  // 空白鍵或 Enter：結束回合；Tab：下一個人；數字：選第幾個人；U：撤回；Esc：關掉選單。
  function key(s, ev) {
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return false;
    const k = ev.key;
    if (k === ' ' || k === 'Enter') { pop = null; aim = null; N.tacEnd(s); sel = null; return true; }
    if (k === 'Escape') { pop = null; tip = null; aim = null; guide = false; return true; }
    if (k === 'u' || k === 'U') { N.tacUndo(s); return true; }
    if (k === 'Tab') {
      const list = ready(s);
      if (!list.length) return true;
      const i = list.findIndex((u) => u.id === sel);
      sel = list[(i + 1) % list.length].id;
      pop = null;
      aim = null;
      return true;
    }
    if (/^[1-4]$/.test(k)) {
      const u = unitsOf(s)[Number(k) - 1];
      if (u && !u.out && !u.taken) { sel = u.id; pop = null; aim = null; }
      return true;
    }
    return false;
  }

  E.tacUI = { render, click, key, reset, motion, state: () => ({ sel, pop, tip }) };
})(window.ECHO = window.ECHO || {});
