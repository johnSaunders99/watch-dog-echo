// 第二季路人的頭像：延續第一季的剪影風格。
// 髮型由每個人的 id 決定，帽子和道具由職業決定，底色代表能力分類，稀有人物有金框。
(function (E) {
  const INK = '#07090e';
  const BG = { hacker: '#0f1d2a', physical: '#2a1a0e', social: '#2a0e1c', specialist: '#13241a' };
  const ACCENT = { hacker: '#2ff3e0', physical: '#ffb347', social: '#ff2e88', specialist: '#5cf29a' };
  const C = { yellow: '#ffd23f', orange: '#ffb347', red: '#ff4757', cyan: '#2ff3e0', pink: '#ff2e88', white: '#f4f1ea', steel: '#2a3350', fog: '#46506b', gold: '#e8b54a' };

  const HAIR = {
    none: () => '',
    afro: (c) => `<circle cx="50" cy="34" r="22" fill="${c}"/><circle cx="36" cy="26" r="11" fill="${c}"/><circle cx="64" cy="26" r="11" fill="${c}"/>`,
    bob: (c) => `<path d="M29 50 Q27 20 50 20 Q73 20 71 50 L71 58 Q66 46 50 44 Q34 46 29 58 Z" fill="${c}"/>`,
    bun: (c) => `<circle cx="50" cy="19" r="9" fill="${c}"/><path d="M31 42 Q31 24 50 24 Q69 24 69 42 Q60 32 50 32 Q40 32 31 42 Z" fill="${c}"/>`,
    spiky: (c) => `<path d="M31 40 L33 22 L42 30 L48 17 L55 29 L64 19 L67 32 L70 40 Q60 32 50 32 Q40 32 31 40 Z" fill="${c}"/>`,
    side: (c) => `<path d="M30 42 Q30 22 52 22 Q71 23 70 38 Q57 30 40 36 Z" fill="${c}"/>`,
    ponytail: (c) => `<path d="M31 42 Q31 23 50 23 Q69 23 69 42 Q60 32 50 32 Q40 32 31 42 Z" fill="${c}"/><path d="M68 32 Q84 42 76 66" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    long: (c) => `<path d="M30 44 Q28 20 50 20 Q72 20 70 44 L75 86 L64 86 L64 52 Q50 42 36 52 L36 86 L25 86 Z" fill="${c}"/>`,
  };
  const HAIR_KEYS = Object.keys(HAIR);

  const glasses = (col) => `<rect x="35" y="39" width="12" height="7" rx="2" fill="none" stroke="${col}" stroke-width="2"/><rect x="53" y="39" width="12" height="7" rx="2" fill="none" stroke="${col}" stroke-width="2"/><path d="M47 42 h6" stroke="${col}" stroke-width="2"/>`;
  const helmet = (col) => `<path d="M30 40 Q30 18 50 18 Q70 18 70 40 Z" fill="${col}"/><rect x="30" y="38" width="40" height="5" fill="${INK}"/>`;
  const hardhat = (col) => `<path d="M29 36 Q30 18 50 18 Q70 18 71 36 Z" fill="${col}"/><rect x="24" y="34" width="52" height="5" rx="2" fill="${col}"/>`;
  const cap = (col) => `<path d="M31 35 Q50 19 69 35 L82 37 L31 39 Z" fill="${col}"/>`;
  const beanie = (col) => `<path d="M31 38 Q31 17 50 17 Q69 17 69 38 Z" fill="${col}"/><rect x="30" y="34" width="40" height="6" fill="${C.steel}"/>`;
  const headphones = (col) => `<path d="M29 46 Q29 20 50 20 Q71 20 71 46" stroke="${col}" stroke-width="4" fill="none"/><rect x="25" y="40" width="8" height="13" rx="3" fill="${col}"/><rect x="67" y="40" width="8" height="13" rx="3" fill="${col}"/>`;
  const tie = (col) => `<path d="M41 68 L50 75 L59 68" stroke="${C.white}" stroke-width="3" fill="none"/><path d="M50 74 L45 79 L50 98 L55 79 Z" fill="${col}"/>`;

  // 職業 → 帽子或道具。hat: true 代表會蓋住頭髮的上半部。
  const GEAR = {
    courier: { hat: true, svg: () => helmet(C.yellow) },
    builder: { hat: true, svg: () => hardhat(C.orange) },
    firefighter: { hat: true, svg: () => hardhat(C.red) },
    removals: { hat: true, svg: () => cap(C.fog) },
    docker: { hat: true, svg: () => beanie(C.fog) },
    cabbie: { hat: true, svg: () => cap(C.steel) },
    trainer: { svg: () => `<rect x="31" y="33" width="38" height="5" fill="${C.red}"/>` },
    nurse: { svg: () => `<rect x="46" y="76" width="8" height="20" fill="${C.cyan}"/><rect x="40" y="82" width="20" height="8" fill="${C.cyan}"/>` },
    programmer: { specs: true, svg: () => glasses(C.cyan) },
    it_support: { specs: true, svg: () => glasses(C.cyan) + `<rect x="58" y="80" width="12" height="9" fill="${C.white}" opacity="0.8"/>` },
    cs_student: { specs: true, svg: () => glasses(C.cyan) },
    streamer: { svg: () => headphones(C.pink) + `<path d="M30 52 Q33 61 44 60" stroke="${C.pink}" stroke-width="2" fill="none"/>` },
    journalist: { svg: () => `<rect x="56" y="78" width="18" height="10" fill="${C.white}"/><text x="65" y="85.5" font-size="5.5" font-family="monospace" text-anchor="middle" fill="${INK}">PRESS</text>` },
    lawyer: { svg: () => tie(C.pink) },
    salesperson: { svg: () => tie(C.cyan) },
    bartender: { svg: () => `<path d="M41 69 L50 73 L41 77 Z M59 69 L50 73 L59 77 Z" fill="${C.pink}"/>` },
    busker: { svg: () => `<line x1="18" y1="100" x2="34" y2="58" stroke="${C.gold}" stroke-width="5" stroke-linecap="round"/><rect x="29" y="52" width="9" height="8" fill="${C.gold}"/>` },
    actor: { svg: () => `<path d="M34 38 Q50 32 66 38 Q66 48 58 48 Q50 43 42 48 Q34 48 34 38 Z" fill="${C.white}"/>` },
    teacher: { specs: true, svg: () => glasses(C.white) },
    locksmith: { svg: () => `<circle cx="64" cy="82" r="5" fill="none" stroke="${C.gold}" stroke-width="2.5"/><path d="M64 87 v9 M64 92 h4" stroke="${C.gold}" stroke-width="2.5"/>` },
    drone_op: { svg: () => `<rect x="32" y="37" width="36" height="9" rx="3" fill="${C.red}" opacity="0.9"/>` },
    pigeon: { svg: () => `<ellipse cx="75" cy="66" rx="10" ry="6" fill="#9aa3b5"/><circle cx="82" cy="59" r="4.5" fill="#9aa3b5"/><path d="M86 59 l5 1.5 l-5 1.5 Z" fill="${C.orange}"/>` },
    cobol: { specs: true, svg: () => glasses(C.white) + `<rect x="58" y="80" width="14" height="9" fill="#5cf29a" opacity="0.7"/>` },
    radio: { svg: () => headphones(C.cyan) + `<rect x="47" y="58" width="6" height="12" rx="3" fill="${C.cyan}"/>` },
    cleaner: { hat: true, svg: () => cap('#1f8a6a') + `<circle cx="64" cy="84" r="6" fill="none" stroke="${C.gold}" stroke-width="2"/>` },
    parkour: { hat: true, svg: (col) => `<path d="M28 62 Q24 18 50 16 Q76 18 72 62 Q66 40 50 40 Q34 40 28 62 Z" fill="${col}"/>` },
  };

  function of(p) {
    const r = E.rng.derive('face', p.id);
    const job = E.people.occupationOf(p);
    const bg = BG[job.category];
    const head = INK;
    const hairCol = p.age >= 60 ? '#b9b6ae' : r.pick(['#1b2131', '#2a1d16', '#141820', '#3a2a1c']);
    const style = r.pick(HAIR_KEYS);
    const gear = GEAR[job.id];
    const hood = gear && job.id === 'parkour';
    let body = '';
    if (style === 'long' && !hood) body += HAIR.long(hairCol);
    body += `<path d="M14 100 Q16 70 50 66 Q84 70 86 100 Z" fill="${head}"/><circle cx="50" cy="44" r="19" fill="${head}"/>`;
    // 衣服上的一條顏色，代表能力分類。
    body += `<path d="M20 100 Q22 80 32 74" stroke="${ACCENT[job.category]}" stroke-width="3" fill="none" opacity="0.7"/>`;
    if (style !== 'long' && !(gear && gear.hat)) body += HAIR[style](hairCol);
    if (gear) body += gear.svg(INK);
    if (p.age >= 65 && !(gear && gear.specs)) body += glasses('#8b909c');
    const tier = E.people.tierOf(p);
    const frame = tier === 'rare' ? `<rect x="2" y="2" width="96" height="96" fill="none" stroke="${C.gold}" stroke-width="4"/>`
      : tier === 'uncommon' ? `<rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke="#9aa3b5" stroke-width="2"/>` : '';
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" fill="${bg}"/>${body}${frame}</svg>`;
  }

  E.faces = { of };
})(window.ECHO = window.ECHO || {});
