// 《零時差》的固定聯絡人。這些人不進《宵禁》的路人生成池；同一個 id 永遠是同一個人。
(function (E) {
  const L = (en, tc, sc) => ({ en, tc, sc });
  const look = (style, hairC, skin, top, col, hat, hatCol) => ({ style, hairC, skin, o: { top, col, hat, hatCol } });
  const profiles = {
    hitman: {
      name: L('Hitman', '殺手', '杀手'), fixedName: L('Leon Voss', '里昂・沃斯', '利昂·沃斯'), age: 44, district: 'soho',
      bio: L('Soho. Voss used to take contracts on folded theatre tickets. The last ticket held a seat number and no name. Voss kept it.', '蘇豪。沃斯以前在摺好的戲票上接單。最後一張只有座位號，沒有人名。那張票至今還在西裝口袋裡。', '苏豪。沃斯以前在折好的戏票上接单。最后一张只有座位号，没有人名。那张票至今还在西装口袋里。'),
      category: 'physical', skills: [1, 3, 1], portrait: 'pt-elite-hitman', look: look('bald', '#30251f', '#d9a77c', 'suit', '#2b2d33'),
    },
    spy: {
      name: L('Spy', '間諜', '间谍'), fixedName: L('Kit Arden', '基特・阿登', '基特·阿登'), age: 37, district: 'westminster',
      bio: L('Westminster. Arden counted the place settings at embassy dinners. An extra knife meant an unlisted guest. An extra driver meant trouble. The custom suppressed pistol stayed under the jacket.', '西敏。阿登以前替使館晚宴數餐具：多一把刀，是多一位沒登記的賓客；多一個司機，就該走了。訂製消音手槍始終藏在外套裡。', '威斯敏斯特。阿登以前替使馆晚宴数餐具：多一把刀，是多一位没登记的宾客；多一个司机，就该走了。定制消音手枪始终藏在外套里。'),
      category: 'social', skills: [2, 1, 3], portrait: 'pt-elite-spy', look: look('side', '#3a2618', '#f0cdb0', 'suit', '#1e2747'),
    },
    drone_expert: {
      name: L('Drone expert', '無人機專家', '无人机专家'), fixedName: L('Nia Okoro', '妮雅・奧科羅', '妮娅·奥科罗'), age: 29, district: 'isle_of_dogs',
      bio: L('Isle of Dogs. Nia used to fly drones for Lionheart Defence. In river fog a change in motor pitch was enough to bring a survey rig home. The pink headset came along on the way out.', '狗島。妮雅以前替獅心防務操控無人機。河霧再濃，聽馬達變調就知道測繪機該落在哪裡。離職時只帶走那副粉紅耳機。', '狗岛。妮娅以前替狮心防务操控无人机。河雾再浓，听马达变调就知道测绘机该落在哪里。离职时只带走那副粉红耳机。'),
      category: 'hacker', skills: [3, 1, 1], portrait: 'pt-elite-drone', look: look('curly', '#16110e', '#6e4229', 'jacket', '#3b4d5e', 'headset', '#ff2e88'),
    },
    hooligan: {
      name: L('Football hooligan', '足球流氓', '足球流氓'), fixedName: L('Red Malloy', '瑞德・馬洛伊', '雷德·马洛伊'), age: 32, district: 'camden',
      bio: L('Camden. One whistle used to save three seats on the away coach. These days the same three turn up without tickets.', '康登。以前吹一聲口哨，就有人在客場巴士上留三個位子。現在一聲哨響，老位子上的三個人還是會來。', '卡姆登。以前吹一声口哨，就有人在客场大巴上留三个位子。现在一声哨响，老位子上的三个人还是会来。'),
      category: 'physical', skills: [0, 3, 2], portrait: 'pt-elite-hooligan', look: look('crop', '#b4532a', '#f3d5c0', 'tee', '#c8102e'),
    },
    beekeeper: {
      name: L('Beekeeper', '養蜂人', '养蜂人'), fixedName: L('Iris Vale', '艾莉絲・維爾', '艾丽丝·韦尔'), age: 46, district: 'rotherhithe',
      bio: L('Rotherhithe. Vale kept hives on the roof of a printworks. When the presses stopped, the bees were the only things still on shift.', '羅瑟希德。維爾把蜂箱搭在印刷廠屋頂。印刷機停了好幾年，蜂群倒是一天都沒停工。', '罗瑟希德。韦尔把蜂箱搭在印刷厂屋顶。印刷机停了好几年，蜂群倒是一天都没停工。'),
      category: 'specialist', skills: [2, 2, 1], portrait: 'pt-elite-beekeeper', look: look('crop', '#39251c', '#c48a5e', 'jacket', '#efeadf', 'beekeeper', '#f7f3e7'),
    },
    statue: {
      name: L('Living statue', '行為藝術家', '行为艺术家'), fixedName: L('Sol Reed', '索爾・里德', '索尔·里德'), age: 41, district: 'westminster',
      bio: L('Westminster. A council camera once logged Reed as street furniture for a whole winter. The appeal is still pending.', '西敏。有一年冬天，市政攝影機整整三個月都把里德登記成街道設施。更正申請還在排隊。', '威斯敏斯特。有一年冬天，市政摄像头整整三个月都把里德登记成街道设施。更正申请还在排队。'),
      category: 'social', skills: [1, 2, 3], portrait: 'pt-elite-statue', look: look('bald', '#b8902f', '#c9a24a', 'coat', '#b8902f'),
    },
    hypnotist: {
      name:L('Hypnotist','催眠師','催眠师'), fixedName:L('Ash Bell','艾許・貝爾','阿什·贝尔'), age:58, district:'soho',
      bio:L('At the end of the Soho matinee, Bell always asked for the watch back. The audience remembered little else.', '蘇豪的午場散戲前，貝爾總會開口討回懷錶。觀眾只記得這一句。','苏豪的午场散戏前，贝尔总会开口讨回怀表。观众只记得这一句。'),
      category:'social',skills:[2,0,3],portrait:'pt-elite-hypnotist',look:look('side','#ddd2cd','#ab7156','waistcoat','#4e2459'),
    },
    anarchist: {
      name:L('Anarchist','安那其主義者','安那其主义者'),fixedName:L('Pip Flint','皮普・弗林特','皮普·弗林特'),age:28,district:'camden',
      bio:L('Flint kept the receipts for every bottle thrown in Camden. Someone was getting the deposits back.', '弗林特留著康登每一個空瓶的收據。瓶子可以砸，押金一分也不能少。','弗林特留着卡姆登每一个空瓶的收据。瓶子可以砸，押金一分也不能少。'),
      category:'physical',skills:[2,3,0],portrait:'pt-elite-anarchist',look:look('mohawk','#83ad46','#dfa483','hoodie','#262431'),
    },
    paramedic: {
      name:L('Paramedic','急救員','急救员'),fixedName:L('Ren Cole','任・柯爾','任·科尔'),age:34,district:'rotherhithe',
      bio:L('Cole painted the ambulance number under the visor. When the dispatch screens went dark, the number still answered.', '柯爾把救護車的號碼寫在護目鏡下緣。調度螢幕全黑以後，這支電話還打得通。','科尔把救护车的号码写在护目镜下沿。调度屏幕全黑以后，这支电话还打得通。'),
      category:'specialist',skills:[2,2,2],portrait:'pt-elite-paramedic',look:look('crop','#24202b','#905b42','hivis','#297660','visor','#73c7de'),
    },
    barrister: {
      name:L('Senior barrister','資深大律師','资深大律师'),fixedName:L('Morgan Lau','摩根・劉','摩根·刘'),age:53,district:'westminster',
      bio:L('On the last day the courts stayed open, Lau secured an injunction against a camera. The order named the serial number, not the owner.', '法院最後一次開庭，劉替一台監視器聲請了禁制令。命令上寫的是機身序號，不是業主姓名。','法院最后一次开庭，刘申请了一道针对摄像头的禁制令。命令上写的是机身序列号，不是业主姓名。'),
      category:'social',skills:[3,0,3],portrait:'pt-elite-barrister',look:look('bun','#332b30','#dba385','coat','#282631','courtWig','#e7dbcb'),
    },
  };
  for (const [id, def] of Object.entries(profiles)) { def.id = id; def.perk = id; }
  // Personal kit belongs to the person, never to the visit or to a squad slot.
  const T=(id,weapon,gadget,mods={},flags={})=>({id,weapon,gadget,mods,flags});
  const templates={
    hitman:[T('contract','rifle','execute',{pierce:1},{combatExec:1}),T('runner','carbine','quickstep',{}, {dashLoad:1,decoy:1})],
    spy:[T('spotter','match','strike',{}, {assassin:1}),T('undercover','match','veil',{}, {freeFirst:1})],
    drone_expert:[T('flightdeck','pistol','shockdrone',{hijackMul:1.35}),T('gunship','taser','expert',{}, {freeFirst:1})],
    hooligan:[T('terrace','shotgun','brawl',{maxHp:24}),T('turnstile','pistol','rush',{}, {lifesteal:1})],
    beekeeper:[T('apiary','taser','swarm',{}, {hiveMark:1}),T('veilguard','nailgun','hiveguard',{}, {guard:1})],
    statue:[T('plinth','silenced','performance',{}, {still:1}),T('encore','shotgun','performance',{}, {encore:1})],
    hypnotist:[T('watch','silenced','hypnosis',{focusRegen:1.5},{selfFocus:1,watchGuard:1}),T('beat','taser','metronome',{}, {guard:1,selfFocus:1})],
    anarchist:[T('bottle','shotgun','molotov',{}, {trapDouble:1}),T('fuse','nailgun','pipebomb',{}, {scrapBlast:1})],
    paramedic:[T('station','taser','medbeacon',{}, {nurse:1}),T('stretcher','pistol','medbeacon',{}, {mobileWard:1})],
    barrister:[T('chambers','silenced','injunction',{}, {seniorBail:1}),T('circuit','taser','escortWrit',{}, {seniorBail:1})],
  };
  const personal=(job,id,max,mods,flags)=>({owner:job,id,max,rar:'u',tag:'body',mods:mods||{},flags:flags||{}});
  const xp=[
    personal('hitman','reprieve',2,null,{reprieve:1}),personal('hitman','sidesteps',3,{dashCharges:1}),
    personal('spy','vanish',3,null,{vanish:1}),personal('spy','deadletter',2,null,{deadletter:1}),
    personal('drone_expert','coilTap',2,null,{coilTap:1}),personal('drone_expert','overcell',3,null,{overcell:1}),
    personal('hooligan','terraceFists',3,null,{terraceFists:1}),personal('hooligan','chant',2,null,{chant:1}),
    personal('beekeeper','hiveDose',3,null,{hiveDose:1}),personal('beekeeper','afterbuzz',2,null,{afterbuzz:1}),
    personal('statue','wideStage',2,null,{wideStage:1}),personal('statue','hatTips',3,null,{hatTips:1}),
    personal('hypnotist','suggestion',2,null,{suggestion:1}),personal('hypnotist','velvet',2,null,{velvet:1}),
    personal('anarchist','longWick',3,null,{longWick:1}),personal('anarchist','fragments',2,null,{fragments:1}),
    personal('paramedic','triage',3,null,{triage:1}),personal('paramedic','wideWard',2,null,{wideWard:1}),
    personal('barrister','extension',3,null,{extension:1}),personal('barrister','surety',2,null,{surety:1}),
  ];
  E.s3.data.exploits.push(...xp);
  const templateOf=p=>p && (templates[p.elite]||[]).find(t=>t.id===p.template);
  const signatures={lynx:{name:L('The Lynx','猞猁','猞猁'),job:'programmer',age:27,traits:['memory','nimble'],quirks:['gamer','night_shift'],look:look('bob','#2f253c','#dbab88','jacket','#298d96')},
    leopard:{name:L('The Leopard','花豹','花豹'),job:'trainer',age:42,traits:['strong','fast'],quirks:['ex_army','marathon'],look:look('crop','#44342a','#925f47','tactical','#b28e48')},
    viper:{name:L('The Viper','蝮蛇','蝮蛇'),job:'actor',age:33,traits:['unremarkable','careful'],quirks:['night_shift','cyclist'],look:look('side','#24212b','#c89272','coat','#6e4d83')}};
  function fit(p,seed,forced) {
    if (!p.elite && p.occupation!=='drone_op') return p;
    const id=p.elite || 'drone_expert', kits=templates[id]; if(!kits || templateOf(p)) return p;
    const r=E.rng.derive('field-kit',seed || 'legacy',p.district,p.id,id);
    const traits=p.traits && p.traits.length?p.traits:r.shuffle(E.s2.people.traits).slice(0,2).map(x=>x.id);
    const habits=E.s2.people.quirks, one=r.weighted(habits,q=>q.weight??1);
    const quirks=p.quirks && p.quirks.length?p.quirks:[one.id,r.weighted(habits.filter(q=>q!==one && q.id!==one.rival),q=>q.weight??1).id];
    return {...p,elite:id,template:(kits.find(t=>t.id===forced)||r.pick(kits)).id,traits,quirks};
  }
  function person(id,seed,forced) {
    const d=profiles[id], [hack,physical,social]=d.skills;
    return fit({id:'elite-'+id,elite:id,occupation:id,district:d.district,fixedName:d.fixedName,age:d.age,
      skills:{hack,physical,social},traits:[],quirks:[],flaw:null,threat:48},seed,forced);
  }
  function street(seed,p) {
    if(p.occupation==='drone_op')return fit(p,seed);
    const r=E.rng.derive(seed,'street-signal',p.id);
    if(p.rare || !r.chance(1/256)) return p;
    const id=r.pick(Object.keys(signatures)), v=signatures[id];
    return {...p,id:'signal-'+id,signal:id,occupation:v.job,fixedName:v.name,age:v.age,heritage:'british',rare:true,traits:v.traits.slice(),quirks:v.quirks.slice(),flaw:null,
      skills:id==='lynx'?{hack:3,physical:1,social:1}:id==='leopard'?{hack:0,physical:3,social:1}:{hack:1,physical:1,social:3}};
  }
  function lookOf(p){return p.signal?signatures[p.signal].look:p.elite&&p.occupation!=='drone_op'?profiles[p.elite].look:null;}
  E.s3.ops={profiles,templates,xp,templateOf,fit,person,street,signatures,lookOf,jobOf:p=>profiles[p.elite] || E.people.occupationOf(p)};
})(window.ECHO);
