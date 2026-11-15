// 《零時差》一次性音效與音樂。舊配方只由試聽頁載入。
(function (E) {
  const S3 = E.s3 = E.s3 || {}, sfx = E.sfx;
  let K;
  const cues = [], byKey = {};
  // One score per cue. The game dispatches these keys; the audition desk uses the same registry.
  sfx.add(kit => {
    K = kit;
    const map = {}, {osc, hiss, rotor, speak, rnd, pick} = kit;
    function add(group, key, old, label, make) {
      const id = 's3v6_' + key;
      byKey[key] = {group, key, id, old, label}; cues.push(byKey[key]); map[id] = make;
    }
    // Short material sounds: body resonance, metal, air displacement. No looping noise bed.
    const tone = (f,t,d,v,to=f,w='sine',o={}) => osc(w,f,t,d,v,{to,...o});
    const knock = (t,f=132,v=.23,d=.115) => tone(f,t,d,v,f*.38,'sine',{a:.002});
    const metal = (t,f=860,v=.11,d=.07) => tone(f,t,d,v,f*.85,'triangle',{a:.002,lp:2200,fm:{ratio:1.46,depth:f*.22}});
    const air = (t,d,v,f,to=f) => hiss(t,d,v,{f,to,q:.83,a:.002});
    const motor = (f,rate,d,v,lp=590) => rotor(0,d,v,{f,rate,lp});
    const notes = (fs,gap,d,v,w='sine',o={}) => fs.forEach((f,i)=>tone(f,i*gap,d,v,f,w,o));
    const gun = (k,old,make,quiet) => {
      add('guns',k,old,'s3.wp.'+k+'.n',make);
      if (quiet) add('guns',k+'Quiet',old,{weapon:k},quiet);
    };
    gun('pistol','s3gun',()=>{ knock(0,rnd(165,175),.26,.085); air(0,.045,.24,1840,630); metal(.036,720,.10,.042); },
      ()=>{ knock(0,226,.135,.063); metal(.028,760,.059,.034); });
    gun('taser','s3taser',()=>{ tone(780,0,.066,.15,310,'triangle',{fm:{ratio:1.9,depth:490}}); notes([1390,990],.027,.024,.075); },
      ()=>{ tone(530,0,.058,.11,340,'sine',{fm:{ratio:2,depth:150}}); tone(890,.027,.026,.054); });
    gun('shotgun','s3shotgun',()=>{ knock(0,116,.33,.20); air(0,.118,.32,1790,360); metal(.096,395,.12,.085); },
      ()=>{ knock(0,115,.18,.11); metal(.052,540,.068,.047); knock(.086,225,.075,.045); });
    gun('nailgun','s3nail',()=>{ metal(0,rnd(1240,1330),.17,.039); knock(.012,310,.18,.039); },
      ()=>{ metal(0,1030,.095,.025); tone(282,.009,.035,.092,151,'triangle'); });
    gun('silenced','s3silenced',()=>{ knock(0,rnd(215,230),.16,.058); air(0,.035,.085,710,350); });
    gun('match','s3silenced',()=>{ knock(0,296,.192,.054); metal(.019,1130,.10,.027); metal(.052,740,.063,.03); });
    gun('rifle',null,()=>{ knock(0,rnd(148,156),.39,.097); air(0,.060,.37,2050,590); tone(317,0,.052,.18,118,'triangle'); metal(.047,740,.115,.035); },
      ()=>{ knock(0,172,.17,.075); metal(.031,825,.083,.036); metal(.058,448,.048,.028); });
    gun('carbine',null,()=>{ knock(0,191,.23,.067); air(0,.047,.18,1700,850); metal(.031,935,.107,.036); },
      ()=>{ knock(0,199,.132,.054); metal(.028,1035,.070,.041); });
    const gadget = (k,old,fn)=>add('gear',k,old,'s3.gad.'+k+'.n',fn);
    const effect = (g,k,old,tc,sc,en,fn)=>add(g,k,old,[tc,sc,en],fn);
    gadget('cargo','sergei',()=>{ motor(68,19,.65,.065,360); metal(.08,350,.14,.09); }); // the crate impact is synchronized to touchdown
    effect('gear','cargoDrop','s3boom','貨箱著地','货箱落地','Crate touchdown',()=>{ knock(0,106,.31,.22); knock(.057,150,.14,.095); metal(.105,330,.086,.073); });
    gadget('sergei','sergei',()=>{ motor(137,33,.85,.033,750); const p=rnd(162,188);
      speak(.045,pick([
        [{v:'eh',d:.11,p,to:285},{v:'ah',d:.16,p:295,to:208,gap:.035},{v:'oo',d:.22,p:230,to:113}],
        [{v:'oo',d:.19,p,to:130,gap:.083},{v:'ah',d:.24,p:298,to:177}],
        [{v:'ah',d:.09,p:260,to:175},{v:'ah',d:.09,p:285,to:180},{v:'i',d:.21,p,to:320}],
      ]),{vol:.16}); });
    gadget('escort','droneJam',()=>{ motor(167,34,.44,.047,980); tone(490,.22,.12,.09,690); });
    gadget('expert','droneJam',()=>{ motor(82,22,.58,.062,610); knock(.16,144,.20); metal(.30,545,.10,.11); });
    gadget('spider','droneJam',()=>{ [0,.057,.116,.21].forEach((t,i)=>metal(t,740+i*113,.13,.044)); knock(.24,190,.12); });
    gadget('kamikaze','emp',()=>{ tone(160,0,.38,.13,700,'triangle',{a:.045,lp:1450}); metal(.32,1120,.09,.07); });
    gadget('eagle','prof',()=>{ tone(645,0,.10,.15,965); tone(965,.13,.19,.105,1290,'sine',{wet:.10}); });
    effect('gear','eagleLure',null,'老鷹：誘敵信標','老鹰：诱敌信标','Eagle · lure beacon',()=>{ notes([430,570],.115,.097,.125,'triangle',{lp:1150}); });
    effect('gear','eaglePulse','s3shock','老鷹：自爆脈衝','老鹰：自爆脉冲','Eagle · EMP discharge',()=>{ tone(1340,0,.15,.14,165,'sine',{fm:{ratio:.51,depth:310}}); knock(.035,112,.26,.32); metal(.13,455,.086,.17); });
    gadget('blackout','blackout',()=>{ [0,.045,.1].forEach((t,i)=>metal(t,920-i*180,.12,.038)); tone(164,.11,.37,.21,43,'triangle',{lp:690}); });
    gadget('hammer','smash',()=>{ air(0,.13,.16,410,1300); knock(.105,95,.27,.25); metal(.112,540,.13,.32); });
    gadget('sledge','smash',()=>{ air(0,.094,.12,390,940); knock(.081,147,.27,.14); knock(.123,204,.10,.10); });
    gadget('mask','dream',()=>{ tone(675,0,.25,.13,288,'sine',{detune:8}); metal(.22,585,.075,.055); });
    gadget('lure','s3shriek',()=>{ notes([589,785,589],.127,.105,.13,'triangle',{lp:1420}); });
    gadget('mine','lock',()=>{ metal(0,442,.15,.044); metal(.068,690,.12,.05); tone(950,.21,.08,.115); });
    gadget('strike','lock',()=>{ [0,.07,.14].forEach(t=>metal(t,712,.13,.048)); tone(1020,.235,.18,.13,594); });
    gadget('brawl','s3wave',()=>{ tone(1140,0,.17,.14,1430,'sine',{a:.023}); [0,.09,.18].forEach(t=>knock(.16+t,157,.19,.10)); });
    gadget('swarm','s3shriek',()=>{ [178,223,269].forEach((f,i)=>tone(f,i*.055,.34,.048,f*1.17,'sawtooth',{lp:1050,detune:9,pan:(i-1)*.28})); });
    gadget('hypnosis','dream',()=>{ notes([536,504,476],.14,.27,.090,'sine',{detune:12,wet:.13}); });
    gadget('execute',null,()=>{metal(0,1120,.12,.036);knock(.052,108,.27,.13);});
    gadget('quickstep',null,()=>{air(0,.12,.15,550,1700);metal(.07,660,.12,.05);metal(.13,970,.08,.036);});
    gadget('veil',null,()=>{tone(760,0,.32,.12,186,'sine',{detune:8});tone(355,.15,.31,.08,185);});
    gadget('shockdrone',null,()=>{motor(205,42,.46,.048,1380);tone(510,.07,.24,.105,1090,'triangle');});
    effect('gear','droneArc',null,'無人機放電','无人机放电','Drone discharge',()=>{air(0,.06,.12,2600,1100);tone(1140,.014,.10,.10,376,'triangle',{fm:{ratio:1.8,depth:340}});});
    gadget('rush',null,()=>{knock(0,125,.19);knock(.07,140,.23);air(.09,.19,.12,520,1130);});
    gadget('hiveguard',null,()=>{[253,269,289].forEach((f,i)=>tone(f,i*.045,.42,.044,f*.68,'sawtooth',{lp:870,pan:(i-1)*.4}));});
    gadget('performance',null,()=>{metal(0,706,.08,.1);tone(943,.12,.46,.09,942,'sine',{wet:.15});});
    gadget('metronome',null,()=>{[0,.19,.38].forEach((t,i)=>{metal(t,i===2?920:735,.09,.045);knock(t,310,.065,.04);});});
    gadget('molotov',null,()=>{metal(0,1450,.075,.115);air(.05,.29,.10,1430,650);});
    gadget('pipebomb',null,()=>{knock(0,229,.15,.08);metal(.025,540,.12,.16);air(.12,.25,.08,1900,1400);});
    gadget('medbeacon',null,()=>{knock(0,165,.16);notes([440,659,880],.087,.17,.084,'sine',{wet:.09});});
    gadget('injunction',null,()=>{knock(0,146,.25,.12);metal(.025,430,.07,.08);tone(610,.11,.27,.11,305,'triangle');});
    gadget('escortWrit',null,()=>{[0,.08].forEach(t=>knock(t,204,.16,.08));notes([349,523],.16,.21,.08,'triangle',{lp:1320});});
    gadget('eightball','s3swing',()=>{ metal(0,940,.15,.045); knock(.027,222,.25,.11); metal(.102,510,.115,.105); });
    const field=(k,old,tc,sc,en,fn)=>effect('field',k,old,tc,sc,en,fn);
    field('hack','s3hack','駭入接通','入侵接通','Hack accepted',()=>{ notes([466,622,932],.06,.088,.13); metal(.17,1244,.075,.08); });
    field('denied','s3deny','操作受阻','操作受阻','Access denied',()=>{ notes([275,208],.092,.09,.15,'triangle',{lp:850}); });
    field('zap','s3zap','短路','短路','Short circuit',()=>{ tone(934,0,.078,.15,280,'triangle',{fm:{ratio:2.1,depth:900}}); });
    field('arc','s3zap','電弧連鎖','电弧连锁','Arc jump',()=>{ [0,.041,.075].forEach((t,i)=>metal(t,610+290*i,.125,.047)); });
    field('shock','s3shock','電擊陷阱','电击陷阱','Shock trap',()=>{ tone(167,0,.24,.19,68,'triangle',{fm:{ratio:1.3,depth:125}}); air(.012,.057,.14,1630,740); });
    field('steam','s3steam','蒸汽閥','蒸汽阀','Steam valve',()=>{ metal(0,385,.19,.12); air(.044,.29,.19,1240,410); });
    field('boom','s3boom','爆炸','爆炸','Blast',()=>{ knock(0,111,.32,.38); air(0,.23,.29,1830,240); [0,.09].forEach((t,i)=>metal(.10+t,680-220*i,.10,.08)); });
    field('rev','s3rev','引擎加速','引擎加速','Engine rev',()=>{ motor(88,18,.43,.056,590); tone(76,0,.36,.14,199,'triangle',{a:.10}); });
    field('crash','crash','車身撞擊','车身撞击','Vehicle impact',()=>{ knock(0,125,.30,.25); [0,.053,.114].forEach((t,i)=>metal(t,580-i*124,.16,.105)); });
    field('hijack','droneJam','接管機械','接管机械','Machine hijack',()=>{ notes([830,415,622],.072,.13,.12,'triangle'); });
    field('raise','lock','路障升起','路障升起','Barrier raised',()=>{ motor(106,16,.31,.048,440); knock(.26,156,.23); });
    field('breach','camOff','中繼器離線','中继器离线','Relay offline',()=>{ metal(0,820,.15); metal(.093,410,.17); knock(.17,155,.19); });
    field('mark','prof','標記目標','标记目标','Target marked',()=>{ notes([784,1176],.047,.076,.105); });
    field('shriek','s3shriek','場地喇叭誘敵','场地喇叭诱敌','Site loudspeaker decoy',()=>{ tone(940,0,.21,.13,1390,'sine',{fm:{ratio:.07,depth:70}}); });
    const fight=(k,old,tc,sc,en,fn)=>effect('combat',k,old,tc,sc,en,fn);
    fight('eshot','s3eshot','敵方射擊','敌方射击','Hostile fire',()=>{ knock(0,216,.18,.076); air(0,.048,.17,980,530); });
    fight('escortFire','s3nail','護航機開火','护航机开火','Escort fire',()=>{ metal(0,815,.13,.039); knock(0,213,.13,.041); });
    fight('expertFire','s3nail','重型護航機開火','重型护航机开火','Heavy escort fire',()=>{ knock(0,143,.19,.081); metal(.029,525,.12,.054); });
    fight('allyFire','s3nail','劫持機械開火','劫持机械开火','Hijacked machine fire',()=>{ tone(610,0,.053,.14,271,'triangle',{fm:{ratio:1.5,depth:230}}); knock(.014,196,.13,.064); });
    fight('spiderFire','s3nail','蜘蛛砲塔開火','蜘蛛炮塔开火','Spider turret fire',()=>{ metal(0,1360,.11,.034); metal(.022,880,.076,.028); });
    fight('snipe','s3snipe','狙擊','狙击','Sniper shot',()=>{ air(0,.064,.23,2200,970); tone(810,.013,.18,.132,196); knock(.025,100,.22,.16); });
    fight('lob','s3lob','拋射','抛射','Mortar launch',()=>{ knock(0,211,.23,.115); tone(385,.029,.13,.08,530); });
    fight('hit','s3hit','命中','命中','Hit confirmed',()=>{ knock(0,338,.166,.048); air(0,.029,.10,980,590); });
    fight('kill','s3kill','敵人倒下','敌人倒下','Enemy down',()=>{ knock(0,191,.223,.15); knock(.062,107,.105,.14); });
    fight('scrap','s3scrap','機械解體','机械解体','Machine disabled',()=>{ [0,.056,.132].forEach((t,i)=>metal(t,1180-i*321,.16-i*.028,.106)); });
    fight('bossdown','s3bossdown','首領倒下','首领倒下','Boss defeated',()=>{ [0,.115,.265].forEach((t,i)=>knock(t,152-i*33,.27-i*.035,.29)); tone(294,.21,.49,.14,48,'triangle',{wet:.16}); });
    fight('hurt','s3hurt','隊員受傷','队员受伤','Operative hurt',()=>{ knock(0,154,.22,.17); tone(297,0,.14,.14,148,'triangle'); });
    fight('clang','s3clang','擊中裝甲','击中装甲','Armour impact',()=>{ metal(0,rnd(965,1030),.2,.12); knock(.01,191,.11,.06); });
    fight('guard','s3clang','護盾攔下','护盾拦下','Shield block',()=>{ metal(0,555,.20,.16); tone(212,.025,.11,.13,167); });
    fight('spotted','spotted','被發現','被发现','Spotted',()=>{ notes([488,733],.085,.13,.15,'triangle',{lp:1500}); });
    fight('alarm','alarm','全房警報','全房警报','Room alarm',()=>{ [0,.255].forEach(t=>tone(415,t,.21,.145,620,'triangle',{lp:1150})); });
    fight('wave','s3wave','增援接近','增援接近','Reinforcements',()=>{ notes([370,311,247],.095,.14,.14,'triangle',{lp:1000}); });
    fight('phase','s3phase','首領換階段','首领换阶段','Boss phase',()=>{ motor(94,16,.42,.046,520); notes([147,185,220],.13,.23,.15,'triangle'); });
    fight('takedown','takedown','無聲制伏','无声制服','Silent takedown',()=>{ air(0,.078,.13,820,460); knock(.063,173,.20,.11); });
    fight('swing','s3swing','揮擊與撲擊','挥击与扑击','Swing / lunge',()=>{ air(0,.087,.18,490,1230); tone(244,.035,.068,.085,133,'triangle'); });
    fight('dash','s3dash','衝刺','冲刺','Dash',()=>{ tone(240,0,.12,.12,470,'triangle',{a:.018}); air(.009,.085,.13,740,1320); });
    fight('sneeze','noise','噴嚏暴露位置','喷嚏暴露位置','Sneeze',()=>{ air(0,.039,.12,770,1600); air(.07,.121,.22,1330,570); });
    const ui=(k,old,tc,sc,en,fn)=>effect('ui',k,old,tc,sc,en,fn);
    ui('click','click','選取','选取','Select',()=>{ metal(0,920,.14,.048); });
    ui('title','title','開始行動','开始行动','Deploy',()=>{ notes([247,370,494],.095,.19,.155,'triangle',{lp:1350}); });
    ui('swap','s3dash','切換隊員','切换队员','Switch operative',()=>{ notes([494,740],.063,.084,.13); });
    ui('down','desync','隊員倒下','队员倒下','Operative down',()=>{ notes([440,311,156],.122,.19,.15,'triangle'); });
    ui('getaway','bleed','撤離','撤离','Getaway',()=>{ notes([311,392,622],.075,.14,.125); });
    ui('revive','bleed','重新站起','重新站起','Revive',()=>{ knock(0,140,.18,.11); notes([415,622,830],.09,.16,.12); });
    ui('pick','s3pick','拾取資料','拾取数据','Data pickup',()=>{ notes([690,1035],.039,.072,.125); });
    ui('gain','gain','取得補給','获得补给','Supplies gained',()=>{ notes([440,554,740],.065,.145,.12); });
    ui('reload','s3reload','更換彈匣','更换弹匣','Reload',()=>{ metal(0,475,.16,.06); knock(.117,216,.17,.067); metal(.18,834,.12,.052); });
    ui('clear','s3clear','房間淨空','房间肃清','Room clear',()=>{ notes([370,466,740],.09,.22,.13,'sine',{wet:.12}); });
    ui('door','door','穿過房門','穿过房门','Door',()=>{ metal(0,416,.14,.065); tone(82,.046,.19,.14,125,'triangle'); });
    ui('event','event','發現事件','发现事件','Encounter',()=>{ notes([392,466],.13,.21,.127,'sine',{wet:.11}); });
    ui('dream','dream','異常訊號','异常信号','Strange signal',()=>{ tone(420,0,.42,.10,489,'sine',{detune:9}); tone(617,.14,.27,.09,584); });
    ui('cameo','cameo','客串來訊','客串来讯','Contact calling',()=>{ notes([523,659,523,784],.079,.12,.12); });
    ui('ending','ending','行動完成','行动完成','Campaign complete',()=>{ notes([294,370,440,588],.14,.32,.151,'triangle',{wet:.15}); });
    ui('loss','loss','放棄行動','放弃行动','Withdraw',()=>{ notes([370,277],.15,.24,.14,'triangle'); });
    ui('fail','fail','行動失敗','行动失败','Run lost',()=>{ notes([349,294,174],.14,.24,.15,'triangle',{lp:900}); });
    return map;
  });

  const fixed = {eshot:['eshot',70],hit:['hit',45],hurt:['hurt'],dead:['down'],down:['down'],swap:['swap'],getaway:['getaway'],dash:['dash'],
    hack:['hack',60],denied:['denied',150],boom:['boom',60],shock:['shock',60],zap:['zap',60],arc:['arc',60],steam:['steam'],spotted:['spotted',300],
    alarm:['alarm'],clang:['clang',60],takedown:['takedown'],melee:['swing',80],swing:['swing',80],leap:['swing',80],reload:['reload'],crash:['crash'],
    rev:['rev'],wave:['wave'],clear:['clear'],phase:['phase'],revive:['revive'],snipe:['snipe'],lob:['lob',100],hijack:['hijack'],raise:['raise'],
    breach:['breach'],mark:['mark'],shriek:['shriek'],guard:['guard'],sneeze:['sneeze'],eagleLure:['eagleLure']};
  function fromEvent(ev) {
    if (ev.cue === false) return null;
    if (ev.cue) return [ev.cue,55];
    if (ev.k === 'shot') return [ev.w + (ev.suppressed ? 'Quiet' : ''), ev.w === 'rifle' || ev.w === 'carbine' ? 105 : 40];
    if (ev.k === 'gadget') return [ev.id];
    if (ev.k === 'pshot') return [ev.id + 'Fire',90];
    if (ev.k === 'kill') return [ev.boss ? 'bossdown' : ev.machine ? 'scrap' : 'kill',50];
    if (ev.k === 'pickup') return [ev.what === 'data' ? 'pick' : 'gain',40];
    return fixed[ev.k] || null;
  }
  S3.audio = {cues, byKey, fromEvent};

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
