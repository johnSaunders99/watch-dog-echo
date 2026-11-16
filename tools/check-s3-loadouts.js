// Runs inside the S3 game sandbox, using actual casts, projectiles, pickups and both deployments.
'use strict';
const assert=require('assert/strict');
module.exports=function({S3,sim,A,build,arena,foe,anchor,pad,go,field,cast}){
  const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<.002,`${msg}: ${a} != ${b}`);
  const make=(gear,ex={},scale=1,deployment='relay',extras={},enemies=[foe('turret',800,730),anchor()])=>{
    const s=sim.createRoom({...arena({enemies}),scale},{deployment,squad:[
      build({...extras,exploits:ex,gadgets:gear?[{id:gear.id||gear,lv:gear.lv||1}]:[]}),build(),build()]});
    A.raise(s);for(const e of s.en){e.hp=e.maxHp=10000;e.cd=90;e.stun=10;}
    return s;
  };
  for(const scale of [1,2.2,S3.omni.curve(100).scale]){
    for(const [id,base,per,machine] of [['sledge',45,15,1.5],['hammer',65,15,1.5],['eightball',85,15,1]]){
      for(const rank of [1,3]){
        const s=make({id,lv:rank},{impactDrive:2,closeGuard:2},scale),e=s.en[0],hp=e.hp;
        cast(s,e.x,e.y);near(hp-e.hp,((base+per*(rank-1))*scale+6)*machine*1.5,id);
        assert.ok(s.team[0].closeUntil>s.t);s.p.inv=0;
        const h=s.p.hp;A.hitPlayer(s,20);near(h-s.p.hp,14,'contact guard');
      }
    }
    const s=make('mine',{bigbang:1},scale),e=s.en[0];e.x=s.p.x;e.y=s.p.y;
    cast(s,e.x,e.y);sim.swapTo(s,1);go(s,42);
    near(10000-e.hp,25*scale*1.2,'placed mine retains planter; later operator has no Bigger charge');
  }
  // Personal bonuses are flat after room scaling; a gear strike does not also inherit the base fist.
  for(const [id,base] of [['sledge',45],['hammer',65],['eightball',85]]){
    const s=make(id,{},2.2,'relay',{skills:{hack:1,physical:2,social:0},job:'heavy_lift',traits:['strong'],quirks:['knitting'],person:{imprints:['arcscar']}},[foe('heavy',800,730),anchor()]);
    const e=s.en[0];cast(s,e.x,e.y);near(10000-e.hp,base*2.2+2*6+20+12+4+10,id+' personal melee bonuses');
  }
  for(const [lv,part] of [[1,24],[2,32],[3,40]]){
    const s=make({id:'rush',lv},{impactDrive:2,closeGuard:1},2.2),e=s.en[0];cast(s,e.x,e.y);go(s,18);
    near(10000-e.hp,(26+part*2.2)*1.5,'rush adds scaled gear impact to personal melee');assert.equal(s.team[0].blocks,1);
  }
  // Eagle EMP damage grows with rank / room, but the machine shutdown itself is fixed.
  for(const lv of [1,3]){
    const s=make({id:'eagle',lv},{bigbang:1,conductor:2},2.2),e=s.en[0];
    e.stun=0;cast(s,e.x,e.y);go(s,32);sim.swapTo(s,1);s.recon.t=.001;
    assert.ok(e.mark>0,'orbit scans the target before detonation');sim.step(s,pad());near(10000-e.hp,(35+10*(lv-1))*2.2*1.2*1.3,'marked EMP after relay swap');near(e.stun,4,'fixed machine EMP');
  }
  const c=make('sledge',{impactDrive:2,closeGuard:2}),target=c.en[0];
  cast(c,800,899);assert.ok(!c.team[0].closeUntil);const hp=target.hp;
  A.hurt(c,target,20,{by:'ally'});near(hp-target.hp,20,'allies do not borrow contact');assert.ok(!c.team[0].closeUntil);
  // A wide spread can put several bullets on one dash. Immunity after the dash and heavy shots do not qualify.
  for(const [id,mode] of [[null,'relay'],['quickstep','relay'],['rush','field']]){
    const s=make(id,{threadNeedle:2},1,mode,{},[anchor()]),p=s.p,m=s.team[0];p.focus=0;m.st.focusRegen=0;
    const shot=(heavy=false)=>({x:p.x,y:p.y-32,vx:0,vy:2200,life:1,r:3,dmg:7,side:'e',heavy});
    s.bul.push(shot(true));sim.step(s,pad(id?{g1:true}:{dash:true}));near(p.focus,0,'heavy shot');
    const h=p.hp;s.bul.push(shot(),shot());sim.step(s,pad());near(p.focus,24,'two real intersections');assert.equal(s.ev.filter(v=>v.k==='focusSlip' && v.n===24).length,1);near(p.hp,h,'dodge');
    s.bul=[];go(s,24);p.inv=1;s.bul.push(shot());sim.step(s,pad());near(p.focus,24,'i-frames are not a dash');
    s.bul=[];p.dashN=1;s.bul.push(shot());sim.step(s,pad({dash:true}));near(p.focus,48,'new dash');
  }
  for(const mode of ['relay','field']){
    const s=make('medbeacon',{medic:2},1,mode,{},[anchor()]),p=s.p;p.hp=12;
    cast(s,p.x,p.y);near(s.installations[0].heal,8.4,'ward rate');s.installations=[];
    const h=p.hp;s.picks.push({k:'med',x:p.x,y:p.y,t:0,v:15,vx:0,vy:0});sim.step(s,pad());near(p.hp-h,21,'field medkit');assert.equal(s.ev.find(v=>v.k==='pickup').n,21);
    p.hp=p.maxHp-2;s.team[1].hp=s.team[1].maxHp-5;s.ev=[];s.picks.push({k:'med',x:p.x,y:p.y,t:0,v:15,vx:0,vy:0});sim.step(s,pad());near(p.hp,p.maxHp,'collector topped off');near(s.team[1].hp,s.team[1].maxHp,'unused healing shared');assert.equal(s.ev.find(v=>v.k==='pickup').n,7);
    const a=make('spider',{puppet:1},1,mode);cast(a,800,720);near(a.pets[0].t+sim.DT,17.6,'spider uptime');
    sim.swapTo(a,1);a.bul=[];a.pets[0].cd=0;sim.step(a,pad());
    const b=a.bul.find(v=>v.by==='ally');assert.equal(b.owner,0);near(b.dmg,11.2,'spider uses original operator');
  }
  let s=field('paramedic',[anchor()],null,'station',{medic:2,triage:3});cast(s,s.p.x,s.p.y);
  near(s.installations[0].heal,23.8,'clinic triage first; field medicine once');
  s=make(null,{thermal:2},1,'relay',{},[foe('heavy',800,600),anchor()]);const e=s.en[0];
  s.bul.push({side:'p',owner:0,x:e.x,y:e.y,vx:0,vy:0,life:1,r:3,dmg:1,burn:3});
  sim.step(s,pad());assert.equal(e.burnOwner,0);sim.swapTo(s,1);const h=e.hp;go(s,2);near(h-e.hp,5.625,'burn after swap');
  s=field('anarchist',[foe('turret',800,610),foe('heavy',835,610),anchor()],null,'fuse',{fragments:1,bigbang:1});
  s.spec.scale=2.2;A.raise(s);const [machine,victim]=s.en;victim.hp=2000;victim.stun=15;s.p.bw=20;
  sim.step(s,pad({hack:true,ax:machine.x,ay:machine.y}));assert.equal(machine.operator,0);sim.swapTo(s,1);
  s.ev=[];A.kill(s,machine,{by:'gun',owner:1});
  const boom=s.ev.find(v=>v.k==='boom'),hit=s.ev.find(v=>v.k==='hit' && v.id===victim.id);
  near(boom.r,216,'scrap charge radius');near(hit.n,65*2.2*1.2*(1-.4*Math.max(0,Math.hypot(victim.x-machine.x,victim.y-machine.y)-victim.r)/216),'scrap uses maker after swap');
  s=field('anarchist',[foe('turret',800,610),foe('heavy',835,610),anchor()],null,'fuse',{bigbang:1});
  s.spec.scale=2.2;A.raise(s);const [drone,other]=s.en;other.hp=2000;other.stun=15;s.p.bw=20;
  sim.step(s,pad({hack:true,ax:drone.x,ay:drone.y}));sim.swapTo(s,1);drone.ally=.001;s.ev=[];sim.step(s,pad());
  const pops=s.ev.filter(v=>v.k==='boom');assert.deepEqual(Array.from(pops,v=>v.r),[96,162]);assert.ok(drone.dead);
  const hits=s.ev.filter(v=>v.k==='hit' && v.id===other.id);assert.equal(hits.length,2);
  hits.forEach((v,i)=>near(v.n,[20,65][i]*2.2*1.2*(1-.4*Math.max(0,Math.hypot(v.x-pops[i].x,v.y-pops[i].y)-other.r)/pops[i].r),'ordinary expiry plus scrap, original maker'));
  console.log('PASS loadouts: contact and mine growth, guard on hits only, three dash types, medical delivery, burn, machines and delayed-owner attribution');
};
