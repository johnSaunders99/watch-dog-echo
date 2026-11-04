// 場景插畫與人物頭像：全部用程式繪製的 SVG，不需要任何外部圖片。
// 風格參考《自由軍團》的模版噴漆海報：深藍底、剪影、少量霓虹重點色。
// 記憶場景共用同一批插畫，由 CSS 濾鏡轉成 Animus 式的藍白重建畫面。
(function (E) {
  const C = {
    ink: '#07090e', night: '#0d1220', navy: '#141b2d', slate: '#1d2539', steel: '#2a3350', fog: '#46506b',
    pink: '#ff2e88', cyan: '#2ff3e0', yellow: '#ffd23f', lamp: '#ffb347', red: '#ff4757', green: '#5cf29a',
    white: '#f4f1ea', brick: '#2e1c1f', brick2: '#3d2428', jade: '#1f8a6a', gold: '#e8b54a',
  };

  // 可重現的亂數，讓每次畫出來的窗戶、雨絲都一樣。
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const svg = (id, body, defs = '') => `<svg class="scene scene-${id}" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;

  const sky = (id, top, bottom) => `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;

  const glow = (id, color) => `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${color}" stop-opacity="0.75"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

  function windows(x, y, cols, rows, w, h, gap, lit, seed, color) {
    const r = rng(seed);
    let out = '';
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const on = r() < lit;
        out += `<rect x="${x + i * (w + gap)}" y="${y + j * (h + gap)}" width="${w}" height="${h}" fill="${on ? color : C.steel}" opacity="${on ? 0.55 + r() * 0.45 : 0.5}"/>`;
      }
    }
    return out;
  }

  function rain(seed, count = 90, color = '#9fb4d8') {
    const r = rng(seed);
    let out = '';
    for (let i = 0; i < count; i++) {
      const x = r() * 860 - 30, y = r() * 450, len = 14 + r() * 22;
      out += `<line x1="${x}" y1="${y}" x2="${x - 5}" y2="${y + len}"/>`;
    }
    return `<g class="rain" stroke="${color}" stroke-width="1" opacity="0.35">${out}</g><g class="rain rain-b" stroke="${color}" stroke-width="1" opacity="0.25">${out}</g>`;
  }

  function bricks(id, a, b) {
    return `<pattern id="${id}" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="${a}"/><path d="M0 0H40M0 10H40M10 0V10M30 10V20" stroke="${b}" stroke-width="1.5"/></pattern>`;
  }

  // 人物剪影。opt：hood、helmet、cap、hat、umbrella、hair（afro / bob / bun）、color、glow（手機光）
  function person(x, y, s, opt = {}) {
    const col = opt.color || C.ink;
    let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
    if (opt.umbrella) g += `<path d="M-46 -112 Q0 -160 46 -112 Z" fill="${C.ink}"/><line x1="0" y1="-112" x2="0" y2="-40" stroke="${C.ink}" stroke-width="3"/>`;
    g += `<path d="M-26 0 L-22 -58 Q0 -72 22 -58 L26 0 Z" fill="${col}"/>`;
    g += `<circle cx="0" cy="-82" r="15" fill="${col}"/>`;
    if (opt.hair === 'afro') g += `<circle cx="0" cy="-90" r="20" fill="${col}"/><circle cx="-10" cy="-100" r="11" fill="${col}"/><circle cx="12" cy="-101" r="11" fill="${col}"/>`;
    if (opt.hair === 'bob') g += `<path d="M-17 -80 Q-18 -104 0 -104 Q18 -104 17 -80 L17 -70 L-17 -70 Z" fill="${col}"/>`;
    if (opt.hair === 'bun') g += `<circle cx="0" cy="-100" r="8" fill="${col}"/>`;
    if (opt.hood) g += `<path d="M-22 -60 Q-26 -104 0 -106 Q26 -104 22 -60 Q12 -74 0 -74 Q-12 -74 -22 -60 Z" fill="${col}"/>`;
    if (opt.helmet) g += `<path d="M-18 -84 Q-18 -104 0 -104 Q18 -104 18 -84 Z" fill="${C.yellow}"/><rect x="-18" y="-86" width="36" height="5" fill="${C.ink}"/>`;
    if (opt.cap) g += `<path d="M-15 -90 Q0 -102 15 -90 L24 -88 L-15 -86 Z" fill="${C.steel}"/>`;
    if (opt.hat) g += `<rect x="-20" y="-96" width="40" height="5" fill="${col}"/><rect x="-12" y="-110" width="24" height="16" fill="${col}"/>`;
    if (opt.glow) g += `<circle cx="10" cy="-40" r="14" fill="url(#phoneglow)"/><rect x="6" y="-46" width="8" height="12" rx="1.5" fill="${C.cyan}"/>`;
    return g + '</g>';
  }

  const phoneglowDef = glow('phoneglow', C.cyan);

  // DedSec 風格的面具塗鴉。
  function dedsecMask(x, y, s, color) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round">
      <path d="M-40 -30 Q0 -62 40 -30 Q48 10 30 36 Q0 56 -30 36 Q-48 10 -40 -30 Z" fill="${color}" fill-opacity="0.12"/>
      <path d="M-24 -6 L-8 6 M-8 -6 L-24 6"/><path d="M8 -6 L24 6 M24 -6 L8 6"/>
      <path d="M-18 24 Q0 36 18 24"/><path d="M-12 26 L-12 32 M0 29 L0 35 M12 26 L12 32" stroke-width="3"/></g>`;
  }

  function cctv(x, y, flip) {
    return `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)"><rect x="0" y="-4" width="6" height="16" fill="${C.steel}"/><rect x="-26" y="8" width="34" height="14" rx="2" fill="${C.fog}"/><circle class="blink" cx="-20" cy="15" r="2.5" fill="${C.red}"/></g>`;
  }

  function bike(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${C.ink}" stroke-width="5"><circle cx="-30" cy="0" r="16"/><circle cx="34" cy="0" r="16"/><path d="M-30 0 L-4 -22 L26 -22 L34 0 M-4 -22 L-10 -38 L4 -40"/><rect x="-46" y="-50" width="30" height="24" fill="${C.yellow}" stroke="none"/></g>`;
  }

  const scenes = {
    // 康登區地下室：海盜電台、DedSec 面具塗鴉、舊筆電的光。
    basement: () => svg('basement', `
      <rect width="800" height="450" fill="url(#bm-brick)"/>
      <rect width="800" height="450" fill="${C.night}" opacity="0.55"/>
      ${dedsecMask(560, 150, 1.5, C.pink)}
      <text x="470" y="250" fill="${C.pink}" font-family="Impact, sans-serif" font-size="34" letter-spacing="4" opacity="0.85" transform="rotate(-4 560 240)">DEDSEC</text>
      <text x="456" y="300" fill="${C.white}" font-family="sans-serif" font-size="14" opacity="0.6" transform="rotate(-3 540 300)">NEVER TRUST A MACHINE THAT TALKS</text>
      <line x1="200" y1="0" x2="200" y2="70" stroke="${C.ink}" stroke-width="2"/><circle class="flicker" cx="200" cy="78" r="9" fill="${C.lamp}"/><circle class="flicker" cx="200" cy="78" r="90" fill="url(#bm-bulb)"/>
      <rect x="0" y="330" width="800" height="120" fill="${C.ink}"/>
      <rect x="90" y="300" width="300" height="34" fill="${C.slate}"/>
      <g fill="${C.fog}">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${104 + i * 34}" y="308" width="6" height="18"/>`).join('')}</g>
      <path d="M430 330 L450 270 L540 270 L560 330 Z" fill="${C.steel}"/><rect x="452" y="276" width="84" height="48" fill="${C.cyan}" opacity="0.8" class="screen"/>
      <circle cx="494" cy="300" r="70" fill="url(#bm-screen)"/>
      <rect x="640" y="250" width="22" height="70" rx="4" fill="${C.ink}"/><rect x="645" y="258" width="12" height="10" fill="${C.green}" class="blink"/><line x1="652" y1="250" x2="652" y2="226" stroke="${C.ink}" stroke-width="3"/>
      ${cctv(760, 20, true)}`,
      bricks('bm-brick', C.brick, C.ink) + glow('bm-bulb', C.lamp) + glow('bm-screen', C.cyan)),

    // 狗島：靜域大樓、雨夜後巷、排水溝蓋。
    alley: () => svg('alley', `
      <rect width="800" height="450" fill="url(#al-sky)"/>
      <rect x="330" y="40" width="200" height="410" fill="${C.slate}"/>${windows(342, 54, 9, 18, 14, 14, 7, 0.75, 7, '#cfe8ff')}
      <path d="M330 40 L430 0 L530 40 Z" fill="${C.steel}"/>
      <text x="430" y="32" text-anchor="middle" fill="${C.cyan}" font-family="sans-serif" font-size="12" letter-spacing="5">STILLWATER</text>
      <rect x="0" y="0" width="250" height="450" fill="url(#al-brick)"/><rect x="0" y="0" width="250" height="450" fill="${C.ink}" opacity="0.55"/>
      <rect x="610" y="0" width="190" height="450" fill="url(#al-brick)"/><rect x="610" y="0" width="190" height="450" fill="${C.ink}" opacity="0.6"/>
      <path d="M250 450 L330 300 L530 300 L610 450 Z" fill="${C.navy}"/>
      <ellipse cx="430" cy="410" rx="120" ry="12" fill="#cfe8ff" opacity="0.12"/>
      <ellipse cx="350" cy="400" rx="40" ry="10" fill="${C.ink}" stroke="${C.fog}" stroke-width="3"/>
      <rect x="150" y="320" width="80" height="70" fill="${C.jade}" opacity="0.6"/>
      ${cctv(600, 120, true)}
      ${person(200, 420, 1.1, { hair: 'afro', color: C.ink })}
      ${rain(11)}`,
      sky('al', '#0b1424', '#1f2c48') + bricks('al-brick', C.brick, C.ink)),

    // 裝卸區：半開的鐵捲門、警衛亭、外送機車。
    dock: () => svg('dock', `
      <rect width="800" height="450" fill="${C.navy}"/>
      <rect x="120" y="60" width="420" height="300" fill="${C.slate}"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<rect x="140" y="${80 + i * 14}" width="380" height="9" fill="${C.fog}"/>`).join('')}
      <rect x="140" y="222" width="380" height="138" fill="${C.ink}"/><rect x="140" y="222" width="380" height="138" fill="url(#dk-light)"/>
      <rect x="590" y="190" width="150" height="170" fill="${C.steel}"/><rect x="606" y="210" width="118" height="70" fill="#0c1a22"/>
      <rect x="618" y="222" width="44" height="28" fill="${C.cyan}" opacity="0.7" class="screen"/><rect x="666" y="222" width="44" height="28" fill="${C.cyan}" opacity="0.4"/>
      ${person(660, 300, 0.7, { cap: true, color: C.ink, glow: true })}
      <rect x="0" y="360" width="800" height="90" fill="${C.ink}"/>
      <path d="M0 360 H800" stroke="${C.yellow}" stroke-width="4" stroke-dasharray="24 16"/>
      ${bike(420, 390, 1.1)}${person(470, 392, 0.9, { helmet: true, color: C.ink })}
      ${person(80, 420, 1.05, { hair: 'afro', color: C.ink })}
      ${rain(23, 50)}`,
      `<linearGradient id="dk-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.yellow}" stop-opacity="0.45"/><stop offset="1" stop-color="${C.yellow}" stop-opacity="0"/></linearGradient>` + phoneglowDef),

    // 靜室：一排機櫃，中間是 ECHO-7。
    server: () => {
      const r = rng(5);
      let racks = '';
      for (let i = 0; i < 7; i++) {
        const x = 60 + i * 100, main = i === 3;
        racks += `<rect x="${x}" y="80" width="80" height="300" fill="${main ? C.steel : C.slate}" stroke="${main ? C.cyan : 'none'}" stroke-width="2"/>`;
        for (let j = 0; j < 16; j++) racks += `<rect x="${x + 10}" y="${96 + j * 17}" width="${30 + r() * 30}" height="3" fill="${r() < 0.5 ? C.cyan : '#4a7bff'}" opacity="${0.4 + r() * 0.6}" class="${r() < 0.2 ? 'blink' : ''}"/>`;
      }
      return svg('server', `
        <rect width="800" height="450" fill="${C.night}"/>${racks}
        <text x="400" y="72" text-anchor="middle" fill="${C.cyan}" font-family="monospace" font-size="16" letter-spacing="4">ECHO-7</text>
        <circle class="breathe" cx="400" cy="230" r="120" fill="url(#sv-core)"/>
        <rect x="0" y="380" width="800" height="70" fill="${C.ink}"/>
        ${person(250, 420, 1, { hair: 'afro', color: C.ink })}${person(560, 410, 0.85, { helmet: true, color: C.ink })}`,
        glow('sv-core', '#4a7bff'));
    },

    // 爵祿街：紅綠牌樓、燈籠、濕亮的街道。
    gerrard: () => {
      const r = rng(3);
      let lanterns = '';
      for (let row = 0; row < 3; row++) {
        const y = 40 + row * 34;
        lanterns += `<path d="M0 ${y} Q400 ${y + 40} 800 ${y}" stroke="${C.ink}" stroke-width="1.5" fill="none"/>`;
        for (let i = 0; i < 12; i++) {
          const x = 30 + i * 66 + row * 20, yy = y + 12 + Math.sin((x / 800) * Math.PI) * 26;
          lanterns += `<ellipse class="${r() < 0.3 ? 'flicker' : ''}" cx="${x}" cy="${yy}" rx="10" ry="12" fill="${C.red}"/><rect x="${x - 4}" y="${yy - 14}" width="8" height="3" fill="${C.gold}"/>`;
        }
      }
      return svg('gerrard', `
        <rect width="800" height="450" fill="url(#gr-sky)"/>
        <rect x="0" y="120" width="180" height="260" fill="${C.slate}"/>${windows(16, 140, 5, 6, 22, 16, 10, 0.5, 31, C.lamp)}
        <rect x="620" y="110" width="180" height="270" fill="${C.slate}"/>${windows(636, 130, 5, 7, 22, 16, 10, 0.5, 41, C.lamp)}
        <rect x="190" y="230" width="420" height="20" fill="${C.jade}"/><path d="M170 232 L400 196 L630 232 Z" fill="${C.red}"/><path d="M220 210 L400 182 L580 210 Z" fill="${C.jade}"/>
        <rect x="236" y="250" width="16" height="140" fill="${C.red}"/><rect x="548" y="250" width="16" height="140" fill="${C.red}"/><rect x="360" y="206" width="80" height="22" fill="${C.gold}"/>
        ${lanterns}
        <path d="M0 380 H800 V450 H0 Z" fill="${C.ink}"/>
        <g opacity="0.35"><rect x="236" y="390" width="16" height="50" fill="${C.red}"/><rect x="548" y="390" width="16" height="50" fill="${C.red}"/><rect x="0" y="392" width="800" height="3" fill="${C.lamp}" opacity="0.4"/></g>
        <rect x="660" y="300" width="120" height="10" fill="${C.jade}"/>${person(712, 392, 0.95, { hat: true, color: '#3b4152' })}
        ${bike(120, 410, 0.9)}`,
        sky('gr', '#0d1424', '#2a1b2f'));
    },

    // 金鳳茶樓：圓桌、蒸籠、電視的光，角落的浩文。
    teahouse: () => svg('teahouse', `
      <rect width="800" height="450" fill="#1a1414"/>
      <rect x="0" y="0" width="800" height="70" fill="${C.ink}"/>${[0, 1, 2, 3].map((i) => `<rect x="${60 + i * 200}" y="60" width="80" height="10" fill="${C.lamp}" opacity="0.8"/>`).join('')}
      <rect x="520" y="90" width="240" height="160" fill="${C.night}"/><rect x="530" y="100" width="220" height="140" fill="url(#th-street)"/>
      ${person(690, 230, 0.55, { hat: true, color: '#3b4152' })}
      <rect x="60" y="100" width="150" height="90" fill="${C.ink}"/><rect x="68" y="108" width="134" height="74" fill="${C.green}" opacity="0.5" class="screen"/>
      <circle cx="136" cy="145" r="90" fill="url(#th-tv)"/>
      <rect x="0" y="330" width="800" height="120" fill="${C.ink}"/>
      <ellipse cx="300" cy="330" rx="110" ry="22" fill="#3a2222"/><ellipse cx="560" cy="350" rx="120" ry="24" fill="#3a2222"/>
      ${[0, 1, 2].map((i) => `<rect x="${250 + i * 2}" y="${290 - i * 18}" width="70" height="16" rx="6" fill="#c9a36a" opacity="${0.9 - i * 0.15}"/>`).join('')}
      ${person(560, 345, 1.05, { color: C.ink, glow: true })}
      <rect x="40" y="250" width="120" height="80" fill="#2b2020"/><rect x="60" y="262" width="60" height="40" rx="4" fill="${C.cyan}" opacity="0.6"/>`,
      `<linearGradient id="th-street" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2540"/><stop offset="1" stop-color="#4a2030"/></linearGradient>` + glow('th-tv', C.green) + phoneglowDef),

    // 滑鐵盧鐵道橋：磚拱、火車駛過、排成一排的外送機車。
    arches: () => svg('arches', `
      <rect width="800" height="450" fill="url(#ar-sky)"/>
      <rect x="0" y="40" width="800" height="70" fill="${C.slate}"/>
      <g class="train"><rect x="-900" y="0" width="700" height="44" fill="${C.steel}"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => `<rect x="${-880 + i * 48}" y="10" width="30" height="16" fill="${C.lamp}" opacity="0.8"/>`).join('')}</g>
      <rect x="0" y="110" width="800" height="340" fill="url(#ar-brick)"/><rect x="0" y="110" width="800" height="340" fill="${C.ink}" opacity="0.45"/>
      ${[0, 1, 2].map((i) => `<path d="M${40 + i * 260} 450 V250 Q${150 + i * 260} 140 ${260 + i * 260} 250 V450 Z" fill="${C.ink}"/>`).join('')}
      <circle cx="410" cy="240" r="100" fill="url(#ar-lamp)"/>
      ${bike(110, 420, 0.8)}${bike(200, 420, 0.8)}${bike(640, 420, 0.8)}
      ${person(370, 425, 1.05, { helmet: true, color: C.ink, glow: true })}${person(460, 425, 1, { hood: true, color: '#3a1d2a' })}
      <path d="M452 352 l8 -10 l8 10 l-8 -4 Z" fill="${C.lamp}"/>
      ${rain(37, 60)}`,
      sky('ar', '#0a0f1c', '#141c30') + bricks('ar-brick', C.brick2, C.ink) + glow('ar-lamp', C.lamp) + phoneglowDef),

    // 維多利亞堤岸：黎明的泰晤士河、鑄鐵路燈、排水口旁的兩個人。
    embankment: () => svg('embankment', `
      <rect width="800" height="450" fill="url(#em-sky)"/>
      <path d="M0 210 L60 190 L90 200 L140 170 L190 190 L260 150 L300 175 L380 160 L420 120 L440 160 L520 170 L600 140 L660 175 L800 160 V250 H0 Z" fill="#2e3550" opacity="0.8"/>
      <rect x="0" y="250" width="800" height="90" fill="#5c6a85"/><path d="M0 270 H800 M0 292 H800 M0 316 H800" stroke="#8a97b2" stroke-width="1.5" opacity="0.5"/>
      <rect x="0" y="330" width="800" height="16" fill="${C.slate}"/><rect x="0" y="346" width="800" height="104" fill="${C.ink}"/>
      ${[80, 300, 700].map((x) => `<line x1="${x}" y1="330" x2="${x}" y2="190" stroke="${C.ink}" stroke-width="5"/><ellipse cx="${x}" cy="186" rx="10" ry="14" fill="${C.ink}"/><circle cx="${x}" cy="186" r="5" fill="${C.lamp}" opacity="0.7"/>`).join('')}
      <rect x="500" y="352" width="70" height="44" fill="${C.steel}"/>${[0, 1, 2, 3, 4].map((i) => `<line x1="${508 + i * 13}" y1="354" x2="${508 + i * 13}" y2="394" stroke="${C.ink}" stroke-width="3"/>`).join('')}
      <path d="M552 362 l6 -4 l6 4 l-6 8 Z" fill="${C.white}" opacity="0.8"/>
      ${person(450, 430, 1.05, { hair: 'afro', color: C.ink })}${person(620, 430, 1, { hair: 'bun', color: '#2a3a2e', umbrella: true })}
      ${bike(150, 430, 0.75)}`,
      sky('em', '#5d6d92', '#e9b38a')),

    // 浩文的公寓：小房間、窗外的夜景、熟睡的女兒、震動的手機。
    flat: () => svg('flat', `
      <rect width="800" height="450" fill="#161a26"/>
      <rect x="470" y="60" width="260" height="190" fill="#0b1020"/>${windows(480, 120, 9, 4, 18, 12, 10, 0.4, 51, C.lamp)}
      <path d="M470 60 V250 M600 60 V250 M470 155 H730" stroke="#2d3448" stroke-width="6"/>
      <rect x="80" y="90" width="120" height="80" fill="#f4e9c8" opacity="0.85"/><rect x="230" y="100" width="70" height="90" fill="#f4e9c8" opacity="0.7"/>
      <text x="140" y="138" text-anchor="middle" font-family="serif" font-size="14" fill="#7a5a2a">獎</text>
      <rect x="0" y="330" width="800" height="120" fill="${C.ink}"/>
      <rect x="70" y="280" width="420" height="70" rx="10" fill="#2a3048"/><path d="M90 284 Q240 250 470 290 V300 H90 Z" fill="#6a7bb0"/>
      <circle cx="420" cy="280" r="16" fill="#2a3048"/>
      ${person(600, 400, 1.05, { color: C.ink })}
      <g class="buzz"><rect x="530" y="330" width="16" height="26" rx="3" fill="${C.cyan}"/><circle cx="538" cy="343" r="40" fill="url(#phoneglow)"/></g>`,
      phoneglowDef),

    // 羅瑟希德：一排老房子、綠門、迷迭香、街角的灰色廂型車。
    rotherhithe: () => svg('rotherhithe', `
      <rect width="800" height="450" fill="url(#rh-sky)"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${i * 200}" y="${110 + (i % 2) * 14}" width="200" height="270" fill="${i === 1 ? '#3a2a28' : C.brick2}" stroke="${C.ink}" stroke-width="4"/><path d="M${i * 200} ${110 + (i % 2) * 14} L${i * 200 + 100} ${70 + (i % 2) * 14} L${i * 200 + 200} ${110 + (i % 2) * 14} Z" fill="${C.ink}"/>`).join('')}
      <rect x="260" y="250" width="70" height="130" fill="#1e5a3a"/><circle cx="316" cy="318" r="5" fill="${C.gold}"/><text x="295" y="240" text-anchor="middle" fill="${C.white}" font-family="serif" font-size="18">14</text>
      <rect x="350" y="180" width="70" height="70" fill="${C.lamp}" opacity="0.75" class="flicker"/>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<ellipse cx="${200 + i * 26}" cy="${372 - (i % 2) * 6}" rx="16" ry="30" fill="#3f7a52"/>`).join('')}
      <rect x="0" y="380" width="800" height="70" fill="${C.ink}"/>
      <g><rect x="600" y="320" width="170" height="70" rx="8" fill="#5a6070"/><rect x="606" y="330" width="40" height="26" fill="#0b0f18"/><circle cx="630" cy="392" r="14" fill="${C.ink}"/><circle cx="740" cy="392" r="14" fill="${C.ink}"/><circle class="flicker" cx="606" cy="370" r="40" fill="url(#rh-head)"/></g>
      ${person(200, 440, 1, { helmet: true, color: C.ink, glow: true })}`,
      sky('rh', '#0b1020', '#22283e') + glow('rh-head', '#fff6c8') + phoneglowDef),

    // 艾琳的廚房：水壺冒著蒸氣、桌上的皮面筆記本。
    kitchen: () => svg('kitchen', `
      <rect width="800" height="450" fill="#2a2018"/>
      <rect x="0" y="0" width="800" height="200" fill="#3a2c20"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 100 + 10}" y="200" width="80" height="80" fill="#4a3a28" stroke="#2a2018" stroke-width="4"/>`).join('')}
      <rect x="560" y="60" width="160" height="120" fill="#0b1020"/><rect x="570" y="70" width="140" height="100" fill="#1b2540"/>
      ${rain(61, 20)}
      <rect x="60" y="230" width="200" height="20" fill="#1a1410"/><path d="M110 228 Q130 196 160 228 Z" fill="#7a8a9a"/>
      <g class="steam" fill="none" stroke="#e9e2d0" stroke-width="3" opacity="0.5"><path d="M150 190 q10 -14 0 -28 q-10 -14 0 -28"/><path d="M162 196 q10 -14 0 -28 q-10 -14 0 -28"/></g>
      <rect x="0" y="330" width="800" height="120" fill="#160f0a"/>
      <rect x="240" y="300" width="360" height="40" fill="#5a3e26"/>
      <rect x="380" y="286" width="70" height="16" rx="2" fill="#6b3a1e"/><path d="M406 290 l9 -5 l9 5 l-9 8 Z" fill="${C.gold}"/>
      <circle cx="420" cy="280" r="100" fill="url(#kt-lamp)"/>
      ${person(300, 400, 1.05, { hair: 'afro', color: C.ink })}${person(560, 410, 1.05, { hair: 'bun', color: '#26301f' })}`,
      glow('kt-lamp', C.lamp)),

    // 布魯內爾豎井：磚砌拱道、手電筒光、積水的深井。
    tunnels: () => svg('tunnels', `
      <rect width="800" height="450" fill="${C.ink}"/>
      <rect width="800" height="450" fill="url(#tn-brick)" opacity="0.6"/>
      ${[0, 1, 2].map((i) => `<path d="M${130 + i * 200} 380 V200 Q${200 + i * 200} 110 ${270 + i * 200} 200 V380 Z" fill="#05060a" stroke="${C.brick2}" stroke-width="10"/>`).join('')}
      <text x="600" y="190" text-anchor="middle" fill="${C.white}" opacity="0.5" font-family="serif" font-size="14">III</text>
      <path d="M560 380 L330 450 L800 450 Z" fill="url(#tn-torch)" opacity="0.7"/>
      <ellipse cx="400" cy="420" rx="160" ry="22" fill="#18304a"/><ellipse cx="400" cy="420" rx="160" ry="22" fill="none" stroke="#3a6a9a" stroke-width="2" class="ripple"/>
      ${person(620, 440, 1, { hair: 'bun', color: '#1d2418' })}${person(700, 440, 1, { hair: 'afro', color: C.ink })}`,
      bricks('tn-brick', C.brick, '#120a0a') + `<linearGradient id="tn-torch" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c0" stop-opacity="0.6"/><stop offset="1" stop-color="#fff2c0" stop-opacity="0"/></linearGradient>`),

    // 舊液壓泵站：巨大的活塞、老式電話交換機。
    station: () => svg('station', `
      <rect width="800" height="450" fill="#0b0d10"/>
      <path d="M0 120 Q400 -20 800 120 V0 H0 Z" fill="${C.ink}"/>
      ${[0, 1].map((i) => `<rect x="${90 + i * 180}" y="120" width="90" height="260" fill="#2a2a2e"/><rect x="${80 + i * 180}" y="100" width="110" height="30" fill="#3a3a40"/><rect x="${115 + i * 180}" y="60" width="40" height="60" fill="#4a4040"/>`).join('')}
      <rect x="470" y="150" width="260" height="190" fill="#3b2a1c"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [0, 1, 2, 3].map((j) => `<circle cx="${494 + i * 30}" cy="${178 + j * 34}" r="6" fill="${C.ink}"/>`).join('')).join('')}
      <path d="M494 178 C540 300 600 120 650 280 M554 212 C580 320 660 160 704 246" stroke="${C.lamp}" stroke-width="2" fill="none"/>
      <rect x="560" y="290" width="70" height="40" fill="${C.cyan}" opacity="0.6" class="screen"/>
      <line x1="600" y1="0" x2="600" y2="90" stroke="${C.ink}" stroke-width="2"/><circle cx="600" cy="96" r="8" fill="${C.lamp}" class="flicker"/><circle cx="600" cy="96" r="140" fill="url(#st-lamp)"/>
      <rect x="0" y="380" width="800" height="70" fill="#050608"/>
      ${person(620, 420, 0.95, { hair: 'afro', color: C.ink, glow: true })}`,
      glow('st-lamp', C.lamp) + phoneglowDef),

    // 第二季：康登大街的宵禁夜。路燈、店面招牌、樓上住家的窗，街尾是監控塔。
    highstreet: () => highstreet(false),
    // 熄燈之後：路燈和招牌全暗，住家的窗一扇一扇亮起來。
    'highstreet-dark': () => highstreet(true),

    // 第二季：工地空地。貨櫃、鋼架監控塔、塔底的控制箱、帶著探照燈繞圈的無人機。
    // 劇情畫面的插畫是寬螢幕裁切（只看得到 y 75–375），所以塔頂和控制箱都放在這個範圍裡。
    site: () => svg('site', `
      <rect width="800" height="450" fill="url(#si-sky)"/>
      <path d="M0 220 L70 206 L120 216 L190 190 L260 208 L330 184 L380 200 L520 192 L600 210 L680 186 L800 202 V280 H0 Z" fill="${C.navy}"/>
      <rect x="0" y="252" width="800" height="40" fill="${C.slate}"/>${Array.from({ length: 40 }, (_, i) => `<line x1="${i * 20}" y1="252" x2="${i * 20}" y2="292" stroke="${C.ink}" stroke-width="2" opacity="0.6"/>`).join('')}
      <path d="M0 252 H800" stroke="${C.fog}" stroke-width="2" stroke-dasharray="3 5"/>
      <rect x="0" y="360" width="800" height="90" fill="#121722"/>
      <g stroke="${C.steel}" stroke-width="5" fill="none"><path d="M392 360 L430 100 L468 360"/>${[0, 1, 2, 3, 4, 5].map((i) => { const y = 130 + i * 38, w = 4 + i * 5.2; return `<path d="M${430 - w} ${y} L${430 + w + 5} ${y + 38} M${430 + w} ${y} L${430 - w - 5} ${y + 38}"/>`; }).join('')}</g>
      <rect x="404" y="112" width="52" height="9" fill="${C.steel}"/>${cctv(404, 122, false)}${cctv(456, 122, true)}
      <circle cx="430" cy="96" r="42" fill="url(#si-red)"/><circle cx="430" cy="96" r="7" fill="${C.red}"/>
      <rect x="410" y="322" width="44" height="38" fill="${C.fog}"/><rect x="418" y="330" width="20" height="12" fill="${C.cyan}" opacity="0.7" class="screen"/><path d="M454 356 Q520 366 800 364" stroke="${C.ink}" stroke-width="6" fill="none"/>
      ${[[30, 290, '#5a2a1e'], [150, 290, '#6b3322'], [70, 234, '#4c2318']].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="140" height="70" fill="${c}"/>${Array.from({ length: 9 }, (_, i) => `<line x1="${x + 10 + i * 15}" y1="${y + 6}" x2="${x + 10 + i * 15}" y2="${y + 64}" stroke="${C.ink}" stroke-width="3" opacity="0.4"/>`).join('')}`).join('')}
      ${[0, 1, 2, 3, 4].map((i) => `<line x1="${560 + i * 6}" y1="${358 - i * 4}" x2="${720 + i * 4}" y2="${342 - i * 5}" stroke="#6b5a4a" stroke-width="4"/>`).join('')}
      <path class="site-beam" d="M626 148 L540 362 L712 362 Z" fill="${C.yellow}" opacity="0.13"/>
      <g transform="translate(626 140)"><rect x="-22" y="-6" width="44" height="12" rx="4" fill="${C.ink}"/><line x1="-36" y1="-10" x2="-12" y2="-10" stroke="${C.fog}" stroke-width="3"/><line x1="12" y1="-10" x2="36" y2="-10" stroke="${C.fog}" stroke-width="3"/><circle cx="0" cy="8" r="4" fill="${C.yellow}"/><circle cx="16" cy="0" r="2" fill="${C.red}" class="blink"/></g>
      ${person(318, 362, 0.8, { hood: true, color: C.ink })}${person(354, 364, 0.75, { cap: true, color: '#1a1f2e' })}`,
      sky('si', '#060912', '#161d33') + glow('si-red', C.red)),
  };

  // 康登大街。dark 為真時是熄燈之後的樣子。
  // 每盞燈、每扇窗都帶著 --d（延遲秒數），全螢幕演出時用 CSS 讓路燈從塔那頭一盞一盞熄掉，再讓住家一扇一扇亮起來。
  function highstreet(dark) {
    const r = rng(486);
    const houses = [[0, 130, 120, '#2a1c2e'], [130, 140, 96, '#1c2a3a'], [270, 120, 130, '#2e2418'], [390, 130, 104, '#1f2c24'], [520, 140, 124, '#2b1f24']];
    const neon = [C.pink, C.cyan, C.yellow, C.green, C.pink];
    const out = (i) => (0.6 + (4 - i) * 0.45).toFixed(2); // 第 i 盞路燈（由左往右）熄掉的時間
    let g = `<rect width="800" height="450" fill="url(#hs-sky)"/>`
      + `<path d="M0 200 L80 186 L150 196 L240 170 L330 188 L420 160 L520 182 L600 166 L700 190 L800 176 V300 H0 Z" fill="${C.navy}" opacity="0.8"/>`;
    // 街尾的塔
    g += `<g stroke="${C.steel}" stroke-width="3" fill="none"><path d="M692 330 L712 112 L732 330"/>${[0, 1, 2, 3, 4].map((i) => { const y = 140 + i * 38, w = 3 + i * 3.6; return `<path d="M${712 - w} ${y} L${712 + w + 4} ${y + 38} M${712 + w} ${y} L${712 - w - 4} ${y + 38}"/>`; }).join('')}</g>`
      + (dark ? `<circle cx="712" cy="108" r="5" fill="#3a1a22"/>` : `<circle class="hs-eye" style="--d:0.3s" cx="712" cy="108" r="34" fill="url(#hs-red)"/><circle class="hs-eye" style="--d:0.3s" cx="712" cy="108" r="5" fill="${C.red}"/>`);
    // 一排店面，樓上是住家
    houses.forEach(([x, w, top, col], i) => {
      g += `<rect x="${x}" y="${top}" width="${w}" height="${380 - top}" fill="${col}"/><rect x="${x}" y="${top}" width="${w}" height="6" fill="${C.ink}" opacity="0.5"/>`;
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < 3; c++) {
          const wx = Math.round(x + 16 + c * ((w - 54) / 2)), wy = top + 26 + row * 64;
          // 同一個亂數決定：平常亮不亮（15%）、熄燈之後會不會亮起來（80%）。
          const roll = r();
          const on = roll < (dark ? 0.8 : 0.15);
          const d = (3.4 + r() * 2.4).toFixed(2);
          g += `<rect class="hs-home${roll < 0.8 ? ' wake' : ''}" style="--d:${d}s" x="${wx}" y="${wy}" width="22" height="34" fill="${on ? C.lamp : C.steel}" opacity="${on ? 0.85 : 0.55}"/>`;
        }
      }
      g += `<rect x="${x + 6}" y="300" width="${w - 12}" height="72" fill="${C.ink}" opacity="0.85"/>`
        + `<rect x="${x + 14}" y="308" width="${w - 28}" height="56" fill="${dark ? C.slate : '#26304a'}" opacity="0.7"/>`
        + `<rect class="hs-neon" style="--d:${out(i)}s" x="${x + 10}" y="284" width="${w - 20}" height="14" rx="3" fill="${dark ? C.slate : neon[i]}" opacity="${dark ? 0.5 : 0.85}"/>`;
    });
    // 康登的大靴子招牌
    g += `<path d="M168 236 L168 196 L196 196 L196 230 Q228 232 236 250 L236 262 L160 262 Q156 248 168 236 Z" fill="${C.gold}" opacity="${dark ? 0.35 : 0.9}"/>`;
    // 街尾的工地圍欄、人行道、馬路
    g += `<rect x="660" y="318" width="140" height="62" fill="${C.slate}"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${668 + i * 20}" y1="318" x2="${668 + i * 20}" y2="380" stroke="${C.ink}" stroke-width="2"/>`).join('')}`
      + `<rect x="0" y="372" width="800" height="22" fill="#2a3046"/><rect x="0" y="394" width="800" height="56" fill="#0a0d16"/>`
      + `<path d="M0 424 H800" stroke="${C.fog}" stroke-width="3" stroke-dasharray="26 22" opacity="0.6"/>`;
    // 路燈：從靠近塔的那一盞開始熄
    [60, 200, 340, 480, 620].forEach((x, i) => {
      const d = `--d:${out(i)}s`;
      g += `<line x1="${x}" y1="392" x2="${x}" y2="238" stroke="${C.ink}" stroke-width="5"/><path d="M${x} 240 Q${x} 228 ${x + 20} 230" stroke="${C.ink}" stroke-width="4" fill="none"/>`
        + `<rect class="hs-bulb" style="${d}" x="${x + 12}" y="228" width="18" height="7" rx="2" fill="${dark ? C.steel : '#fff1c9'}"/>`
        + (dark ? '' : `<path class="hs-cone" style="${d}" d="M${x + 14} 236 L${x - 40} 392 L${x + 76} 392 L${x + 28} 236 Z" fill="${C.lamp}" opacity="0.16"/><circle class="hs-glow" style="${d}" cx="${x + 21}" cy="236" r="62" fill="url(#hs-lamp)"/>`);
    });
    // 天上的無人機
    g += [[110, 96], [430, 84], [590, 118]].map(([x, y]) => `<g class="hs-drone"><rect x="${x - 10}" y="${y - 3}" width="20" height="6" rx="2" fill="${C.ink}"/><circle cx="${x}" cy="${y + 5}" r="2.5" fill="${C.red}"/></g>`).join('');
    return svg(dark ? 'highstreet-dark' : 'highstreet', g, sky('hs', '#060a16', '#18203a') + glow('hs-lamp', C.lamp) + glow('hs-red', C.red));
  }

  // 場景 id → 插畫。現實和記憶共用同一張（記憶模式會被 CSS 轉成藍白重建畫面）。
  const sceneArt = {
    'prologue.basement': 'basement',
    'present.node': 'basement',
    'memory.maya.alley': 'alley',
    'memory.maya.dock': 'dock',
    'memory.maya.server': 'server',
    'present.chinatown.street': 'gerrard',
    'present.chinatown.teahouse': 'teahouse',
    'memory.homan.hub': 'arches',
    'memory.homan.embankment': 'embankment',
    'memory.homan.flat': 'flat',
    'present.eileen.door': 'rotherhithe',
    'memory.eileen.kitchen': 'kitchen',
    'memory.eileen.tunnels': 'tunnels',
    'finale.shaft': 'tunnels',
    'memory.eileen.station': 'station',
    'finale.exchange': 'station',
  };

  // ===== 頭像：Profiler 人物卡與隊伍列使用 =====
  const avatarBase = (bg, body) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" fill="${bg}"/>${body}</svg>`;
  const bust = (col, extra = '') => `<path d="M14 100 Q16 70 50 66 Q84 70 86 100 Z" fill="${col}"/><circle cx="50" cy="44" r="19" fill="${col}"/>${extra}`;

  const avatars = {
    echo: () => avatarBase('#0b0f1c', `<circle cx="50" cy="50" r="30" fill="none" stroke="${C.cyan}" stroke-width="3"/><path d="M22 50 h10 l5 -14 l7 28 l6 -20 l6 12 h22" fill="none" stroke="${C.cyan}" stroke-width="3" stroke-linejoin="round"/>`),
    maya: () => avatarBase('#2a0e1c', bust(C.ink, `<circle cx="50" cy="32" r="22" fill="${C.ink}"/><circle cx="38" cy="22" r="11" fill="${C.ink}"/><circle cx="62" cy="21" r="11" fill="${C.ink}"/><path d="M30 86 L50 74 L70 86" stroke="${C.pink}" stroke-width="4" fill="none"/>`)),
    homan: () => avatarBase('#2a2410', bust(C.ink, `<path d="M30 42 Q30 20 50 20 Q70 20 70 42 Z" fill="${C.yellow}"/><rect x="30" y="40" width="40" height="5" fill="${C.ink}"/>`)),
    eileen: () => avatarBase('#14241a', bust('#1d2a20', `<path d="M31 46 Q30 22 50 22 Q70 22 69 46 Q64 32 50 32 Q36 32 31 46 Z" fill="#e8e6e0"/><path d="M14 100 Q16 72 50 68 Q84 72 86 100 Z" fill="#3e5a40"/>`)),
    cassie: () => avatarBase('#2a160c', bust('#3a1d12', `<path d="M28 60 Q24 18 50 16 Q76 18 72 60 Q64 42 50 42 Q36 42 28 60 Z" fill="#5a2a14"/><path d="M50 78 q-6 8 0 14 q6 -6 0 -14 Z" fill="#ff8a3d"/>`)),
    guard: () => avatarBase('#121826', bust(C.ink, `<path d="M32 34 Q50 20 68 34 L78 36 L32 38 Z" fill="${C.steel}"/>`)),
    agent: () => avatarBase('#181a20', bust('#3b4152', `<rect x="28" y="28" width="44" height="5" fill="#3b4152"/><rect x="36" y="12" width="28" height="18" fill="#3b4152"/>`)),
    hale: () => avatarBase('#101820', bust(C.ink, `<rect x="36" y="40" width="12" height="7" fill="none" stroke="${C.white}" stroke-width="2"/><rect x="52" y="40" width="12" height="7" fill="none" stroke="${C.white}" stroke-width="2"/>`)),
    darcy: () => avatarBase('#1a1014', `<path d="M14 100 Q16 70 50 64 Q84 70 86 100 Z" fill="#e9e4dc"/><path d="M24 74 Q20 16 50 12 Q80 16 76 74 Q66 46 50 46 Q34 46 24 74 Z" fill="#f2efe8"/><path d="M50 34 l-12 16 h8 l4 -6 l4 6 h8 Z" fill="${C.red}"/><path d="M38 60 Q50 66 62 60 L50 80 Z" fill="${C.ink}" opacity="0.8"/>`),
    bagley: () => avatarBase('#0a1418', `<polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill="none" stroke="${C.cyan}" stroke-width="3"/><text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-style="italic" fill="${C.cyan}">B</text>`),
    wrench: () => avatarBase('#1a0d1a', bust(C.ink, `<rect x="28" y="28" width="44" height="34" rx="8" fill="#1a1a1a" stroke="#555" stroke-width="2"/><path d="M36 38 l8 8 m0 -8 l-8 8 M56 38 l8 8 m0 -8 l-8 8" stroke="${C.cyan}" stroke-width="3"/><path d="M40 54 h20" stroke="${C.cyan}" stroke-width="3"/>`)),
    // 客串角色：只有帽子、圍巾這些輪廓
    aiden: () => avatarBase('#12161c', bust('#20242c', `<path d="M30 40 Q30 20 50 20 Q70 20 70 40 Z" fill="#2c3038"/><path d="M28 40 H80 L74 45 H30 Z" fill="#1c2026"/><path d="M31 54 Q50 64 69 54 L71 70 Q50 78 29 70 Z" fill="#6b5a3a"/>`)),
    marcus: () => avatarBase('#1a1014', bust('#2a1c20', `<path d="M30 42 Q30 16 50 16 Q70 16 70 42 Z" fill="#c23a3a"/><rect x="29" y="38" width="42" height="6" rx="2" fill="#8a2a2a"/>`)),
    // 白天的奇遇
    moon: () => avatarBase('#0a1a14', `<circle cx="50" cy="50" r="34" fill="#d8e070"/><circle cx="40" cy="42" r="6" fill="#b8c058"/><circle cx="60" cy="58" r="9" fill="#b8c058"/><circle cx="62" cy="34" r="4" fill="#b8c058"/>`),
    dog: () => avatarBase('#141a20', `<path d="M28 34 L26 58 L38 50 Q50 46 62 50 L74 58 L72 34 L60 40 Q50 36 40 40 Z" fill="#e8e6e0"/><path d="M36 46 Q50 38 64 46 Q68 78 50 82 Q32 78 36 46 Z" fill="#f4f1ea"/><circle cx="43" cy="56" r="3" fill="#20242c"/><circle cx="57" cy="56" r="3" fill="#20242c"/><ellipse cx="50" cy="68" rx="4" ry="3" fill="#20242c"/>`),
    tv: () => avatarBase('#10141a', `<rect x="20" y="26" width="60" height="48" rx="5" fill="#2c3038" stroke="#555d6c" stroke-width="2"/><rect x="26" y="32" width="48" height="36" fill="#c8cfdf"/><path d="M50 40 a6 6 0 1 1 -.1 0 M38 68 q12 -18 24 0" fill="#3a4560"/><path d="M38 14 L48 26 M62 14 L52 26" stroke="#555d6c" stroke-width="2"/>`),
    bear: () => avatarBase('#1a1c2a', `<circle cx="28" cy="30" r="11" fill="#3b67c4"/><circle cx="72" cy="30" r="11" fill="#3b67c4"/><circle cx="50" cy="52" r="30" fill="#3b67c4"/><ellipse cx="50" cy="62" rx="15" ry="11" fill="#f0efe8"/><circle cx="40" cy="46" r="3.5" fill="#0b0f1c"/><circle cx="60" cy="46" r="3.5" fill="#0b0f1c"/><circle cx="50" cy="57" r="3" fill="#e8302a"/>`),
    bluedoor: () => avatarBase('#0a1640', `<rect x="32" y="14" width="36" height="74" rx="2" fill="#1c3fb0" stroke="#7fa0ff" stroke-width="2"/><rect x="38" y="22" width="24" height="24" fill="none" stroke="#7fa0ff" stroke-width="1.5"/><circle cx="61" cy="56" r="3" fill="#ffd23f"/>`),
    cat: () => avatarBase('#14141a', `<path d="M26 42 L30 16 L46 30 Q50 29 54 30 L70 16 L74 42 Q76 74 50 78 Q24 74 26 42 Z" fill="#20202a"/><path d="M36 54 Q50 46 64 54 Q66 76 50 78 Q34 76 36 54 Z" fill="#f0efe8"/><circle cx="40" cy="44" r="4" fill="#5cc8f2"/><circle cx="60" cy="44" r="4" fill="#5cc8f2"/><path d="M47 58 h6 l-3 3 Z" fill="#ff8aa0"/>`),
    card: () => avatarBase('#1a0a10', `<g transform="rotate(-8 50 50)"><rect x="22" y="30" width="56" height="40" rx="3" fill="#e8302a"/><rect x="28" y="36" width="44" height="28" fill="none" stroke="#0b0f1c" stroke-width="2"/><path d="M36 46 H64 M36 54 H56" stroke="#0b0f1c" stroke-width="3"/></g>`),
    tarot: () => avatarBase('#160c24', `<rect x="32" y="14" width="36" height="72" rx="3" fill="#e9e4dc"/><path d="M50 24 L60 74 H40 Z" fill="#3a2a5a"/><path d="M42 34 L58 26" stroke="#ff8a3d" stroke-width="3"/><circle cx="50" cy="52" r="3" fill="#ffd23f"/>`),
    crowd: () => avatarBase('#161b28', bust('#2d3550')),
    device: () => avatarBase('#0b0f1c', `<rect x="22" y="28" width="56" height="40" rx="4" fill="none" stroke="${C.green}" stroke-width="3"/><path d="M40 80 h20 M50 68 v12" stroke="${C.green}" stroke-width="3"/><circle cx="50" cy="48" r="6" fill="${C.green}"/>`),
  };

  // 掃描目標 → 頭像。不在表裡的人用路人剪影，物件用裝置圖示。
  const targetAvatar = {
    maya: 'maya', homan: 'homan', rider: 'homan', photo: 'homan', bike: 'homan',
    eileen: 'eileen', cassie: 'cassie', caller: 'cassie',
    guard: 'guard', agent: 'agent', van: 'agent', board: 'hale',
    crowd: 'crowd', darcy: 'darcy', bagley: 'bagley', wrench: 'wrench',
  };

  E.art = {
    scene(sceneId) {
      const key = sceneArt[sceneId] || 'basement';
      return { key, svg: scenes[key]() };
    },
    // 第二季直接用插畫名稱取圖，例如 'alley'、'tunnels'。
    byKey(key) {
      return (scenes[key] || scenes.basement)();
    },
    avatar(id) {
      return (avatars[id] || avatars.crowd)();
    },
    avatarFor(target) {
      if (!target) return avatars.device();
      const id = targetAvatar[target];
      return id ? avatars[id]() : avatars.device();
    },
  };
})(window.ECHO = window.ECHO || {});
