// OMNI：一趟接線、三個呼號。普通突襲只共用選門、戰鬥和補給，不共用拘留室或結算。
(function (E) {
  const S = E.s3, R = S.run, SPAN = 10, CYCLE = SPAN * 3, BATCH = 50;
  const unlocked = m => S.story.endings.some(e => m.endings?.[e.id]);
  const record = m => m.omniRecord || { best: 0, exits: 0 };
  const entry = (m,p) => m.roster.find(x => R.same(x.p,p));
  function position(completed) {
    return {sector: Math.floor(completed / SPAN) % 3, depth: completed % SPAN};
  }
  function curve(no) {
    const d = Math.max(0,no-1);
    return {scale:.77+.041*d+.00058*d*d+.0016*Math.max(0,d-58)**2, budget:13+100*d/(105+d),
      elite:.025+.48*d/(105+d), intensity:1+.75*d/(110+d)};
  }
  const nextWindow = cleared => BATCH * (1 + Math.floor(cleared/BATCH));
  const cap = (run,def) => def.max + (run?.omni ? Math.floor(run.omni.cleared/CYCLE) : 0);
  const price = run => 1 + .024 * Math.max(0,run.roomNo-1);
  function connect(seed,people,m) {
    if (!unlocked(m) || m.campaign !== 'active' || m.omniRun || R.load() || people.length!==R.SQUAD ||
        new Set(people.map(p=>entry(m,p))).size!==R.SQUAD || people.some(p=>entry(m,p)?.status!=='ready')) return null;
    return create(seed,people,m);
  }
  function create(seed,people,m){
    const run=R.start(seed,people,m);
    run.omni={cleared:0,banked:0,paid:0,overflow:{},spill:0};
    run.held=m.roster.filter(x=>x.status==='station').length;
    R.route(run); snapshot(run,m);
    return run;
  }
  // 新旅程與名冊存在同一筆本地資料，收容、實體救援和窗口交割不會只寫到一半。
  function snapshot(run,m) {
    const rec=m.omniRecord || (m.omniRecord={best:0,exits:0});
    rec.best=Math.max(rec.best,run.roomNo);
    for(const x of run.squad) if(!x.down) {
      const e=entry(m,x.p); if(e)e.omniBest=Math.max(e.omniBest||0,run.roomNo);
    }
    m.omniRun=run;
  }
  function capture(run,m,i) {
    const mem=run.squad[i];
    if(mem.down)return false;
    mem.down=true;mem.hp=0;run.stats.captured++;
    const e=m && entry(m,mem.p);
    if(e){e.status='station';e.omniBest=Math.max(e.omniBest||0,run.roomNo);}
    const alive=R.alive(run);
    if(!alive.length)run.phase='dead';
    else if(run.squad[run.active].down)run.active=alive[0];
    return true;
  }
  // 救援的是上一趟失聯的呼號；當趟三人即使已倒下，也仍在這批校準中。
  function rescue(run,m,volunteer) {
    const held=m?.roster.find(x=>x.status==='station' && !run.squad.some(a=>R.same(a.p,x.p)));
    let p,full=false;
    if(held){held.status='ready';p=held.p;run.held=Math.max(0,run.held-1);}
    else {
      p=volunteer();
      if(m && p){if(m.roster.length<R.rosterMax(m))p=R.enlist(m,p).p;else full=true;}
      if(full)run.data+=40;
    }
    run.stats.rescued++;run.pending=null;run.phase='doors';
    if(m)snapshot(run,m);
    return {p,known:!!held,joined:false,full};
  }
  function advance(run) {
    run.omni.cleared=run.roomNo;
    if(run.roomNo%SPAN===0){
      run.cells={};run.shops={};
      if(run.kit)R.heal(run,15);
    }
    Object.assign(run,position(run.roomNo));
    if(run.roomNo%BATCH===0){run.options=[];run.phase='window';return run.phase;}
    R.route(run);return run.phase;
  }
  const payout = run => BATCH + Math.floor(run.data/100);
  function decide(run,m,leave) {
    if(run.phase!=='window' || run.omni.cleared!==run.roomNo || !run.roomNo || run.roomNo%BATCH ||
       run.omni.banked>=run.roomNo || m.omniRun!==run)return null;
    const earned=payout(run);
    m.echoes+=earned;run.omni.banked=run.roomNo;run.omni.paid+=earned;
    run.data%=100;
    for(const mem of run.squad)if(!mem.down){
      const e=entry(m,mem.p);
      if(e && mem.p.imprints)e.p={...e.p,imprints:mem.p.imprints.slice()};
    }
    if(!leave){R.route(run);snapshot(run,m);return {earned};}
    m.omniRecord.exits++;
    for(const mem of run.squad)if(!mem.down){const e=entry(m,mem.p);if(e)e.omniExits=(e.omniExits||0)+1;}
    run.phase='exited';
    return finish(run,m,true,earned);
  }
  function finish(run,m,escaped=false,earned=0) {
    if(m.omniRun!==run || (escaped ? run.phase!=='exited' : run.phase!=='dead'))return null;
    for(const x of run.squad){const e=entry(m,x.p);if(e)e.runs=(e.runs||0)+1;}
    m.vol=(m.vol||0)+1;delete m.omniRun;
    if(!escaped)m=R.afterLoss(m);
    return {meta:m,wiped:m.campaign==='wiped',escaped,earned,paid:run.omni.paid};
  }
  // 超出紙本級數的每一層與滿層副本都給可量化增益；不重複觸發只應執行一次的職業效果。
  const channels={net:'bwRegen',shock:'stunMul',blast:'aoeDmg',puppet:'hijackMul',gun:'dmgMul',body:'maxHp'};
  function amplify(st,build) {
    const sum={};
    for(const def of S.data.exploits){
      if(def.owner && def.owner!==build.person?.elite)continue;
      const rank=build.exploits[def.id]||0;
      // 轉運站不受理保釋。具保金在此轉成持有人的護額，連原本的兩層也有效。
      const bonus=.10*(def.id==='surety' ? rank : Math.max(0,rank-def.max))+.05*(build.overflow[def.id]||0);
      if(bonus){const key=channels[def.tag] || 'dmgMul';sum[key]=(sum[key]||0)+bonus;}
    }
    for(const [key,n] of Object.entries(sum))st[key]*=1+n;
  }
  S.omni={SPAN,CYCLE,BATCH,unlocked,record,position,curve,nextWindow,cap,price,connect,create,snapshot,capture,rescue,advance,payout,decide,finish,amplify};
})(window.ECHO);
