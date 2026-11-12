// 第三季的聲音和音樂：全部現場合成（工具在 js/ui/sfx.js），沒有音檔，也沒有取樣任何遊戲。
// 戰鬥的聲音很密，所以每個都很短、音量壓低；介面那邊（js/s3/main.js）還會擋掉太密集的重複。
// 音樂是一個十六分音符的小音序器：潛入時只有低音脈動和零星的訊號聲；警報一響就加上鼓、貝斯和琶音；首領戰再快一點、再多一層。
(function (E) {
  const S3 = (E.s3 = E.s3 || {});
  const sfx = E.sfx;
  let K = null; // 合成工具：osc、hiss、rotor、keypad、rnd、pick

  sfx.add((kit) => {
    K = kit;
    const { rotor, keypad, rnd, pick } = kit;
    // 每個聲音最後再乘一個音量（LEVEL）：槍聲、打中這些最常聽到的要夠清楚，引擎聲這種長的要壓低。
    let vol = 1;
    const osc = (type, f, at, dur, v, o) => kit.osc(type, f, at, dur, v * vol, o);
    const hiss = (at, dur, v, o) => kit.hiss(at, dur, v * vol, o);
    const pan = () => rnd(-0.35, 0.35);
    const LEVEL = { s3gun: 1.6, s3silenced: 3, s3taser: 2, s3nail: 2.5, s3eshot: 3, s3hit: 5, s3kill: 1.6, s3scrap: 2.5, s3clang: 2.5, s3swing: 2.5, s3dash: 2, s3zap: 2, s3pick: 4, s3reload: 2.5, s3lob: 2.5, s3shriek: 2, s3rev: 0.6 };
    const map = {
      // ----- 槍 -----
      s3gun: () => { hiss(0, 0.05, 0.15, { f: rnd(1600, 2000), q: 0.8 }); osc('sine', 170, 0, 0.07, 0.13, { to: 58 }); hiss(0, 0.008, 0.08, { type: 'highpass', f: 5000 }); },
      s3silenced: () => { hiss(0, 0.05, 0.06, { type: 'lowpass', f: rnd(1200, 1500) }); osc('sine', 230, 0, 0.04, 0.035, { to: 120 }); },
      s3taser: () => { osc('square', rnd(850, 1000), 0, 0.07, 0.035, { to: 300, crush: 0.5 }); hiss(0, 0.035, 0.05, { type: 'highpass', f: 4200 }); },
      s3shotgun: () => { hiss(0, 0.16, 0.26, { type: 'lowpass', f: 2600, to: 320, wet: 0.3 }); osc('sine', 115, 0, 0.17, 0.26, { to: 38 }); hiss(0, 0.012, 0.16, { type: 'highpass', f: 4000 }); },
      s3nail: () => { hiss(0, 0.02, 0.08, { f: rnd(2900, 3500), q: 2 }); osc('sine', 520, 0, 0.03, 0.045, { to: 250 }); },
      s3eshot: () => { hiss(0, 0.05, 0.06, { f: rnd(950, 1250), q: 0.9, pan: pan() }); osc('sine', 240, 0, 0.06, 0.05, { to: 105, pan: pan() }); },
      s3snipe: () => { hiss(0, 0.05, 0.24, { type: 'highpass', f: 2000, wet: 0.4 }); osc('sine', 900, 0, 0.11, 0.1, { to: 190, echo: 0.3 }); osc('sine', 90, 0, 0.2, 0.18, { to: 40 }); },
      s3lob: () => { osc('sine', 300, 0, 0.08, 0.06, { to: 140 }); },
      // ----- 打中、倒下 -----
      s3hit: () => { hiss(0, 0.03, 0.06, { type: 'lowpass', f: rnd(800, 1100), pink: true }); },
      s3kill: () => { osc('sine', 190, 0, 0.14, 0.15, { to: 50 }); hiss(0, 0.07, 0.07, { type: 'lowpass', f: 1200, pink: true }); },
      s3scrap: () => { osc('sine', rnd(480, 560), 0, 0.2, 0.07, { fm: { ratio: 2.4, depth: 300 }, wet: 0.3 }); for (let i = 0; i < 4; i++) hiss(rnd(0, 0.16), 0.014, rnd(0.03, 0.07), { f: rnd(2400, 6000), q: 4, pan: pan() }); },
      s3bossdown: () => { hiss(0, 1.2, 0.3, { type: 'lowpass', f: 3200, to: 120, wet: 0.6, pink: true }); osc('sine', 110, 0, 1.3, 0.3, { to: 24, wet: 0.4 }); osc('sawtooth', 220, 0, 1.1, 0.07, { to: 30, lp: 1200, lpTo: 80, wet: 0.5 }); for (let i = 0; i < 9; i++) hiss(0.1 + i * rnd(0.06, 0.12), 0.03, rnd(0.03, 0.08), { f: rnd(1400, 4200), q: 5, pan: rnd(-0.8, 0.8), wet: 0.4 }); },
      s3hurt: () => { osc('sawtooth', 320, 0, 0.18, 0.09, { to: 140, lp: 1400 }); osc('sine', 82, 0, 0.2, 0.2, { to: 44 }); },
      s3clang: () => { osc('sine', rnd(1400, 1650), 0, 0.12, 0.06, { fm: { ratio: 1.41, depth: 800 }, wet: 0.3 }); hiss(0, 0.02, 0.07, { f: 3000, q: 2 }); },
      s3swing: () => { hiss(0, 0.11, 0.07, { f: 650, to: 1900, q: 1.2, a: 0.03 }); },
      s3dash: () => { hiss(0, 0.17, 0.08, { f: 480, to: 2700, q: 1.3, a: 0.05, wet: 0.15 }); },
      // ----- 駭入、電、爆炸 -----
      s3hack: () => { const end = keypad(0, pick([4, 5]), 0.055); osc('sine', pick([1568, 1976]), end, 0.07, 0.035, { wet: 0.3, echo: 0.15 }); },
      s3deny: () => { osc('square', 165, 0, 0.06, 0.045, { crush: 0.5 }); osc('square', 150, 0.09, 0.08, 0.045, { crush: 0.5 }); },
      s3zap: () => { osc('square', rnd(1200, 1500), 0, 0.05, 0.03, { to: 600, crush: 0.5 }); for (let i = 0; i < 3; i++) hiss(i * 0.02, 0.012, rnd(0.04, 0.08), { type: 'highpass', f: rnd(3500, 6500), pan: pan() }); },
      s3shock: () => { osc('sawtooth', 105, 0, 0.32, 0.12, { to: 200, lp: 2400, fm: { ratio: 0.5, depth: 70 }, crush: 0.35 }); osc('sine', 72, 0, 0.3, 0.2, { to: 36 }); for (let i = 0; i < 9; i++) hiss(rnd(0, 0.28), 0.012, rnd(0.05, 0.12), { f: rnd(2500, 7000), q: 4, pan: rnd(-0.7, 0.7) }); },
      s3boom: () => { hiss(0, 0.04, 0.27, { f: 1600, q: 0.7, wet: 0.4 }); hiss(0, 0.7, 0.3, { type: 'lowpass', f: 3000, to: 150, wet: 0.5, pink: true }); osc('sine', 104, 0, 0.8, 0.3, { to: 27, wet: 0.35 }); for (let i = 0; i < 4; i++) hiss(0.14 + i * rnd(0.06, 0.12), 0.03, rnd(0.02, 0.05), { f: rnd(1400, 3600), q: 5, pan: rnd(-0.8, 0.8), wet: 0.4 }); },
      s3steam: () => { hiss(0, 1.3, 0.06, { type: 'highpass', f: 2400, a: 0.08, wet: 0.2 }); hiss(0, 0.5, 0.04, { f: 900, to: 2600, q: 1 }); },
      s3shriek: () => { osc('sine', 2400, 0, 0.36, 0.045, { to: 3150, fm: { ratio: 0.03, depth: 120 }, echo: 0.3, wet: 0.3 }); },
      s3rev: () => { rotor(0, 0.9, 0.06, { f: 82, rate: 24, lp: 620 }); hiss(0, 0.8, 0.04, { f: 300, to: 1200, q: 1, a: 0.3 }); },
      // ----- 其他 -----
      s3pick: () => { osc('sine', pick([1568, 1976, 2349]), 0, 0.045, 0.03, { wet: 0.2 }); },
      s3reload: () => { hiss(0, 0.02, 0.07, { f: 2400, q: 3 }); osc('sine', 310, 0, 0.03, 0.03); hiss(0.17, 0.02, 0.08, { f: 1900, q: 3 }); },
      s3wave: () => { osc('sawtooth', 392, 0, 0.16, 0.06, { lp: 1800, wet: 0.3 }); osc('sawtooth', 330, 0.18, 0.22, 0.06, { lp: 1800, wet: 0.3, echo: 0.2 }); },
      s3clear: () => { [659, 880, 1319].forEach((f, i) => osc('sine', f, i * 0.07, 0.3, 0.05, { wet: 0.5, echo: 0.2 })); },
      s3phase: () => { osc('sawtooth', 82, 0, 0.9, 0.13, { to: 50, lp: 700, detune: 16, wet: 0.4 }); osc('sine', 55, 0, 1, 0.24, { to: 34 }); hiss(0, 0.8, 0.08, { type: 'lowpass', f: 900, to: 200, pink: true, wet: 0.4 }); },
    };
    for (const [name, k] of Object.entries(LEVEL)) {
      const make = map[name];
      map[name] = () => { vol = k; try { make(); } finally { vol = 1; } };
    }
    return map;
  });

  // ===== 音樂 =====
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SCALE = [0, 3, 5, 7, 10, 12];
  const ROOTS = { calm: [45, 45, 41, 43], fight: [45, 45, 41, 43], boss: [45, 48, 41, 40] };
  const BASS = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
  const TEMPO = { calm: 104, fight: 116, boss: 126 };
  let mode = null, step = 0, nextAt = 0;

  function playStep(i, at) {
    const { osc, hiss, pick } = K;
    const bar = Math.floor(i / 16) % 4, st = i % 16, root = ROOTS[mode][bar];
    if (mode === 'calm') {
      if (st % 8 === 0) osc('sine', hz(root - 12), at, 0.5, 0.1, { a: 0.02 });
      if (st === 0) { osc('triangle', hz(root + 12), at, 2, 0.014, { a: 0.6, wet: 0.6, detune: 7 }); osc('triangle', hz(root + 19), at, 2, 0.009, { a: 0.8, wet: 0.6 }); }
      if (st % 4 === 2) hiss(at, 0.02, 0.01, { type: 'highpass', f: 6000 });
      if ((st === 6 || st === 14) && Math.random() < 0.5) osc('sine', hz(root + 24 + pick(SCALE)), at, 0.12, 0.016, { wet: 0.6, echo: 0.3, pan: Math.random() - 0.5 });
      return;
    }
    const boss = mode === 'boss';
    if (st % 4 === 0) osc('sine', 124, at, 0.13, 0.19, { to: 42 });
    if (st % 2 === 1 || boss) hiss(at, 0.024, st % 2 ? 0.02 : 0.012, { type: 'highpass', f: 7000 });
    if (st % 4 === 2) hiss(at, 0.06, 0.026, { type: 'highpass', f: 5500 });
    if (st === 4 || st === 12) { hiss(at, 0.09, 0.065, { f: 1900, q: 0.8, wet: 0.2 }); osc('triangle', 190, at, 0.06, 0.045, { to: 120 }); }
    if (boss && st >= 14 && bar === 3) osc('sine', st === 14 ? 150 : 110, at, 0.1, 0.12, { to: 60 });
    if (BASS[st]) osc('sawtooth', hz(root - 12 + (st % 8 === 7 ? 12 : 0)), at, 0.11, 0.065, { lp: st % 4 === 0 ? 900 : 520, crush: 0.2 });
    if ((boss || bar % 2 === 1) && st % 2 === 0) osc('square', hz(root + 12 + SCALE[(st / 2 + bar * 2) % SCALE.length]), at, 0.09, boss ? 0.024 : 0.02, { crush: 0.6, echo: 0.25, pan: Math.sin(i * 0.7) * 0.5 });
    if (boss && st === 0) osc('sawtooth', hz(root + 24), at, 0.5, 0.018, { lp: 2400, lpTo: 600, detune: 12, wet: 0.5 });
  }
  function tick() {
    if (!mode || !K) return;
    const now = sfx.now();
    if (now === null) return;
    if (nextAt < now) nextAt = now + 0.05;
    const len = 60 / TEMPO[mode] / 4;
    while (nextAt < now + 0.2) {
      try { playStep(step, nextAt - now); } catch (e) { /* 音樂失敗不影響遊戲 */ }
      nextAt += len;
      step++;
    }
  }
  if (typeof setInterval === 'function') setInterval(tick, 50);

  S3.music = {
    // null 關掉；'calm' 潛入、'fight' 警報、'boss' 首領。
    set(next) { if (next !== mode) { mode = next; step -= step % 16; } },
    get mode() { return mode; },
    // 測試用：排一步。
    test(m, i) { const keep = mode; mode = m; try { playStep(i, 0); } finally { mode = keep; } },
  };
})(window.ECHO = window.ECHO || {});
