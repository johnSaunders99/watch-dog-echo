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

// 這一段是新增音效與《零時差》的播放清單。回歸的項目只指向原配方，不複製或重新混音。
(function (S, sfx) {
  const cues=[], byKey=Object.create(null);
  function list(group,key,id,label,restored,previous=null) {
    const cue={group,key,id,label,restored,previous};
    byKey[key]=cue; cues.push(cue);
  }
  const back=(group,key,id,label)=>list(group,key,id,label,true);
  back("guns","pistol","s3gun","s3.wp.pistol.n");
  back("guns","taser","s3taser","s3.wp.taser.n");
  back("guns","shotgun","s3shotgun","s3.wp.shotgun.n");
  back("guns","nailgun","s3nail","s3.wp.nailgun.n");
  back("guns","silenced","s3silenced","s3.wp.silenced.n");
  back("guns","match","s3silenced","s3.wp.match.n");
  back("gear","sergei","sergei","s3.gad.sergei.n");
  back("gear","escort","droneJam","s3.gad.escort.n");
  back("gear","expert","droneJam","s3.gad.expert.n");
  back("gear","spider","droneJam","s3.gad.spider.n");
  back("gear","kamikaze","emp","s3.gad.kamikaze.n");
  back("gear","eagle","prof","s3.gad.eagle.n");
  back("gear","eaglePulse","s3shock",["老鷹：自爆脈衝","老鹰：自爆脉冲","Eagle · EMP discharge"]);
  back("gear","blackout","blackout","s3.gad.blackout.n");
  back("gear","hammer","smash","s3.gad.hammer.n");
  back("gear","sledge","smash","s3.gad.sledge.n");
  back("gear","mask","dream","s3.gad.mask.n");
  back("gear","lure","s3shriek","s3.gad.lure.n");
  back("gear","mine","lock","s3.gad.mine.n");
  back("gear","strike","lock","s3.gad.strike.n");
  back("gear","brawl","s3wave","s3.gad.brawl.n");
  back("gear","swarm","s3shriek","s3.gad.swarm.n");
  back("gear","hypnosis","dream","s3.gad.hypnosis.n");
  back("gear","eightball","s3swing","s3.gad.eightball.n");
  back("field","hack","s3hack",["駭入接通","入侵接通","Hack accepted"]);
  back("field","denied","s3deny",["操作受阻","操作受阻","Access denied"]);
  back("field","zap","s3zap",["短路","短路","Short circuit"]);
  back("field","arc","s3zap",["電弧連鎖","电弧连锁","Arc jump"]);
  back("field","shock","s3shock",["電擊陷阱","电击陷阱","Shock trap"]);
  back("field","steam","s3steam",["蒸汽閥","蒸汽阀","Steam valve"]);
  back("field","boom","s3boom",["爆炸","爆炸","Blast"]);
  back("field","rev","s3rev",["引擎加速","引擎加速","Engine rev"]);
  back("field","crash","crash",["車身撞擊","车身撞击","Vehicle impact"]);
  back("field","hijack","droneJam",["接管機械","接管机械","Machine hijack"]);
  back("field","raise","lock",["路障升起","路障升起","Barrier raised"]);
  back("field","breach","camOff",["中繼器離線","中继器离线","Relay offline"]);
  back("field","mark","prof",["標記目標","标记目标","Target marked"]);
  back("field","shriek","s3shriek",["場地喇叭誘敵","场地喇叭诱敌","Site loudspeaker decoy"]);
  back("combat","eshot","s3eshot",["敵方射擊","敌方射击","Hostile fire"]);
  back("combat","escortFire","s3nail",["護航機開火","护航机开火","Escort fire"]);
  back("combat","expertFire","s3nail",["重型護航機開火","重型护航机开火","Heavy escort fire"]);
  back("combat","allyFire","s3nail",["劫持機械開火","劫持机械开火","Hijacked machine fire"]);
  back("combat","spiderFire","s3nail",["蜘蛛砲塔開火","蜘蛛炮塔开火","Spider turret fire"]);
  back("combat","snipe","s3snipe",["狙擊","狙击","Sniper shot"]);
  back("combat","lob","s3lob",["拋射","抛射","Mortar launch"]);
  back("combat","hit","s3hit",["命中","命中","Hit confirmed"]);
  back("combat","kill","s3kill",["敵人倒下","敌人倒下","Enemy down"]);
  back("combat","scrap","s3scrap",["機械解體","机械解体","Machine disabled"]);
  back("combat","bossdown","s3bossdown",["首領倒下","首领倒下","Boss defeated"]);
  back("combat","hurt","s3hurt",["隊員受傷","队员受伤","Operative hurt"]);
  back("combat","clang","s3clang",["擊中裝甲","击中装甲","Armour impact"]);
  back("combat","guard","s3clang",["護盾攔下","护盾拦下","Shield block"]);
  back("combat","spotted","spotted",["被發現","被发现","Spotted"]);
  back("combat","alarm","alarm",["全房警報","全房警报","Room alarm"]);
  back("combat","wave","s3wave",["增援接近","增援接近","Reinforcements"]);
  back("combat","phase","s3phase",["首領換階段","首领换阶段","Boss phase"]);
  back("combat","takedown","takedown",["無聲制伏","无声制服","Silent takedown"]);
  back("combat","swing","s3swing",["揮擊與撲擊","挥击与扑击","Swing / lunge"]);
  back("combat","dash","s3dash",["衝刺","冲刺","Dash"]);
  back("combat","sneeze","noise",["噴嚏暴露位置","喷嚏暴露位置","Sneeze"]);
  back("ui","click","click",["選取","选取","Select"]);
  back("ui","title","title",["開始行動","开始行动","Deploy"]);
  back("ui","swap","s3dash",["切換隊員","切换队员","Switch operative"]);
  back("ui","down","desync",["隊員倒下","队员倒下","Operative down"]);
  back("ui","getaway","bleed",["撤離","撤离","Getaway"]);
  back("ui","revive","bleed",["重新站起","重新站起","Revive"]);
  back("ui","pick","s3pick",["拾取資料","拾取数据","Data pickup"]);
  back("ui","gain","gain",["取得補給","获得补给","Supplies gained"]);
  back("ui","reload","s3reload",["更換彈匣","更换弹匣","Reload"]);
  back("ui","clear","s3clear",["房間淨空","房间肃清","Room clear"]);
  back("ui","door","door",["穿過房門","穿过房门","Door"]);
  back("ui","event","event",["發現事件","发现事件","Encounter"]);
  back("ui","dream","dream",["異常訊號","异常信号","Strange signal"]);
  back("ui","cameo","cameo",["客串來訊","客串来讯","Contact calling"]);
  back("ui","ending","ending",["行動完成","行动完成","Campaign complete"]);
  back("ui","loss","loss",["放棄行動","放弃行动","Withdraw"]);
  back("ui","fail","fail",["行動失敗","行动失败","Run lost"]);
  byKey.fallback={id:'blip'};

  // Model the contact first: each material is an impulse exciting a few inharmonic resonances.
  // A fresh strike varies as a unit; its bolt, glass chips, etc. still belong to the same object.
  const modes={
    wood:  [[1,1,1],[2.74,.39,.58],[5.12,.14,.32]],
    steel: [[1,.70,1],[1.48,.48,.76],[2.67,.27,.52],[4.16,.13,.28]],
    glass: [[1,.64,1],[2.32,.47,.68],[3.81,.20,.46]],
    shell: [[1,1,1],[1.68,.41,.63],[3.07,.19,.33]]
  };
  function materials(kit) {
    const {rnd}=kit, pitch=rnd(.964,1.037), time=rnd(.96,1.045), level=rnd(.955,1.035);
    const osc=(w,f,t,d,v,o={})=>kit.osc(w,f*pitch,t*time,d*time,v*level,
      {...o,...(o.to?{to:o.to*pitch}:{}),a:(o.a||.0018)*time});
    const grain=(t,d,f,v,o={})=>kit.hiss(t*time,d*time,v*level,
      {f:f*pitch,q:.85,...o,a:(o.a||.0015)*time});
    const ring=(mat,t,f,v,d,pan=0)=>modes[mat].forEach(([ratio,gain,tail])=>
      osc('sine',f*ratio,t,d*tail,v*gain,{pan}));
    const thud=(t,f,v,d,pan=0)=>osc('sine',f,t,d,v,{to:f*.40,a:.003,pan});
    const tick=(t,f,v,pan=0)=>{
      grain(t,.012,f*2.8,v*1.4,{type:'highpass',pan});
      ring('steel',t+.001,f,v,.038,pan);
    };
    const wood=(t,f,v,d=.12,pan=0)=>{
      grain(t,.022,f*3.7,v*.75,{pink:true,pan});
      ring('wood',t,f,v,d,pan);
    };
    const blades=(t,d,f,rate,v,lp,from=0,to=0)=>kit.rotor(t*time,d*time,v*level,
      {f:f*pitch,rate:rate/time,lp,panFrom:from,panTo:to});
    const clap=(t,v,pan)=>{ // fingers then palm, not an electronic snare
      for(const dt of [0,.010,.023])grain(t+dt*rnd(.8,1.15),.024,1550,v*rnd(.5,.85),{q:.65,pan});
      grain(t+.025,.106,1080,v*1.1,{q:.7,wet:.14,pan});ring('shell',t+.02,320,v*.23,.057,pan);
    };
    const heart=(t,v)=>{thud(t,104,v,.19,-.08);grain(t,.05,180,v*.42,{pink:true});
      thud(t+.137,87,v*.65,.12,.07);};
    return {osc,grain,ring,thud,tick,wood,blades,clap,heart,rnd};
  }

  // 2026-11-20 使用者：新做的音效很敷衍，暫時不用。NEW_SOUNDS 關掉時，第 6 階段之後才有的每個用途都改指向一個原本就有的聲音；
  // 下面的合成配方先留著，之後要重做時再打開。
  const NEW_SOUNDS=false;
  const OLD_FOR={rifle:'s3gun',rifleQuiet:'s3silenced',carbine:'s3gun',carbineQuiet:'s3silenced',
    cargo:'droneJam',cargoDrop:'s3boom',eagleLure:'s3shriek',execute:'takedown',quickstep:'s3dash',veil:'dream',
    shockdrone:'droneJam',droneArc:'s3zap',rush:'s3swing',hiveguard:'s3shriek',performance:'s3wave',stageReady:'lock',
    stageFlash:'s3shock',watch:'dream',metronome:'dream',metroTick:'click',order:'click',molotov:'s3swing',
    molotovImpact:'s3boom',pipebomb:'s3swing',pipeImpact:'s3boom',medbeacon:'gain',injunction:'blackout',
    escortWrit:'lock',omniEntry:'dream',omniWindow:'event',omniOverflow:'gain',omniHeld:'lock'};
  sfx.add(kit=>{
    const scores={};
    function fresh(group,key,label,make,previous=key) {
      if(!NEW_SOUNDS){list(group,key,OLD_FOR[key]||'blip',label,true);return;}
      const id='s3x_'+key;
      list(group,key,id,label,false,previous?'s3v6_'+previous:null);
      scores[id]=()=>make(materials(kit));
    }
    const gear=(key,make)=>fresh('gear',key,'s3.gad.'+key+'.n',make);
    const action=(key,labels,make,prior)=>fresh('gear',key,labels,make,prior);
    const station=(key,labels,make)=>fresh('omni',key,labels,make);

    // Rifle: pressure front, receiver, bolt running back and returning, wall slap.
    // The suppressed actions expose the mechanism instead of simply turning the gun down.
    function longGun(carbine,quiet,{grain,thud,ring,tick,rnd}){
      const f=carbine?195:143, b=carbine?.029:.043, wall=rnd(.025,.037), side=rnd(-.35,.35);
      if(!quiet){
        grain(0,carbine?.018:.028,carbine?3500:2320,carbine?.35:.43,{q:.68});
        grain(.004,carbine?.043:.072,carbine?1640:1250,.27,{type:'lowpass',to:420});
        thud(0,f,carbine?.25:.34,carbine?.078:.117);
        grain(wall,.047,carbine?1920:1430,.104,{q:.72,pan:side,wet:.13});
      }else{
        thud(0,f*1.24,carbine?.118:.147,carbine?.049:.069);
        grain(.002,.041,carbine?980:740,.148,{type:'lowpass',to:390}); // gas in the baffles
        ring('shell',.011,carbine?535:355,.063,.054,-side);
      }
      tick(b,carbine?1250:875,quiet?.073:.079,side);
      ring('steel',b+(carbine?.013:.025),carbine?610:437,quiet?.056:.064,carbine?.047:.075,-side);
    }
    for(const key of ['rifle','carbine']){
      fresh('guns',key,'s3.wp.'+key+'.n',v=>longGun(key==='carbine',false,v));
      fresh('guns',key+'Quiet',{weapon:key},v=>longGun(key==='carbine',true,v));
    }

    gear('cargo',({blades,grain,ring,tick,rnd})=>{
      blades(0,.67,55,14,.071,395,-.42,.16);blades(.09,.48,83,19,.023,440,-.2,.23);
      for(let i=0;i<6;i++)grain(.045+i*.085,.045,185,.11,{pink:true,q:.72,pan:-.25+i*.08});
      ring('steel',.23,241,.063,.21);tick(.47,rnd(387,447),.091); // sling tension, then release
    });
    action('cargoDrop',['貨箱著地','货箱落地','Crate touchdown'],({thud,wood,tick,grain})=>{
      thud(0,91,.36,.28);wood(.006,163,.19,.20);grain(.012,.115,540,.26,{type:'lowpass',pink:true});
      wood(.066,232,.105,.083,-.18);tick(.112,523,.066,.24);tick(.174,371,.048,.13);
    });
    action('eagleLure',['老鷹：誘敵信標','老鹰：诱敌信标','Eagle · lure beacon'],({grain,osc,tick})=>{
      tick(0,1290,.045,-.23); // valve of a double reed; a shorter answer comes back from the right
      for(const [t,f,end,d,pan] of [[.018,1550,2270,.12,-.22],[.155,2040,1450,.094,.31]]){
        grain(t,.045,2350,.077,{q:1.6,pan});osc('sine',f,t,d,.105,{to:end,a:.025,pan,fm:{ratio:.021,depth:73}});
        osc('sine',f*1.99,t+.008,d*.69,.020,{to:end*1.92,pan});
      }
    });

    gear('execute',({grain,tick,thud,wood})=>{
      grain(0,.044,1700,.12,{q:1.4});tick(.022,1210,.105);
      grain(.057,.064,690,.22,{pink:true});thud(.081,138,.28,.14);wood(.112,224,.063,.065);
    });
    gear('quickstep',({grain,wood,tick})=>{
      grain(0,.09,825,.24,{to:1820,pan:-.34,a:.009});wood(.016,250,.11,.054,-.25);
      grain(.103,.085,1320,.15,{to:515,pan:.33});tick(.142,995,.10,.28);tick(.171,587,.073,.25);
    });
    gear('veil',({grain,ring,tick})=>{
      for(const [i,p] of [-.42,-.21,.03,.24,.39].entries()){
        grain(.018+i*.034,.047,1680-i*225,.11,{q:2,pan:p});ring('steel',.01+i*.034,755-i*79,.050,.045,p);
      }
      grain(.005,.23,820,.137,{type:'lowpass',to:230,a:.027});tick(.193,364,.095,.4);
    });
    gear('shockdrone',({tick,blades,grain,ring})=>{
      tick(0,1115,.11);tick(.047,925,.09,.22);ring('steel',.051,470,.079,.13);
      blades(.068,.47,196,41,.049,1480,-.14,.34);grain(.107,.13,1480,.088,{to:2380,q:1.2});
    });
    action('droneArc',['無人機放電','无人机放电','Drone discharge'],({blades,grain,osc,rnd})=>{
      blades(0,.15,176,45,.024,1160);let t=.01;
      for(let i=0;i<5;i++){const f=rnd(1730,3850),pan=rnd(-.48,.48);
        grain(t,rnd(.012,.03),f,.235-i*.024,{q:1.6,pan});
        osc('square',f*.37,t,.017,.043,{to:f*.19,lp:2100,pan});t+=rnd(.010,.032);}
    });
    gear('rush',({wood,grain,thud})=>{
      [[0,-.3],[.105,.18],[.181,.28]].forEach(([t,p],i)=>{wood(t,183-i*19,.111,.08,p);grain(t,.08,580,.14,{pink:true,pan:p});});
      thud(.214,107,.18,.18);grain(.232,.11,810,.12,{type:'lowpass',to:290});
    });
    gear('hiveguard',({wood,blades,grain})=>{
      wood(0,475,.115,.089);grain(.025,.095,1250,.12,{q:1.2});
      blades(.04,.45,204,27,.022,1180,-.44,.16);blades(.11,.52,241,37,.021,1330,.37,-.2);
      blades(.23,.39,276,32,.016,1450,-.03,.43);
    });

    gear('performance',({clap,wood,rnd})=>{
      clap(0,.19,-.37);clap(rnd(.13,.16),.14,.28);clap(rnd(.27,.31),.21,.04);wood(.32,192,.072,.12);
    });
    action('stageReady',['定格：基座扣緊','定格：基座扣紧','Tableau · stand locked'],({tick,wood})=>{
      wood(0,385,.105,.055);tick(.038,740,.083);
    },null);
    action('stageFlash',['定格：散場閃光','定格：散场闪光','Tableau · flashbulb'],({tick,grain,ring})=>{
      tick(0,1200,.12);grain(.012,.027,4700,.36,{type:'highpass'});grain(.020,.125,1950,.22,{to:620,wet:.18});
      ring('shell',.017,438,.10,.063);ring('glass',.032,2240,.092,.196,.25);tick(.13,536,.063,-.15);
    },null);
    action('watch',['銀鏈懷錶：催眠','银链怀表：催眠','Silver watch · induction'],({ring,tick,osc})=>{
      ring('steel',0,1780,.08,.13);tick(.026,1010,.08);
      [0,.206,.42,.645].forEach((t,i)=>tick(.06+t,i%2?1160:1760,.082-i*.007,i%2?.22:-.22));
      osc('sine',125,.07,.83,.083,{to:63,a:.15});osc('triangle',185,.22,.53,.027,{to:97,a:.13,lp:480});
    },'hypnosis');
    gear('metronome',({wood,tick,ring})=>{
      ring('steel',0,496,.066,.11,-.19);wood(.055,602,.18,.10,-.21);tick(.055,1400,.083,-.23);
    });
    action('metroTick',['三拍子：擺錘回擊','三拍子：摆锤回击','Three beats · pendulum knock'],({wood,tick,rnd})=>{
      const p=rnd(-.35,.35);wood(.003,766,.18,.11,p);wood(.014,296,.091,.102,-p);tick(.007,1280,.087,p);
    },null);
    action('order',['催眠：指令落定','催眠：指令落定','Suggestion · chain stop'],({ring,tick,wood})=>{
      [0,.037,.059].forEach((t,i)=>ring('steel',t,1480-i*265,.067,.066,-.2+i*.14));wood(.105,360,.105,.064);tick(.11,790,.073);
    },null);
    gear('molotov',({grain,tick,ring})=>{
      grain(0,.095,2280,.197,{to:1200,q:1.5});tick(.027,1080,.067);
      ring('glass',.081,794,.104,.14);grain(.098,.12,690,.165,{type:'lowpass',to:360});
    });
    action('molotovImpact',['燃燒瓶：碎裂起火','燃烧瓶：碎裂起火','Molotov · glass and flame'],({ring,grain,thud,rnd})=>{
      grain(0,.027,4200,.32,{type:'highpass'});ring('glass',0,1120,.18,.122);
      for(let i=0;i<7;i++){const t=.018+i*.026+rnd(0,.012);ring('glass',t,rnd(1380,3230),.094-i*.008,.14-i*.012,rnd(-.65,.65));}
      thud(.033,128,.22,.235);grain(.018,.35,1080,.34,{type:'lowpass',to:200,a:.048,pink:true});
      grain(.092,.116,2140,.14,{to:770});
    },'boom');
    gear('pipebomb',({tick,ring,grain,rnd})=>{
      ring('steel',0,465,.114,.095);tick(.021,882,.10);
      grain(.04,.24,2530,.135,{q:1.3,to:1280,a:.018});
      for(let i=0;i<5;i++)grain(.078+i*.063+rnd(0,.015),.027,2830,.145,{q:1.6});
    });
    action('pipeImpact',['土製炸彈：管身悶爆','土制炸弹：管身闷爆','Pipe bomb · casing rupture'],({grain,thud,ring,tick})=>{
      thud(0,105,.39,.36);grain(0,.17,1100,.41,{type:'lowpass',to:240});ring('shell',.006,184,.23,.22);
      grain(.048,.22,490,.20,{type:'lowpass',to:120,pink:true,wet:.23});
      tick(.137,910,.095,-.39);ring('steel',.214,621,.087,.13,.45);tick(.32,415,.058,.21);
    },'boom');
    gear('medbeacon',({tick,ring,osc})=>{
      tick(0,620,.122,-.28);ring('steel',.061,408,.112,.102,.21);tick(.133,980,.102,.24);
      [196,246,294].forEach((f,i)=>osc('sine',f,.146+i*.013,.64-i*.045,.047-i*.007,{a:.112,detune:3,wet:.16,pan:(i-1)*.17}));
    });
    gear('injunction',({wood,tick,thud})=>{
      wood(0,327,.216,.111);thud(.002,156,.115,.113);wood(.184,298,.203,.146);
      [.31,.375,.424,.464].forEach((t,i)=>tick(t,1370-i*190,.103-i*.011,-.4+i*.24));
    });
    gear('escortWrit',({grain,wood,ring,tick})=>{
      grain(0,.114,1830,.14,{q:1.7,to:800,pan:-.23});wood(.10,272,.20,.107);ring('shell',.105,133,.13,.125);
      [.18,.245,.337].forEach((t,i)=>tick(t,681-i*96,.082-i*.011,.18+i*.06));
    });

    // Same medical machine, four different physical decisions: connect, release, spill, lock.
    station('omniEntry',['接入校準機','接入校准机','Calibration link'],({heart,osc,tick})=>{
      tick(0,572,.084);heart(.037,.25);heart(.51,.21);
      osc('sine',313,.094,.76,.094,{to:289,a:.18,pan:-.34});
      osc('sine',318,.14,.79,.092,{to:292,a:.20,pan:.34});tick(.84,466,.057);
    });
    station('omniWindow',['換批窗口','换批窗口','Handover window'],({wood,tick,ring,grain})=>{
      [0,.05,.127,.241].forEach((t,i)=>tick(t,840-i*93,.095-i*.008,-.24+i*.12));
      grain(.28,.15,540,.19,{q:1.25,to:270});wood(.36,186,.145,.16,.12);
      ring('steel',.375,515,.113,.44,.30); // open latch, then the handrail rings in the clear
    });
    station('omniOverflow',['漏洞溢出','漏洞溢出','Exploit overflow'],({ring,tick,wood,rnd})=>{
      [0,.072,.123,.157].forEach((t,i)=>{ring('glass',t,1330+i*131,.097,.10,-.34+i*.16);tick(t,903+i*75,.062);});
      wood(.22,316,.15,.115,.23);ring('steel',.274,rnd(910,1030),.105,.235,.49);
    });
    station('omniHeld',['收容艙外鎖','收容舱外锁','Pod interlock'],({grain,thud,ring,tick})=>{
      grain(0,.09,820,.127,{to:1450,pan:-.36});tick(.10,1090,.092,-.25);
      grain(.182,.189,620,.238,{to:265,type:'lowpass',a:.025,pan:.28});
      thud(.347,87,.239,.32,.24);ring('steel',.354,182,.12,.287,.30);
      tick(.476,478,.126,.48);thud(.482,128,.12,.12,.40);
    });
    return scores;
  });

  const fixed = {eshot:['eshot',70],hit:['hit',45],hurt:['hurt'],dead:['down'],down:['down'],swap:['swap'],getaway:['getaway'],dash:['dash'],
    hack:['hack',60],denied:['denied',150],boom:['boom',60],shock:['shock',60],zap:['zap',60],arc:['arc',60],steam:['steam'],spotted:['spotted',300],
    alarm:['alarm'],clang:['clang',60],takedown:['takedown'],melee:['swing',80],swing:['swing',80],leap:['swing',80],reload:['reload'],crash:['crash'],
    rev:['rev'],wave:['wave'],clear:['clear'],phase:['phase'],revive:['revive'],snipe:['snipe'],lob:['lob',100],hijack:['hijack'],raise:['raise'],
    breach:['breach'],mark:['mark'],shriek:['shriek'],guard:['guard'],sneeze:['sneeze'],eagleLure:['eagleLure'],
    stageFlash:['stageFlash'],stageReady:['stageReady'],order:['order']};

  function fromEvent(ev) {
    if(ev.cue===false)return null; // one discharge per drone strike, not one per chained target
    if(ev.cue==='eaglePulse')return ['eaglePulse',60]; // the same s3shock/throttle as a field trap
    if(ev.cue)return [ev.cue];
    if(ev.k==='shot'){
      const auto=ev.w==='rifle' || ev.w==='carbine';
      const key=ev.w+(auto && ev.suppressed?'Quiet':'');
      return [byKey[key]?.group==='guns'?key:'pistol',auto?105:40];
    }
    if(ev.k==='gadget')return [byKey[ev.id]?.group==='gear'?ev.id:'fallback'];
    if(ev.k==='pshot')return [byKey[ev.id+'Fire']?ev.id+'Fire':'allyFire',90];
    if(ev.k==='kill')return [ev.boss?'bossdown':ev.machine?'scrap':'kill',50];
    if(ev.k==='pickup')return [ev.what==='data'?'pick':'gain',40];
    return fixed[ev.k] || null;
  }
  S.audio={cues,byKey,fromEvent};
})(window.ECHO.s3,window.ECHO.sfx);
