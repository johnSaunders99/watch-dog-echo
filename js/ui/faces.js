// 第二季路人的頭像：平塗、帶深色描邊的插畫，和戰術地圖的畫風一致。
// 每個人的長相由 id 決定（同一個人永遠長一樣）：膚色和髮色依族裔有所不同，髮型、眼睛、鬍子、耳環隨機；
// 表情來自特質和弱點（樂天會笑、脾氣差會皺眉、容易緊張的人眉頭上揚）；年紀大的人有白髮和皺紋。
// 衣服、帽子和道具由職業決定（建築工人的反光背心和安全帽、護理師的刷手服和聽診器……）。
// 底色代表能力分類；少見的人物銀框、稀有人物金框、第一季的老朋友粉紅框。
// E.faces.of(p) 回傳 100×100 的 SVG 字串；of(p, { round: true }) 是圓形的（戰術地圖上的棋子用）。
(function (E) {
  const OUT = '#0b0f1c'; // 描邊
  const BG = { hacker: '#10283a', physical: '#3a2412', social: '#3a1228', specialist: '#14321f' };
  const GLOW = { hacker: '#2ff3e0', physical: '#ffb347', social: '#ff2e88', specialist: '#5cf29a' };
  const FRAME = { rare: '#ffd23f', uncommon: '#b8c0d4', special: '#ff2e88' };

  // ===== 顏色 =====
  const SKIN = {
    british: ['#f3d5c0', '#ecc4a6', '#f7e0cf', '#dfb08f', '#e9bb97'],
    irish: ['#f6dccb', '#f0cfb8', '#ecc2a5', '#f8e3d4'],
    caribbean: ['#8d5a3b', '#71452b', '#a56c47', '#5c3622', '#7c4c30'],
    west_african: ['#6e4229', '#5a3420', '#83502f', '#4a2a1a'],
    south_asian: ['#c48a5e', '#a8714a', '#d49e72', '#93603d', '#b87d52'],
    hongkong: ['#f1d0aa', '#e6be93', '#f4d8b8', '#dcb184'],
    mainland: ['#efcda6', '#e3bb8f', '#f3d6b3', '#d8ad80'],
  };
  const HAIR_COL = {
    light: ['#2a1d16', '#4a2f1c', '#6e4a2c', '#b98d52', '#d8b26a', '#9c4424', '#1b1b20'],
    dark: ['#141418', '#1f1712', '#2a1d16', '#191514', '#33241a'],
    grey: ['#c9c6be', '#e3e0d8', '#a29e96', '#8f8b84'],
    dyed: ['#ff5fa8', '#5fc8ff', '#9d7bff', '#5cf29a', '#ff8a3d'],
  };
  const EYES_LIGHT = ['#4f7aa6', '#5d8a56', '#7a5a3a', '#4a3424', '#6b8aa0'];
  const EYES_DARK = ['#2a1a10', '#3a2418', '#1e140e', '#4a3020'];

  function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }
  // amt < 0 變暗、> 0 變亮
  function tone(c, amt) {
    const out = hex(c).map((v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt));
    return '#' + out.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  }

  // ===== 衣服、帽子、道具 =====
  // top：衣服的樣式；col：主色；hat：帽子；hatCol：帽子顏色；extra：身上的道具；specs：戴眼鏡（數字是機率）。
  const OUTFIT = {
    programmer: { top: 'hoodie', col: '#2b4a5e', specs: 0.7 },
    it_support: { top: 'polo', col: '#3a5a8a', extra: 'lanyard' },
    streamer: { top: 'hoodie', col: '#5a2a6e', hat: 'headset', hatCol: '#ff2e88' },
    cs_student: { top: 'hoodie', col: '#8a2e3a', extra: 'straps', specs: 0.4 },
    builder: { top: 'hivis', col: '#ff8a1e', hat: 'hardhat', hatCol: '#ffd23f' },
    courier: { top: 'jacket', col: '#1fae9a', hat: 'bikehelmet', hatCol: '#ffd23f', extra: 'bagstrap' },
    removals: { top: 'overalls', col: '#3f5d8a', hat: 'cap', hatCol: '#c0392b' },
    firefighter: { top: 'turnout', col: '#2c2c33', hat: 'firehelmet', hatCol: '#d7263d' },
    trainer: { top: 'sport', col: '#e8453c', hat: 'headband', hatCol: '#f4f1ea', extra: 'whistle' },
    docker: { top: 'hivis', col: '#ffd23f', hat: 'beanie', hatCol: '#2f3b55' },
    lawyer: { top: 'suit', col: '#1f2438', tie: '#8a1f3d' },
    journalist: { top: 'blazer', col: '#6b5a48', extra: 'press' },
    bartender: { top: 'waistcoat', col: '#2a2a33', extra: 'bowtie' },
    salesperson: { top: 'suit', col: '#2f4a7a', tie: '#e8b54a' },
    busker: { top: 'denim', col: '#3f6aa0', extra: 'guitar' },
    actor: { top: 'coat', col: '#5a1f4a', extra: 'scarf' },
    nurse: { top: 'scrubs', col: '#3fa7c9', extra: 'stetho' },
    locksmith: { top: 'workshirt', col: '#5a6a3a', extra: 'keys' },
    cabbie: { top: 'cardigan', col: '#5a4a3a', hat: 'flatcap', hatCol: '#3a3a42' },
    teacher: { top: 'cardigan', col: '#8a5a7a', specs: 0.9 },
    drone_op: { top: 'tactical', col: '#33402c', hat: 'visor', hatCol: '#ff4757' },
    pigeon: { top: 'coat', col: '#4a4a3a', hat: 'flatcap', hatCol: '#5a5040', extra: 'pigeon' },
    cobol: { top: 'sweater', col: '#7a6a3a', specs: 1, extra: 'pen' },
    radio: { top: 'jacket', col: '#2a2a3a', hat: 'headset', hatCol: '#2ff3e0' },
    cleaner: { top: 'overalls', col: '#1f8a6a', hat: 'cap', hatCol: '#1f8a6a', extra: 'keys' },
    parkour: { top: 'hoodie', col: '#e86a2a', hat: 'hood' },
  };

  const BODY = 'M8 100 Q10 76 37 70 L50 77 L63 70 Q90 76 92 100 Z';
  const body = (col) => `<path d="${BODY}" fill="${col}" stroke="${OUT}" stroke-width="1.6"/>`;
  function top(o) {
    const c = o.col, d = tone(c, -0.3), l = tone(c, 0.25);
    switch (o.top) {
      case 'hoodie': return body(c) + `<path d="M35 71 Q50 85 65 71" stroke="${d}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M46 80 l-1 11 M54 80 l1 11" stroke="#e9e4dc" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'polo': return body(c) + `<path d="M39 70 L50 78 L45 84 Z M61 70 L50 78 L55 84 Z" fill="${l}" stroke="${OUT}" stroke-width="1"/><circle cx="50" cy="84" r="1" fill="${OUT}"/><circle cx="50" cy="89" r="1" fill="${OUT}"/>`;
      case 'hivis': return body(c) + `<path d="M40 71 L50 77 L60 71" fill="#2a2f3a"/><path d="M13 90 H87" stroke="#e8eef5" stroke-width="3.5"/><path d="M39 72 V100 M61 72 V100" stroke="#e8eef5" stroke-width="3.5"/><path d="M13 90 H87 M39 72 V100 M61 72 V100" stroke="#9aa6b8" stroke-width="0.8" stroke-dasharray="2 3"/>`;
      case 'jacket': return body(c) + `<path d="M50 77 V100" stroke="${d}" stroke-width="1.6"/><path d="M37 70 L44 82 L50 77 L56 82 L63 70" fill="${l}" stroke="${OUT}" stroke-width="1"/>`;
      case 'overalls': return body('#cfc7b6') + `<path d="M34 84 H66 V100 H34 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/><path d="M39 72 V85 M61 72 V85" stroke="${c}" stroke-width="4.5"/><circle cx="39" cy="85" r="1.6" fill="#ffd23f"/><circle cx="61" cy="85" r="1.6" fill="#ffd23f"/>`;
      case 'turnout': return body(c) + `<path d="M37 70 L42 80 L50 77 L58 80 L63 70" fill="${tone(c, 0.15)}"/><path d="M12 88 H88" stroke="#ffd23f" stroke-width="4"/><path d="M12 88 H88" stroke="#e8eef5" stroke-width="1.2"/><path d="M50 77 V100" stroke="#ffd23f" stroke-width="1.5"/>`;
      case 'sport': return body(c) + `<path d="M24 80 L19 100 M76 80 L81 100" stroke="#f4f1ea" stroke-width="3"/><path d="M40 71 Q50 79 60 71" stroke="${d}" stroke-width="2" fill="none"/>`;
      case 'suit': return body(c) + `<path d="M40 70 L50 92 L60 70 Z" fill="#f4f1ea"/><path d="M48 77 L52 77 L54 91 L50 96 L46 91 Z" fill="${o.tie}" stroke="${OUT}" stroke-width="0.8"/><path d="M39 70 L47 93 L36 82 Z M61 70 L53 93 L64 82 Z" fill="${d}"/>`;
      case 'blazer': return body(c) + `<path d="M40 70 L50 90 L60 70 Z" fill="#d9d4ca"/><path d="M39 70 L47 92 L36 82 Z M61 70 L53 92 L64 82 Z" fill="${d}"/>`;
      case 'waistcoat': return body('#f4f1ea') + `<path d="M22 100 Q24 82 39 72 L50 93 L61 72 Q76 82 78 100 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/><circle cx="50" cy="96" r="1.1" fill="#e8b54a"/>`;
      case 'denim': return body(c) + `<path d="M37 70 L43 80 L50 77 L57 80 L63 70" fill="${l}" stroke="${OUT}" stroke-width="1"/><rect x="28" y="84" width="10" height="7" fill="none" stroke="${d}" stroke-width="1.3"/><rect x="62" y="84" width="10" height="7" fill="none" stroke="${d}" stroke-width="1.3"/><path d="M50 77 V100" stroke="${d}" stroke-width="1.3" stroke-dasharray="2 2"/>`;
      case 'coat': return body(c) + `<path d="M36 70 L42 84 L50 77 L58 84 L64 70" fill="${d}"/><circle cx="46" cy="90" r="1.3" fill="${l}"/><circle cx="54" cy="90" r="1.3" fill="${l}"/>`;
      case 'scrubs': return body(c) + `<path d="M41 70 L50 84 L59 70" fill="${d}"/><rect x="60" y="84" width="10" height="8" fill="${tone(c, -0.15)}"/>`;
      case 'workshirt': return body(c) + `<path d="M39 70 L50 78 L45 83 Z M61 70 L50 78 L55 83 Z" fill="${l}"/><rect x="28" y="83" width="11" height="8" fill="none" stroke="${d}" stroke-width="1.3"/><path d="M50 78 V100" stroke="${d}" stroke-width="1"/>`;
      case 'cardigan': return body(c) + `<path d="M41 70 L50 92 L59 70 Z" fill="#e9e4dc"/><path d="M41 70 L50 92 M59 70 L50 92" stroke="${d}" stroke-width="2"/><circle cx="47" cy="86" r="1.2" fill="${l}"/><circle cx="53" cy="86" r="1.2" fill="${l}"/>`;
      case 'tactical': return body(c) + `<rect x="34" y="82" width="32" height="16" rx="2" fill="${d}" stroke="${OUT}" stroke-width="1"/><rect x="37" y="85" width="7" height="6" fill="${l}"/><rect x="46.5" y="85" width="7" height="6" fill="${l}"/><rect x="56" y="85" width="7" height="6" fill="${l}"/>`;
      case 'sweater': return body(c) + `<path d="M40 71 L50 78 L60 71" fill="#e9e4dc" stroke="${OUT}" stroke-width="0.8"/><path d="M38 71 Q50 82 62 71" stroke="${d}" stroke-width="2.5" fill="none"/><path d="M16 94 H84" stroke="${d}" stroke-width="1" stroke-dasharray="2 2"/>`;
      default: return body(c);
    }
  }

  function extra(o) {
    switch (o.extra) {
      case 'lanyard': return `<path d="M42 72 L50 89 L58 72" stroke="#2ff3e0" stroke-width="1.5" fill="none"/><rect x="45" y="88" width="10" height="8" rx="1" fill="#f4f1ea" stroke="${OUT}" stroke-width="0.8"/><rect x="47" y="90" width="3" height="3" fill="#2f6aa0"/>`;
      case 'straps': return `<path d="M30 77 L29 100 M70 77 L71 100" stroke="#24262e" stroke-width="5"/>`;
      case 'bagstrap': return `<path d="M28 74 L72 100" stroke="#ffd23f" stroke-width="5"/><path d="M28 74 L72 100" stroke="${OUT}" stroke-width="0.8" opacity="0.5"/>`;
      case 'whistle': return `<path d="M43 72 Q50 86 57 72" stroke="#f4f1ea" stroke-width="1" fill="none"/><rect x="47" y="83" width="6" height="4" rx="1.5" fill="#c8cfdf" stroke="${OUT}" stroke-width="0.6"/>`;
      case 'press': return `<rect x="58" y="83" width="18" height="9" rx="1" fill="#f4f1ea" stroke="${OUT}" stroke-width="0.8"/><text x="67" y="89.6" font-size="5.5" font-weight="700" font-family="monospace" text-anchor="middle" fill="${OUT}">PRESS</text>`;
      case 'bowtie': return `<path d="M44 72 L50 75 L44 78 Z M56 72 L50 75 L56 78 Z" fill="#c0392b" stroke="${OUT}" stroke-width="0.6"/>`;
      case 'guitar': return `<path d="M10 100 L31 62" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/><path d="M10 100 L31 62" stroke="#c89a5a" stroke-width="1"/><rect x="27" y="54" width="9" height="8" rx="1" fill="#3a2414" transform="rotate(-28 31 58)"/>`;
      case 'scarf': return `<path d="M35 71 Q50 81 65 71" stroke="#ffd23f" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M58 76 L62 96" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/><path d="M58 76 L62 96" stroke="#c89a1a" stroke-width="1" stroke-dasharray="2 2"/>`;
      case 'stetho': return `<path d="M40 72 Q37 88 47 90 Q57 92 60 72" stroke="#cfd6e0" stroke-width="2" fill="none"/><circle cx="47" cy="90" r="3" fill="#cfd6e0" stroke="${OUT}" stroke-width="0.8"/>`;
      case 'keys': return `<circle cx="66" cy="88" r="4" fill="none" stroke="#e8b54a" stroke-width="2"/><path d="M66 92 v7 M66 96 h3 M63 91 l-4 6" stroke="#e8b54a" stroke-width="2"/>`;
      case 'pigeon': return `<g transform="translate(77 69)"><ellipse rx="10" ry="6.5" fill="#9aa3b5" stroke="${OUT}" stroke-width="1"/><path d="M-9 -1 l-6 -2 l2 4 Z" fill="#7a8396"/><circle cx="7" cy="-7" r="4.5" fill="#9aa3b5" stroke="${OUT}" stroke-width="1"/><path d="M5 -4 q2 2 5 0" stroke="#5cb88a" stroke-width="1.5" fill="none"/><circle cx="8" cy="-8" r="0.9" fill="${OUT}"/><path d="M11.5 -7 l3 1 l-3 1 Z" fill="#ffb347"/></g>`;
      case 'pen': return `<path d="M64 82 V90 M67 82 V89" stroke="#2f6aa0" stroke-width="1.6"/><rect x="61" y="84" width="9" height="7" fill="none" stroke="${tone(o.col, -0.3)}" stroke-width="1"/>`;
      default: return '';
    }
  }

  // ===== 髮型 =====
  // back：畫在頭後面（長髮、鮑伯頭、爆炸頭、辮子）；front：畫在頭上面（瀏海、頭頂）。
  const HAIR = {
    crop: { front: (c) => `<path d="M33.5 40 Q32 20 50 20 Q68 20 66.5 40 Q65 28 50 27.5 Q35 28 33.5 40 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>` },
    side: { front: (c) => `<path d="M33 42 Q31 19 52 19 Q70 20 67.5 39 Q62 27 45 31 Q38 34 33 42 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>` },
    curly: { front: (c) => [[36, 31, 5], [40, 25, 5.5], [46, 21.5, 5.5], [52, 20.5, 5.5], [58, 22.5, 5.5], [63.5, 27, 5], [66, 33, 4], [34, 36, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${OUT}" stroke-width="1"/>`).join('') },
    afro: {
      back: (c) => `<circle cx="50" cy="35" r="25" fill="${c}" stroke="${OUT}" stroke-width="1.4"/>`,
      front: (c) => `<path d="M34 38 Q36 26 50 25 Q64 26 66 38 Q60 31 50 31 Q40 31 34 38 Z" fill="${tone(c, 0.12)}"/>`,
    },
    locs: {
      back: (c) => [30, 35, 40, 60, 65, 70].map((x, i) => `<path d="M${x + (i < 3 ? 4 : -4)} 30 Q${x} 55 ${x + (i < 3 ? -2 : 2)} 76" stroke="${c}" stroke-width="5.5" fill="none" stroke-linecap="round"/>`).join(''),
      front: (c) => `<path d="M33.5 40 Q32 20 50 20 Q68 20 66.5 40 Q65 28 50 27.5 Q35 28 33.5 40 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/><path d="M38 24 v8 M44 21.5 v8 M50 21 v8 M56 21.5 v8 M62 24 v8" stroke="${tone(c, -0.35)}" stroke-width="1.2"/>`,
    },
    bob: {
      back: (c) => `<path d="M31 46 Q29 17 50 17 Q71 17 69 46 L70 62 Q60 59 50 59 Q40 59 30 62 Z" fill="${c}" stroke="${OUT}" stroke-width="1.3"/>`,
      front: (c) => `<path d="M33 39 Q33 20 50 20 Q67 20 67 39 L64 32 Q50 29 36 32 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>`,
    },
    long: {
      back: (c) => `<path d="M31 44 Q28 16 50 16 Q72 16 69 44 L73 82 Q62 86 50 84 Q38 86 27 82 Z" fill="${c}" stroke="${OUT}" stroke-width="1.3"/>`,
      front: (c) => `<path d="M33 42 Q31 19 52 19 Q70 20 67.5 39 Q62 27 45 31 Q38 34 33 42 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>`,
    },
    ponytail: {
      back: (c) => `<path d="M64 30 Q80 38 74 64" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M64 30 Q80 38 74 64" stroke="${OUT}" stroke-width="1" fill="none" opacity="0.4"/>`,
      front: (c) => `<path d="M33.5 40 Q32 20 50 20 Q68 20 66.5 40 Q62 28 50 28 Q38 28 33.5 40 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>`,
    },
    bun: {
      back: (c) => `<circle cx="50" cy="15" r="8" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>`,
      front: (c) => `<path d="M33.5 40 Q32 20 50 20 Q68 20 66.5 40 Q62 28 50 28 Q38 28 33.5 40 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>`,
    },
    braids: {
      front: (c) => `<path d="M33.5 40 Q32 20 50 20 Q68 20 66.5 40 Q65 28 50 27.5 Q35 28 33.5 40 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/><path d="M40 36 Q42 26 44 21 M46 33 Q47 25 48 20.5 M52 33 Q53 25 54 20.5 M58 35 Q59 27 60 22" stroke="${tone(c, 0.3)}" stroke-width="1" fill="none"/>`,
    },
    mohawk: { front: (c) => `<path d="M46 34 Q44 14 50 8 Q56 14 54 34 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>` },
    bald: { front: (c) => `<path d="M34 42 Q33 35 36 32 M66 42 Q67 35 64 32" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
  };
  const HATLESS = ['afro', 'bun', 'mohawk']; // 戴帽子時改成短髮

  // 頭頂的帽子和戴在頭上的東西。
  function hat(o) {
    const c = o.hatCol, d = tone(c || '#888888', -0.3);
    switch (o.hat) {
      case 'hardhat': return `<path d="M31 33 Q31 13 50 13 Q69 13 69 33 Z" fill="${c}" stroke="${OUT}" stroke-width="1.5"/><path d="M50 13 V31" stroke="${d}" stroke-width="2.5"/><rect x="25" y="31" width="50" height="5" rx="2" fill="${c}" stroke="${OUT}" stroke-width="1.3"/>`;
      case 'firehelmet': return `<path d="M30 34 Q30 12 50 12 Q70 12 70 34 Z" fill="${c}" stroke="${OUT}" stroke-width="1.5"/><path d="M24 33 Q50 28 76 33 L78 38 Q50 33 22 38 Z" fill="${d}" stroke="${OUT}" stroke-width="1.2"/><path d="M45 17 h10 v9 l-5 3 l-5 -3 Z" fill="#ffd23f" stroke="${OUT}" stroke-width="0.8"/>`;
      case 'bikehelmet': return `<path d="M31 36 Q32 14 50 14 Q68 14 69 36 Z" fill="${c}" stroke="${OUT}" stroke-width="1.5"/><path d="M39 18 l3 10 M50 15 v12 M61 18 l-3 10" stroke="${OUT}" stroke-width="2.2" opacity="0.7"/><path d="M33 38 L36 52 M67 38 L64 52" stroke="${OUT}" stroke-width="1.3"/>`;
      case 'cap': return `<path d="M32 33 Q33 17 50 17 Q67 17 68 33 Z" fill="${c}" stroke="${OUT}" stroke-width="1.4"/><path d="M32 33 Q52 29 77 34 L75 38 Q52 34 32 36.5 Z" fill="${d}" stroke="${OUT}" stroke-width="1.2"/><circle cx="50" cy="17.5" r="1.6" fill="${d}"/>`;
      case 'beanie': return `<path d="M32 34 Q32 13 50 13 Q68 13 68 34 Z" fill="${c}" stroke="${OUT}" stroke-width="1.4"/><rect x="30.5" y="30" width="39" height="7" rx="2" fill="${tone(c, 0.15)}" stroke="${OUT}" stroke-width="1.2"/><path d="M36 30 v7 M42 30 v7 M48 30 v7 M54 30 v7 M60 30 v7 M66 30 v7" stroke="${d}" stroke-width="0.8"/>`;
      case 'flatcap': return `<path d="M31 33 Q32 19 52 19 Q70 21 72 32 Q52 29 31 35 Z" fill="${c}" stroke="${OUT}" stroke-width="1.4"/><path d="M60 31 Q70 30 74 33 L72 35.5 Q64 33 58 34 Z" fill="${d}"/>`;
      case 'headband': return `<path d="M33 31 Q50 25 67 31 L67 35 Q50 29 33 35 Z" fill="${c}" stroke="${OUT}" stroke-width="1"/>`;
      case 'headset': return `<path d="M30 44 Q29 16 50 16 Q71 16 70 44" stroke="${OUT}" stroke-width="5.5" fill="none"/><path d="M30 44 Q29 16 50 16 Q71 16 70 44" stroke="${c}" stroke-width="3" fill="none"/><rect x="26" y="38" width="9" height="14" rx="3.5" fill="${c}" stroke="${OUT}" stroke-width="1.3"/><rect x="65" y="38" width="9" height="14" rx="3.5" fill="${c}" stroke="${OUT}" stroke-width="1.3"/><path d="M31 50 Q34 58 44 57" stroke="${OUT}" stroke-width="2" fill="none"/><circle cx="44.5" cy="57" r="2" fill="${c}" stroke="${OUT}" stroke-width="0.8"/>`;
      case 'hood': return `<path d="M27 64 Q22 12 50 11 Q78 12 73 64 Q69 32 50 30 Q31 32 27 64 Z" fill="${o.col}" stroke="${OUT}" stroke-width="1.5"/><path d="M30 60 Q28 34 50 32 Q72 34 70 60" stroke="${tone(o.col, -0.35)}" stroke-width="2" fill="none"/>`;
      case 'visor': return `<rect x="32" y="37" width="36" height="10" rx="4.5" fill="${c}" opacity="0.85" stroke="${OUT}" stroke-width="1.3"/><path d="M36 40 h10" stroke="#fff" stroke-width="1.4" opacity="0.7"/>`;
      default: return '';
    }
  }

  // ===== 臉 =====
  // 表情：特質和弱點決定，其他人隨機。
  function moodOf(p, r) {
    if (p.flaw === 'hothead') return 'cross';
    if (p.flaw === 'nervous') return 'worried';
    if (p.traits.includes('cheerful')) return 'grin';
    if (p.traits.includes('silver')) return 'smirk';
    if (p.traits.includes('calm') || p.traits.includes('careful')) return 'calm';
    return r.pick(['smile', 'neutral', 'smile', 'calm', 'smirk']);
  }
  const BROWS = {
    cross: 'M39 37 L47 39.5 M61 37 L53 39.5',
    worried: 'M39 38.5 L47 36 M61 38.5 L53 36',
    smirk: 'M39 37 Q43 35 47 37 M53 36 Q57 33.5 61 35.5',
    def: 'M39 37.5 Q43 35.5 47 37.5 M53 37.5 Q57 35.5 61 37.5',
  };
  function mouth(m) {
    switch (m) {
      case 'grin': return `<path d="M43 52.5 Q50 61 57 52.5 Z" fill="#5a1a22" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/><path d="M44.5 53.3 Q50 55.5 55.5 53.3 L55 54.6 Q50 56.4 45 54.6 Z" fill="#fff"/>`;
      case 'smile': return `<path d="M44.5 53.5 Q50 58 55.5 53.5" stroke="${OUT}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      case 'smirk': return `<path d="M45 55 Q51 56.5 56 52.5" stroke="${OUT}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      case 'cross': return `<path d="M45 56 Q50 53 55 56" stroke="${OUT}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
      case 'worried': return `<ellipse cx="50" cy="55.5" rx="3" ry="2.2" fill="#5a1a22" stroke="${OUT}" stroke-width="1.1"/>`;
      case 'calm': return `<path d="M46 54.5 Q50 56.5 54 54.5" stroke="${OUT}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
      default: return `<path d="M45.5 55 H54.5" stroke="${OUT}" stroke-width="1.5" stroke-linecap="round"/>`;
    }
  }
  function eyes(m, iris) {
    let g = '';
    for (const x of [43.5, 56.5]) {
      g += `<ellipse cx="${x}" cy="43" rx="3.4" ry="${m === 'worried' ? 3 : 2.6}" fill="#fbf8f2" stroke="${OUT}" stroke-width="0.9"/>`
        + `<circle cx="${x + (m === 'smirk' ? 0.6 : 0)}" cy="43.2" r="1.9" fill="${iris}"/><circle cx="${x + (m === 'smirk' ? 0.6 : 0)}" cy="43.2" r="0.9" fill="${OUT}"/><circle cx="${x + 0.7}" cy="42.4" r="0.55" fill="#fff"/>`;
    }
    return g;
  }

  function beard(kind, c) {
    if (kind === 'stubble') return `<path d="M35 50 Q37 63 50 64 Q63 63 65 50 Q62 58 50 59 Q38 58 35 50 Z" fill="${c}" opacity="0.35"/>`;
    if (kind === 'moustache') return `<path d="M43 51 Q50 48 57 51 Q54 53.5 50 52 Q46 53.5 43 51 Z" fill="${c}" stroke="${OUT}" stroke-width="0.8"/>`;
    if (kind === 'beard') return `<path d="M34 47 Q35 66 50 67 Q65 66 66 47 Q63 55 57 56 Q50 52.5 43 56 Q37 55 34 47 Z" fill="${c}" stroke="${OUT}" stroke-width="1"/>`;
    return '';
  }

  // ===== 整張頭像 =====
  const cache = {};
  function of(p, opt = {}) {
    const ck = p.id + '|' + p.occupation + (opt.round ? '|r' : '');
    if (cache[ck]) return cache[ck];
    const r = E.rng.derive('face2', p.id);
    const job = E.people.occupationOf(p);
    const o = OUTFIT[job.id] || { top: 'tee', col: '#4a5a7a' };
    const light = p.heritage === 'british' || p.heritage === 'irish';
    // 膚色：大致依族裔，但倫敦人什麼樣子都有。
    const pal = r.chance(0.08) ? SKIN[r.pick(Object.keys(SKIN))] : SKIN[p.heritage] || SKIN.british;
    const skin = r.pick(pal);
    const skinD = tone(skin, -0.2);
    const skinL = tone(skin, 0.18);
    // 髮色：年紀大的白髮，年輕人偶爾染色。
    let hairC = r.pick(light ? HAIR_COL.light : HAIR_COL.dark);
    if (p.age >= 60 || (p.age >= 50 && r.chance(0.4))) hairC = r.pick(HAIR_COL.grey);
    else if (p.age < 30 && r.chance(0.14)) hairC = r.pick(HAIR_COL.dyed);
    const iris = light ? r.pick(EYES_LIGHT) : r.pick(EYES_DARK);
    // 髮型：大致依族裔和年紀，加上隨機。
    const curlish = ['caribbean', 'west_african'].includes(p.heritage);
    const styles = { crop: 3, side: 3, curly: curlish ? 2 : 1, afro: curlish ? 3 : 0.3, locs: curlish ? 2 : 0.2, braids: curlish ? 2 : 0.2,
      bob: 2, long: 2.5, ponytail: 2, bun: 1.5, mohawk: p.age < 30 ? 0.6 : 0, bald: p.age >= 45 ? 2 : 0.3 };
    let style = r.weighted(styles);
    if (o.hat && HATLESS.includes(style)) style = 'crop';
    if (o.hat === 'hood') style = 'crop';
    const mood = moodOf(p, r);
    const sleepy = p.traits.includes('nightowl');
    const beardKind = p.age >= 18 && r.chance(0.28) ? r.pick(['stubble', 'stubble', 'moustache', 'beard']) : null;
    const earring = r.chance(0.18);
    const specs = (o.specs && r.chance(o.specs)) || p.age >= 66 || r.chance(0.08);
    const freckles = light && r.chance(0.25);

    let g = '';
    // 背景：分類的底色、身後一圈光
    g += `<rect width="100" height="100" fill="${BG[job.category]}"/><circle cx="50" cy="44" r="36" fill="${GLOW[job.category]}" opacity="0.13"/>`
      + `<path d="M0 82 L100 62 L100 100 L0 100 Z" fill="#000" opacity="0.18"/>`;
    const H = HAIR[style];
    if (H.back) g += H.back(hairC);
    // 脖子、衣服
    g += `<path d="M43 56 L43 73 Q50 78 57 73 L57 56 Z" fill="${skinD}" stroke="${OUT}" stroke-width="1.2"/>`;
    g += top(o) + extra(o);
    // 頭：耳朵、臉、陰影、腮紅
    g += `<ellipse cx="33.5" cy="45" rx="3.6" ry="5.2" fill="${skin}" stroke="${OUT}" stroke-width="1.2"/><ellipse cx="66.5" cy="45" rx="3.6" ry="5.2" fill="${skin}" stroke="${OUT}" stroke-width="1.2"/>`
      + `<ellipse cx="50" cy="42" rx="16.5" ry="19.5" fill="${skin}" stroke="${OUT}" stroke-width="1.6"/>`
      + `<path d="M56 24 Q67 30 66.4 44 Q65.6 58 52 61.3 Q61.5 53 61.8 42 Q62 31 56 24 Z" fill="${skinD}" opacity="0.45"/>`
      + `<ellipse cx="44" cy="30" rx="5" ry="3" fill="${skinL}" opacity="0.45"/>`
      + `<circle cx="40" cy="50" r="3.2" fill="#ff6f6f" opacity="${mood === 'grin' ? 0.3 : 0.16}"/><circle cx="60" cy="50" r="3.2" fill="#ff6f6f" opacity="${mood === 'grin' ? 0.3 : 0.16}"/>`;
    if (earring) g += `<circle cx="33.5" cy="51.5" r="1.6" fill="#ffd23f" stroke="${OUT}" stroke-width="0.6"/><circle cx="66.5" cy="51.5" r="1.6" fill="#ffd23f" stroke="${OUT}" stroke-width="0.6"/>`;
    if (freckles) g += [[40, 47], [42.5, 48.5], [38.5, 49], [60, 47], [57.5, 48.5], [61.5, 49]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.55" fill="${skinD}"/>`).join('');
    // 皺紋
    if (p.age >= 55) g += `<path d="M42 31 Q50 29.5 58 31 M43.5 33.5 Q50 32.3 56.5 33.5" stroke="${skinD}" stroke-width="0.9" fill="none"/><path d="M38.5 47 Q40 51 42.5 52 M61.5 47 Q60 51 57.5 52" stroke="${skinD}" stroke-width="0.8" fill="none"/>`;
    // 五官
    g += eyes(mood, iris);
    if (sleepy) g += `<path d="M40 41.6 Q43.5 40.4 47 41.6 M53 41.6 Q56.5 40.4 60 41.6" stroke="${OUT}" stroke-width="1.4" fill="none"/>`;
    g += `<path d="${BROWS[mood] || BROWS.def}" stroke="${tone(hairC, -0.25)}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M50.5 45 Q48.5 50.5 51.5 51" stroke="${skinD}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    g += beard(beardKind, hairC);
    g += mouth(mood);
    // 頭髮、眼鏡、帽子
    g += H.front(hairC);
    if (specs) g += `<g fill="none" stroke="${OUT}" stroke-width="1.6"><rect x="38" y="39.5" width="11" height="8" rx="2.5"/><rect x="51" y="39.5" width="11" height="8" rx="2.5"/><path d="M49 42.5 h2 M38 42 L34.5 41 M62 42 L65.5 41"/></g><path d="M40 41.5 l3 -1" stroke="#fff" stroke-width="1" opacity="0.6"/>`;
    g += hat(o);
    // 稀有度的框
    const tier = E.people.tierOf(p);
    const fc = FRAME[tier];
    let svg;
    if (opt.round) {
      const cid = 'fc-' + String(p.id).replace(/[^\w-]/g, '_');
      svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${cid}"><circle cx="50" cy="50" r="50"/></clipPath></defs>`
        + `<g clip-path="url(#${cid})">${g}</g>${fc ? `<circle cx="50" cy="50" r="47" fill="none" stroke="${fc}" stroke-width="6"/>` : ''}</svg>`;
    } else {
      let frame = '';
      if (tier === 'rare') frame = `<rect x="2" y="2" width="96" height="96" fill="none" stroke="${fc}" stroke-width="4"/><rect x="6" y="6" width="88" height="88" fill="none" stroke="${fc}" stroke-width="1" opacity="0.6"/><path d="M88 6 l2.5 5 l5 .7 l-3.6 3.4 l.9 5 l-4.8 -2.5 l-4.8 2.5 l.9 -5 l-3.6 -3.4 l5 -.7 Z" fill="${fc}" stroke="${OUT}" stroke-width="0.8"/>`;
      else if (tier === 'uncommon') frame = `<rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke="${fc}" stroke-width="2.5"/>`;
      else if (tier === 'special') frame = `<rect x="2" y="2" width="96" height="96" fill="none" stroke="${fc}" stroke-width="4"/>`;
      svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${g}${frame}</svg>`;
    }
    cache[ck] = svg;
    return svg;
  }

  E.faces = { of };
})(window.ECHO = window.ECHO || {});
