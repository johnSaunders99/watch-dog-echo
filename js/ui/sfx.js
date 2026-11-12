// 合成音效：全部用 WebAudio 現場合成，沒有任何音檔，也沒有取樣任何遊戲的聲音。
// 風格是「駭客介面」：老電話的按鍵音、掃描、繼電器、馬達、電磁聲，還有會講話的機器人，再加上街頭的環境底噪。
// 訊號流程：每個聲音 → 乾聲／殘響／回音／數位顆粒（crush）→ 壓縮 → 輸出。環境音走另一條，音量可以單獨淡入淡出。
// 同一個聲音每次都會有一點變化（音高、順序、左右），聽起來才不會像同一段錄音一直重播。
(function (E) {
  const MUTE_KEY = 'watchdogs-echo.muted';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const DATA = [784, 988, 1175, 1319, 1568, 1976, 2349, 2637, 3136]; // 資料脈衝的音高

  let ctx = null;
  let R = null;        // 目前的訊號線路（離線測試時會換成另一條）
  let muted = false;
  let mood = null;     // 想要的環境音：null、'day'、'city'、'tac'
  let tension = 0;     // 0～1：戰術地圖的緊張程度（跟著警戒走）
  let amb = null;
  let flyTimer = null;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* 忽略 */ }

  // ===== 線路 =====
  function noiseBuffer(c, pink) {
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (!pink) { d[i] = w; continue; }
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return buf;
  }

  // 殘響：一段衰減的噪音當成空間（像巷子和地下室，不是教堂）。
  function impulse(c, secs) {
    const len = Math.floor(c.sampleRate * secs);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const fall = Math.pow(1 - i / len, 2.6);
        last = last * 0.55 + (Math.random() * 2 - 1) * 0.45; // 高頻衰得比較快
        d[i] = last * fall;
      }
    }
    return buf;
  }

  // 數位顆粒：把波形切成階梯。
  function crushCurve(steps) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

  function rig(c) {
    const master = c.createGain();
    master.gain.value = 1.3;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.16;
    master.connect(comp).connect(c.destination);

    const dry = c.createGain();
    dry.connect(master);

    const wet = c.createGain();
    wet.gain.value = 0.55;
    const verb = c.createConvolver();
    verb.buffer = impulse(c, 1.5);
    wet.connect(verb).connect(master);

    const echo = c.createGain();
    const delay = c.createDelay(1);
    delay.delayTime.value = 0.19;
    const back = c.createGain();
    back.gain.value = 0.34;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2600;
    echo.connect(delay).connect(damp).connect(back).connect(delay);
    damp.connect(master);
    damp.connect(wet);

    // 先放大再切階梯、切完再縮回來：不然小聲的脈衝全部會被切成零。
    const crush = c.createGain();
    crush.gain.value = 7;
    const steps = c.createWaveShaper();
    steps.curve = crushCurve(9);
    const crushOut = c.createGain();
    crushOut.gain.value = 0.17;
    crush.connect(steps).connect(crushOut).connect(master);

    return { c, master, dry, wet, echo, crush, white: noiseBuffer(c, false), pink: noiseBuffer(c, true) };
  }

  // 把一個聲音接到線路上。o：pan 左右、wet 殘響、echo 回音、crush 數位顆粒（0～1）。
  function route(node, o = {}) {
    const c = R.c;
    let tail = node;
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      tail = tail.connect(p);
    }
    const dry = o.crush ? 1 - o.crush : 1;
    if (dry > 0) tail.connect(R.dry);
    const tap = (bus, amount) => {
      if (!amount) return;
      const g = c.createGain();
      g.gain.value = amount;
      tail.connect(g).connect(bus);
    };
    tap(R.wet, o.wet);
    tap(R.echo, o.echo);
    tap(R.crush, o.crush);
  }

  // 一個音。o：to 滑到哪個音高、a 起音、type2/detune 再疊一個音、fm 調頻（{ ratio, depth }）、lp 低通。
  function osc(type, freq, at, dur, vol, o = {}) {
    const c = R.c;
    const t = c.currentTime + at;
    const g = c.createGain();
    const a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.002));
    let head = g;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      f.Q.value = o.q || 1;
      if (o.lpTo) {
        f.frequency.setValueAtTime(o.lp, t);
        f.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur);
      }
      f.connect(g);
      head = f;
    }
    const voice = (detune) => {
      const v = c.createOscillator();
      v.type = type;
      v.frequency.setValueAtTime(freq, t);
      if (o.to) v.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur);
      if (detune) v.detune.value = detune;
      if (o.fm) {
        const m = c.createOscillator();
        const mg = c.createGain();
        m.frequency.value = freq * o.fm.ratio;
        mg.gain.value = o.fm.depth;
        m.connect(mg).connect(v.frequency);
        m.start(t);
        m.stop(t + dur + 0.05);
      }
      v.connect(head);
      v.start(t);
      v.stop(t + dur + 0.05);
    };
    voice(0);
    if (o.detune) voice(o.detune);
    route(g, o);
  }

  // 一段噪音。o：type 濾波種類、f 頻率、to 掃到哪個頻率、q、a 起音、pink 比較悶的噪音。
  function hiss(at, dur, vol, o = {}) {
    const c = R.c;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = o.pink ? R.pink : R.white;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    const a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.002));
    src.connect(f).connect(g);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    route(g, o);
  }

  // 一串資料脈衝：從左掃到右（reverse 就反過來）。
  function burst(at, n, gap, vol, o = {}) {
    for (let i = 0; i < n; i++) {
      const p = i / Math.max(1, n - 1);
      osc(o.type || 'square', pick(DATA) * (o.octave || 1), at + i * gap + rnd(0, gap * 0.25), gap * 0.8, vol, { pan: (o.reverse ? 0.8 - 1.6 * p : -0.8 + 1.6 * p), crush: o.crush === undefined ? 0.7 : o.crush, echo: o.echo || 0 });
    }
  }

  // 馬達或旋翼：幾個差一點點的鋸齒波，用低通蓋住，再用快速的音量起伏做出轉動感。
  function rotor(at, dur, vol, o = {}) {
    const c = R.c;
    const t = c.currentTime + at;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.12, dur / 3));
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const trem = c.createGain();
    trem.gain.value = 0.6;
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = o.rate || 34;
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(trem.gain);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lp || 1100;
    for (const d of [0, 7, -9]) {
      const v = c.createOscillator();
      v.type = 'sawtooth';
      v.frequency.value = o.f || 165;
      v.detune.value = d;
      v.connect(lp);
      v.start(t);
      v.stop(t + dur + 0.05);
    }
    lp.connect(trem).connect(g);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    if (o.panFrom !== undefined && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(o.panFrom, t);
      p.pan.linearRampToValueAtTime(o.panTo || 0, t + dur);
      g.connect(p);
      route(p, { wet: o.wet });
    } else route(g, o);
  }

  // 老電話的按鍵音：每一鍵是一高一低兩個頻率同時響，按得很快。
  // 音高跟著一條上下起伏的線走，再加一點隨機，每一鍵還會稍微滑一下，聽起來才不會平平的。回傳按完的時間。
  const KEY_LOW = [697, 770, 852, 941];
  const KEY_HIGH = [1209, 1336, 1477];
  function keypad(at, n, vol = 0.07) {
    let t = at;
    const phase = rnd(0, 6.28), speed = rnd(0.95, 1.5);
    for (let i = 0; i < n; i++) {
      const dur = rnd(0.026, 0.044);
      const bend = Math.pow(2, Math.sin(phase + i * speed) * 0.6 + rnd(-0.14, 0.14));
      const slide = rnd(0.9, 1.12);
      const low = pick(KEY_LOW) * bend, high = pick(KEY_HIGH) * bend;
      osc('sine', low, t, dur, vol, { to: low * slide, a: 0.002, crush: 0.12, wet: 0.04 });
      osc('sine', high, t, dur, vol * 0.8, { to: high * slide, a: 0.002, crush: 0.12, wet: 0.04 });
      hiss(t, 0.004, 0.02, { f: 3000, q: 2 }); // 按鍵本身的喀一聲
      t += dur + rnd(0.005, 0.022);
    }
    return t;
  }

  // 機器人講話：鋸齒波當聲帶，三個帶通濾波器當口腔，每個音節滑到對應的母音；子音是一小段噪音。
  // 聽不出字，只留下說話的語氣和音高起伏。
  const VOWEL = { i: [300, 2300, 3000], ih: [400, 2000, 2550], eh: [550, 1800, 2480], ae: [680, 1700, 2400], uh: [640, 1200, 2400], oo: [320, 870, 2240], ah: [760, 1150, 2500] };
  const CONSONANT = {
    f: (t) => hiss(t, 0.05, 0.05, { type: 'highpass', f: 3800 }),
    sh: (t) => hiss(t, 0.08, 0.075, { f: 2800, q: 1.4 }),
    th: (t) => hiss(t, 0.03, 0.03, { type: 'highpass', f: 4500 }),
    t: (t) => hiss(t, 0.016, 0.1, { f: 3600, q: 1.5 }),
    k: (t) => hiss(t, 0.02, 0.11, { f: 1900, q: 1.5 }),
    p: (t) => hiss(t, 0.016, 0.1, { type: 'lowpass', f: 900 }),
  };
  // sounds：[{ v: 母音, d: 長度, p: 音高, to: 滑到的音高, pre: 前面的子音, post: 後面的子音, gap: 後面的空檔 }]
  function speak(at, syllables, o = {}) {
    const c = R.c;
    const start = c.currentTime + at;
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    const voice = c.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(syllables[0].p, start);
    const vib = c.createOscillator();
    const vibDepth = c.createGain();
    vib.frequency.value = 7.5;
    vibDepth.gain.value = 9;
    vib.connect(vibDepth).connect(voice.frequency);
    const mouth = [0, 1, 2].map((i) => {
      const b = c.createBiquadFilter();
      const g = c.createGain();
      b.type = 'bandpass';
      b.Q.value = [7, 10, 12][i];
      b.frequency.setValueAtTime(VOWEL[syllables[0].v][i], start);
      g.gain.value = [1.5, 1, 0.5][i];
      voice.connect(b).connect(g).connect(amp);
      return b;
    });
    const lv = o.vol || 0.3;
    let t = at;
    for (const s of syllables) {
      if (s.pre) { CONSONANT[s.pre](t); t += s.pre === 'sh' ? 0.07 : s.pre === 'f' ? 0.04 : 0.018; }
      const on = c.currentTime + t;
      voice.frequency.exponentialRampToValueAtTime(s.p, on + 0.025);
      if (s.to) voice.frequency.exponentialRampToValueAtTime(s.to, on + s.d);
      VOWEL[s.v].forEach((hz, i) => mouth[i].frequency.linearRampToValueAtTime(hz, on + 0.03));
      amp.gain.linearRampToValueAtTime(lv, on + 0.018);
      amp.gain.setValueAtTime(lv, on + s.d * 0.75);
      amp.gain.linearRampToValueAtTime(s.gap === 0 ? lv : 0.0001, on + s.d);
      t += s.d;
      if (s.post) CONSONANT[s.post](t);
      t += s.gap === undefined ? 0.03 : s.gap;
    }
    const end = c.currentTime + t + 0.1;
    voice.start(start);
    vib.start(start);
    voice.stop(end);
    vib.stop(end);
    route(amp, { crush: 0.3, wet: 0.14, echo: 0.1 });
    return t;
  }
  // 謝爾蓋會說的話：只有語氣。第一句是拉長的「耶～」接一串興奮的短句。
  const SERGEI = [
    [{ v: 'i', d: 0.06, p: 210, gap: 0 }, { v: 'eh', d: 0.16, p: 310, gap: 0 }, { v: 'ae', d: 0.26, p: 280, to: 215, gap: 0.09 },
      { pre: 'f', v: 'uh', d: 0.1, p: 235, post: 'k' }, { pre: 'th', v: 'ae', d: 0.1, p: 255, post: 't' }, { pre: 'sh', v: 'ih', d: 0.1, p: 285, post: 't' }, { v: 'uh', d: 0.34, p: 330, to: 205, post: 'p', gap: 0.03 }],
    [{ v: 'ah', d: 0.14, p: 250, gap: 0 }, { v: 'eh', d: 0.2, p: 330, to: 270, gap: 0.08 }, { pre: 'k', v: 'ih', d: 0.09, p: 300 }, { pre: 't', v: 'uh', d: 0.09, p: 260 }, { v: 'oo', d: 0.3, p: 320, to: 200 }],
    [{ pre: 'sh', v: 'ih', d: 0.11, p: 240, post: 't' }, { v: 'i', d: 0.05, p: 230, gap: 0 }, { v: 'eh', d: 0.3, p: 320, to: 225, gap: 0.05 }, { v: 'uh', d: 0.12, p: 210 }, { v: 'ae', d: 0.28, p: 300, to: 190 }],
  ];

  // 突然斷電：環境音一下子全沒了，過一會兒才慢慢回來。
  function cutPower(at) {
    if (!amb || R.c !== ctx) return;
    const t = ctx.currentTime + at;
    const p = amb.bus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0, t);
    p.setTargetAtTime(muted ? 0 : 1, t + 1.5, 0.7);
  }

  // ===== 聲音 =====
  const sounds = {
    // ----- 介面 -----
    click: () => { osc('sine', rnd(1900, 2300), 0, 0.022, 0.05); hiss(0, 0.012, 0.03, { f: 5200, q: 2 }); },
    blip: () => { osc('sine', pick([1319, 1568]), 0, 0.06, 0.05, { wet: 0.08 }); },
    event: () => { osc('sine', 880, 0, 0.1, 0.05, { wet: 0.3 }); osc('sine', 1319, 0.09, 0.16, 0.05, { wet: 0.4, echo: 0.2 }); hiss(0, 0.05, 0.012, { f: 4200 }); },
    turn: () => { hiss(0, 0.42, 0.05, { f: 260, to: 1500, q: 1.4, a: 0.14, wet: 0.2 }); osc('sine', 72, 0.02, 0.2, 0.09, { to: 48 }); },
    // ----- 掃描、駭入 -----
    prof: () => {
      osc('sine', 1200, 0, 0.18, 0.035, { to: 2900, fm: { ratio: 3.01, depth: 240 }, wet: 0.2 });
      burst(0.02, 5, 0.03, 0.012, { octave: 1.5, crush: 0.5 });
      osc('sine', 1760, 0.2, 0.05, 0.04, { wet: 0.25 });
      osc('sine', 2349, 0.25, 0.09, 0.04, { wet: 0.35, echo: 0.2 });
    },
    // 開始駭入：撥號音，再按幾個鍵。
    link: () => {
      osc('sine', 350, 0, 0.22, 0.1, { a: 0.01 });
      osc('sine', 440, 0, 0.22, 0.1, { a: 0.01 });
      keypad(0.24, 6);
    },
    // 駭入成功：老電話的按鍵音亂按一串。
    hack: () => {
      const end = keypad(0, 11 + Math.floor(rnd(0, 5)));
      hiss(0, end, 0.008, { f: 1800, q: 0.7 }); // 電話線的雜音
      osc('sine', 118, end, 0.1, 0.1, { to: 60 });
    },
    // 駭入失敗：按到一半，電話線忙線。
    hackFail: () => {
      const end = keypad(0, 6);
      for (let i = 0; i < 2; i++) {
        osc('sine', 480, end + 0.04 + i * 0.22, 0.12, 0.06, { a: 0.006 });
        osc('sine', 620, end + 0.04 + i * 0.22, 0.12, 0.06, { a: 0.006 });
      }
    },
    // ----- 門、攝影機、無人機 -----
    door: () => {
      hiss(0, 0.018, 0.16, { f: 3400, q: 3 });
      osc('sine', 118, 0.006, 0.09, 0.2, { to: 54 });
      osc('sawtooth', 340, 0.05, 0.13, 0.03, { to: 720, lp: 1500 });
      hiss(0.17, 0.02, 0.1, { f: 2500, q: 4, wet: 0.2 });
    },
    lock: () => {
      osc('sawtooth', 720, 0, 0.12, 0.016, { to: 300, lp: 1500 });
      hiss(0.12, 0.022, 0.1, { f: 2100, q: 3 });
      osc('sine', 96, 0.125, 0.16, 0.17, { to: 42, wet: 0.2 });
    },
    crash: () => {
      hiss(0, 0.2, 0.2, { type: 'lowpass', f: 1500, to: 240, wet: 0.35, pink: true });
      osc('sine', 104, 0, 0.26, 0.24, { to: 36, wet: 0.2 });
      for (let i = 0; i < 4; i++) hiss(0.08 + i * rnd(0.04, 0.07), 0.024, rnd(0.02, 0.05), { f: rnd(1800, 4200), q: 5, pan: rnd(-0.6, 0.6), wet: 0.3 });
    },
    camOff: () => {
      osc('sine', 1900, 0, 0.24, 0.09, { to: 110, crush: 0.3 });
      hiss(0, 0.2, 0.05, { f: 3000, to: 300, q: 3 });
      osc('square', 60, 0.2, 0.03, 0.09, { lp: 500 });
    },
    droneJam: () => {
      rotor(0, 0.34, 0.05, { f: 210, rate: 42, lp: 1500 });
      burst(0.04, 7, 0.032, 0.018, { reverse: true });
      osc('sawtooth', 620, 0.14, 0.2, 0.024, { to: 150, lp: 1400 });
    },
    // 謝爾蓋：工程無人機飛過去，一邊興奮地講話。
    sergei: () => {
      const line = pick(SERGEI);
      rotor(0, 1.5, 0.018, { f: 150, rate: 38, lp: 900, panFrom: -0.4, panTo: 0.4 });
      speak(0.05, line);
    },
    // 老鷹無人機：電磁聲越來越急，然後爆炸。
    emp: () => {
      const boom = 0.62;
      osc('sawtooth', 100, 0, boom, 0.13, { to: 210, a: boom - 0.03, lp: 2400, fm: { ratio: 0.5, depth: 70 }, crush: 0.35 });
      osc('square', 200, 0.05, boom - 0.05, 0.05, { to: 620, a: boom - 0.09, lp: 3200, detune: 18 });
      for (let i = 0; i < 12; i++) hiss(rnd(0.04, boom), 0.012, rnd(0.05, 0.13), { f: rnd(2500, 7000), q: 4, pan: rnd(-0.7, 0.7) }); // 電弧的劈啪聲
      hiss(boom, 0.05, 0.3, { f: 1600, q: 0.7, wet: 0.5 });
      hiss(boom, 0.85, 0.34, { type: 'lowpass', f: 3400, to: 160, wet: 0.6, pink: true });
      osc('sine', 112, boom, 1.05, 0.34, { to: 26, wet: 0.45 });
      for (let i = 0; i < 6; i++) hiss(boom + 0.14 + i * rnd(0.06, 0.13), 0.03, rnd(0.02, 0.05), { f: rnd(1400, 3800), q: 5, pan: rnd(-0.8, 0.8), wet: 0.45 }); // 碎片
    },
    // 大停電：比駭入長得多的一串按鍵，然後總開關跳掉，環境音跟著斷掉。
    blackout: () => {
      const end = keypad(0, 28);
      hiss(0, end, 0.01, { f: 1800, q: 0.7 });
      hiss(end, 0.03, 0.34, { f: 2100, q: 1.6, wet: 0.5 });           // 斷閘
      osc('sine', 78, end, 0.26, 0.34, { to: 30, wet: 0.35 });
      osc('sine', 410, end, 0.2, 0.09, { fm: { ratio: 2.76, depth: 240 }, wet: 0.5 }); // 金屬的餘音
      osc('sawtooth', 100, end, 0.75, 0.08, { to: 22, lp: 1000, lpTo: 70, wet: 0.5 }); // 電慢慢沒了
      hiss(end + 0.22, 0.03, 0.07, { f: 1500, q: 3, pan: -0.6, wet: 0.5 });
      hiss(end + 0.36, 0.03, 0.05, { f: 1300, q: 3, pan: 0.6, wet: 0.5 });
      cutPower(end);
    },
    // ----- 被發現、動手 -----
    spotted: () => {
      osc('sawtooth', 466, 0, 0.34, 0.11, { lp: 2600, lpTo: 500, detune: 12, wet: 0.45 });
      osc('sawtooth', 494, 0, 0.34, 0.1, { lp: 2600, lpTo: 500, wet: 0.45 });
      hiss(0, 0.05, 0.18, { f: 2400, q: 1, wet: 0.3 });
      osc('sine', 62, 0, 0.26, 0.26, { to: 38 });
    },
    // 有人聽到聲音：金屬碰撞的短音。
    noise: () => {
      osc('sine', 1240, 0, 0.26, 0.09, { fm: { ratio: 1.41, depth: 700 }, wet: 0.5, echo: 0.2 });
      hiss(0, 0.03, 0.14, { f: 2600, q: 2, wet: 0.4 });
    },
    // 鐵鎚：金屬重擊，接著零件散落。
    smash: () => {
      osc('sine', 150, 0, 0.16, 0.26, { to: 46 });
      hiss(0, 0.04, 0.22, { f: 2200, q: 1.2, wet: 0.35 });
      osc('sine', 720, 0, 0.3, 0.07, { fm: { ratio: 2.4, depth: 420 }, wet: 0.5 });
      for (let i = 0; i < 4; i++) hiss(0.08 + i * rnd(0.04, 0.08), 0.02, rnd(0.02, 0.05), { f: rnd(2000, 4500), q: 5, pan: rnd(-0.6, 0.6), wet: 0.3 });
    },
    takedown: () => {
      osc('sine', 150, 0, 0.17, 0.26, { to: 44 });
      hiss(0, 0.05, 0.1, { type: 'lowpass', f: 1000, pink: true });
      hiss(0.11, 0.09, 0.05, { type: 'lowpass', f: 420, to: 200, pink: true, wet: 0.25 });
    },
    step: () => { hiss(0, 0.05, 0.14, { type: 'lowpass', f: 420, pink: true }); hiss(0.11, 0.05, 0.11, { type: 'lowpass', f: 360, pink: true }); },
    alarm: () => {
      for (let i = 0; i < 2; i++) {
        const t = i * 0.5;
        osc('sawtooth', 520, t, 0.25, 0.11, { to: 910, lp: 2400, echo: 0.25, wet: 0.25 });
        osc('sawtooth', 910, t + 0.25, 0.25, 0.11, { to: 520, lp: 2400, echo: 0.25, wet: 0.25 });
      }
      osc('sine', 62, 0, 0.9, 0.08, { to: 48 });
    },
    // ----- 結果 -----
    gain: () => { osc('sine', 1047, 0, 0.3, 0.08, { wet: 0.4 }); osc('sine', 1568, 0.05, 0.36, 0.055, { wet: 0.5, echo: 0.15 }); },
    loss: () => { osc('sawtooth', 300, 0, 0.42, 0.05, { to: 118, lp: 900, detune: 14, wet: 0.3 }); osc('sine', 75, 0, 0.42, 0.1, { to: 42 }); },
    win: () => {
      burst(0, 7, 0.028, 0.02);
      [523, 784, 1047].forEach((f, i) => osc('triangle', f, 0.14 + i * 0.09, 0.7, 0.05, { wet: 0.55, echo: 0.25, a: 0.01 }));
      osc('sine', 65, 0.14, 0.5, 0.14, { to: 48 });
    },
    fail: () => {
      sounds.hackFail();
      [311, 233, 185].forEach((f, i) => osc('sawtooth', f, 0.2 + i * 0.14, 0.6, 0.04, { lp: 900, lpTo: 200, detune: 10, wet: 0.5 }));
      osc('sine', 52, 0.2, 0.9, 0.14, { to: 30 });
    },
    // ----- 演出 -----
    title: () => {
      osc('sine', 52, 0, 1.7, 0.34, { to: 34, wet: 0.3 });
      hiss(0, 1.1, 0.05, { f: 240, to: 3000, q: 1.6, a: 0.6, crush: 0.3, wet: 0.4 });
      osc('sawtooth', 110, 0.05, 1.4, 0.035, { lp: 300, lpTo: 1500, detune: 9, wet: 0.5 });
      burst(0.72, 10, 0.03, 0.02, { echo: 0.25 });
    },
    bleed: () => { [220, 277, 330, 440].forEach((f, i) => osc('sine', f, i * 0.12, 2.4, 0.04, { a: 0.3, detune: 6, wet: 0.7, echo: 0.2 })); hiss(0, 2.2, 0.012, { f: 700, to: 3000, q: 4, a: 0.8, wet: 0.5 }); },
    desync: () => {
      for (let i = 0; i < 9; i++) hiss(i * rnd(0.04, 0.08), 0.04, rnd(0.08, 0.2), { f: rnd(300, 5000), q: 3, pan: rnd(-0.8, 0.8), crush: 0.8 });
      osc('sawtooth', 620, 0, 0.62, 0.07, { to: 54, crush: 0.5 });
      osc('square', 88, 0, 0.82, 0.05, { to: 36, lp: 500 });
    },
    // 客串角色登場：訊號被人接管。
    cameo: () => {
      hiss(0, 0.5, 0.05, { f: 400, to: 3600, q: 5, crush: 0.7 });
      burst(0.02, 11, 0.03, 0.022, { echo: 0.2 });
      osc('sawtooth', 110, 0.2, 1, 0.04, { to: 220, lp: 700, lpTo: 2200, detune: 8, wet: 0.5 });
      osc('sine', 440, 0.5, 0.8, 0.05, { wet: 0.6, a: 0.04 });
      osc('sine', 660, 0.62, 0.9, 0.04, { wet: 0.6, echo: 0.2, a: 0.04 });
    },
    // 不屬於這裡的地方：又慢又遠的鈴聲（音高每次都隨機，不是任何一段旋律）。
    dream: () => {
      const notes = [392, 466, 523, 587, 698, 784];
      for (let i = 0; i < 4; i++) osc('sine', pick(notes), i * 0.36, 1.7, 0.05, { fm: { ratio: 3.5, depth: 90 }, wet: 0.85, echo: 0.3, a: 0.01 });
      osc('sine', 98, 0, 1.9, 0.06, { a: 0.4, wet: 0.5 });
    },
    ending: () => { [196, 247, 294, 392].forEach((f, i) => osc('triangle', f, i * 0.25, 3, 0.05, { a: 0.1, detune: 5, wet: 0.7, echo: 0.2 })); osc('sine', 49, 0, 3.2, 0.1, { a: 0.5, wet: 0.4 }); },
  };

  // ===== 環境音 =====
  // 低頻的城市底噪、一點電力的嗡嗡聲；戰術地圖多一層跟著警戒走的脈動。
  // 試玩的回饋是底噪太吵：白天完全安靜；高頻的雜訊（air）整層拿掉，低頻的底噪也調小。
  const LEVELS = {
    day: { rumble: 0, hum: 0, air: 0, pulse: 0 },
    city: { rumble: 0.035, hum: 0.01, air: 0, pulse: 0 },
    tac: { rumble: 0.03, hum: 0.01, air: 0, pulse: 0.05 },
  };
  function buildAmbient() {
    const c = ctx;
    const bus = c.createGain();
    bus.gain.value = muted ? 0 : 1;
    bus.connect(R.master);
    const loop = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const level = () => { const g = c.createGain(); g.gain.value = 0; g.connect(bus); return g; };

    const rumble = level();
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 280;
    loop(R.pink).connect(low).connect(rumble);

    const air = level();
    const high = c.createBiquadFilter();
    high.type = 'bandpass';
    high.frequency.value = 3800;
    high.Q.value = 0.6;
    loop(R.white).connect(high).connect(air);

    const hum = level();
    for (const [f, v] of [[50, 1], [100, 0.5], [150, 0.18]]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = f;
      g.gain.value = v;
      o.connect(g).connect(hum);
      o.start();
    }

    // 脈動：低音的音量被慢慢推拉，像心跳。
    const pulse = level();
    const beat = c.createGain();
    beat.gain.value = 0.5;
    const sub = c.createOscillator();
    sub.frequency.value = 52;
    sub.connect(beat).connect(pulse);
    sub.start();
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.8;
    const depth = c.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(beat.gain);
    lfo.start();

    amb = { bus, rumble, air, hum, pulse, lfo, low };
  }
  function applyAmbient() {
    if (!ctx) return;
    if (!amb) buildAmbient();
    const L = LEVELS[mood] || { rumble: 0, hum: 0, air: 0, pulse: 0 };
    const t = ctx.currentTime;
    const to = (p, v, tau = 1.1) => p.setTargetAtTime(v, t, tau);
    to(amb.rumble.gain, L.rumble * (1 + tension * 0.5));
    to(amb.hum.gain, L.hum);
    to(amb.air.gain, L.air * (1 + tension * 1.5));
    to(amb.pulse.gain, L.pulse * (0.4 + tension * 1.6));
    to(amb.lfo.frequency, 0.7 + tension * 1.5, 0.6);
    to(amb.low.frequency, 260 + tension * 260);
  }
  // 遠處偶爾有無人機飛過。
  function scheduleFlyby() {
    clearTimeout(flyTimer);
    if (!mood || mood === 'day') return;
    flyTimer = setTimeout(() => {
      if (ctx && !muted && mood && !(typeof document !== 'undefined' && document.hidden)) {
        const from = pick([-0.9, 0.9]);
        try { rotor(0, rnd(3.2, 5), 0.009, { f: rnd(120, 180), rate: rnd(26, 40), lp: 700, panFrom: from, panTo: -from, wet: 0.6 }); } catch (e) { /* 音效失敗不影響遊戲 */ }
      }
      scheduleFlyby();
    }, rnd(16000, 34000));
  }

  const sfx = {
    names: Object.keys(sounds),
    unlock() {
      if (ctx) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        R = rig(ctx);
        if (mood) { applyAmbient(); scheduleFlyby(); }
      } catch (e) { ctx = null; }
    },
    play(name) {
      if (muted || !ctx || !sounds[name]) return;
      try { if (ctx.state === 'suspended') ctx.resume(); sounds[name](); } catch (e) { /* 音效失敗不影響遊戲 */ }
    },
    // 環境音：null 關掉，'day'、'city'、'tac'。level 是 0～1 的緊張程度。
    ambient(next, level = 0) {
      const changed = next !== mood;
      mood = next;
      tension = Math.max(0, Math.min(1, level));
      if (!ctx) return;
      try { applyAmbient(); if (changed) scheduleFlyby(); } catch (e) { /* 音效失敗不影響遊戲 */ }
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* 忽略 */ }
      if (amb) amb.bus.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
      return muted;
    },
    // 其他頁面可以加自己的聲音（第三季的在 js/s3/sounds.js）：make 拿到合成用的工具，回傳 { 名稱: 函式 }。
    add(make) {
      Object.assign(sounds, make({ osc, hiss, burst, rotor, keypad, speak, rnd, pick }));
      sfx.names = Object.keys(sounds);
    },
    // 排音樂用：聲音開著的時候回傳現在的時間，不然是 null。
    now() { return ctx && !muted && ctx.state === 'running' ? ctx.currentTime : null; },
    // 測試用：在離線的 context 裡合成一個聲音，回傳波形。
    async render(name, secs = 3) {
      const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const off = new Off(2, Math.floor(44100 * secs), 44100);
      const keep = R;
      R = rig(off);
      try { sounds[name](); } finally { R = keep; }
      return off.startRendering();
    },
  };

  // 分頁切到背景就暫停，回來再繼續。
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch (e) { /* 忽略 */ }
    });
  }

  E.sfx = sfx;
})(window.ECHO = window.ECHO || {});
