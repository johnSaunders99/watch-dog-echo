'use strict';
const assert=require('assert/strict');
exports.kits=({field,foe,anchor,pad,go,cast,sim,A})=>{
  const almost=(a,b)=>assert.ok(Math.abs(a-b)<.051,a+' != '+b);
  for(const kit of ['contract','runner']){
    const s=field('hitman',[foe('heavy',800,720),anchor()],null,kit,{reprieve:2,sidesteps:2});
    const e=s.en[0];e.state='combat';e.hp=2000;s.p.hp=15;s.p.bw=0;s.p.focus=0;
    sim.step(s,pad({melee:true}));assert.ok(e.dead && s.team[0].execCd===4 && s.p.bw>=1 && s.p.focus>=12);
    almost(s.p.hp,15+s.p.maxHp*.1);const a=s.en[0];a.hp=9;
    A.hurt(s,a,300,{by:'env'});almost(s.p.hp,15+s.p.maxHp*.1);
  }
  let s=field('hitman',[foe('turret',800,520),anchor()]);const victim=s.en[0],ammo=s.p.ammo,g=s.p.gad[0],before=victim.hp;
  cast(s,800,520);assert.ok(g.armed && !g.cd);cast(s,800,520);assert.ok(!g.armed && !g.cd);cast(s,800,520);
  s.p.reload=.25; // Independent launcher even while the rifle is reloading.
  sim.step(s,pad({ax:800,ay:520,fire:true}));assert.ok(!g.armed && g.cd>7 && s.p.ammo===ammo && s.payloads.length===1);
  go(s,25);assert.ok(victim.hp<before);
  s=field('spy',[foe('guard',800,675),anchor()],null,'undercover');s.en[0].ang=-Math.PI/2;assert.equal(sim.takedownTarget(s),s.en[0]);
  for(const [i,e] of s.en.entries()){e.state='combat';e.call=i+.3;}cast(s,800,650);assert.equal(s.en[0].call,0);assert.ok(s.en[1].call>1);
  s.alert=true;s.p.gad[0].cd=0;s.en[1].atk={k:'burst',t:1};cast(s,800,650);assert.ok(s.alert && !s.en[1].atk);
  for(const kit of ['turnstile','terrace']){
    s=field('hooligan',[foe('guard',800,735),anchor()],null,kit);s.en[0].stun=4;s.p.hp=40;sim.step(s,pad({melee:true}));almost(s.p.hp,45);
  }
  for(const n of [0,1,3]){
    s=field('hooligan',[...Array.from({length:n},(_,i)=>foe('guard',800,715-i*39)),anchor()],null,'turnstile');
    cast(s,800,450);go(s,18);assert.equal(s.team[0].blocks,Math.min(n,2));
    if(n){s.p.inv=0;const h=s.p.hp;A.hitPlayer(s,5,{direct:true});almost(s.p.hp,h);s.p.inv=0;A.hitPlayer(s,5);assert.ok(s.p.hp<h);}
  }
  for(const kit of ['apiary','veilguard']){
    s=field('beekeeper',[foe('guard',800,705),anchor()],null,kit);const e=s.en[0];s.alert=true;e.state='combat';e.stun=.01;e.speed=0;e.cd=50;e.hp=500;
    cast(s,e.x,e.y);go(s,63);assert.ok(e.beeOpen>s.t && sim.takedownTarget(s)===e);
    if(kit==='veilguard'){
      const z=s.zones[0];s.p.inv=s.p.guard=0;
      for(let i=0;i<4;i++){s.bul.push({side:'e',x:s.p.x-22,y:s.p.y,vx:1200,vy:0,r:4,life:1,dmg:8});sim.step(s,pad());}
      assert.equal(z.blocks,0);assert.ok(s.p.hp<s.p.maxHp);
    }
  }
  for(const [rank,rate] of [[1,.03],[2,.05]]){
    s=field('hitman',[foe('turret',800,425),anchor()],null,'runner',{reprieve:rank,sidesteps:1});s.p.hp=15;
    const e=s.en[0];e.hp=10;A.hurt(s,e,1000,{by:'gun',owner:0});almost(s.p.hp,15+10*rate);
    const other=s.en[1];A.hurt(s,other,10,{by:'ally'});A.hurt(s,other,10,{by:'env'});almost(s.p.hp,15+10*rate);
    sim.swapTo(s,1);const health=s.p.hp;A.hurt(s,other,10,{by:'gun',owner:0});almost(s.team[0].hp,15+20*rate);almost(s.p.hp,health);
  }
  s=field('beekeeper',[{kind:'boss',boss:'keystone',x:800,y:545},anchor()],null,'apiary');
  const boss=s.en[0];s.p.cloak=30;boss.open=20;boss.hp=3000;boss.cd=30;cast(s,boss.x,boss.y);go(s,64);
  assert.ok(boss.royalUntil>s.t && !(boss.beeOpen>s.t));const hp=boss.hp;A.hurt(s,boss,100,{by:'gun'});almost(hp-boss.hp,145);
  s=field('hypnotist',[anchor()],null,'beat');cast(s,1200,400);go(s,90);assert.ok(s.team[0].beatUntil>s.t);
  sim.step(s,pad({fire:true,ax:1200,ay:350}));assert.ok(s.bul.some(b=>b.downbeat) && !s.team[0].beatUntil);
  console.log('PASS shared kits: both hitmen / spies / hooligans; launcher, callsign, actual damage and cap, rush 0/1/2, bee openings and three intercepts');
};

exports.ordnance=({S3,sim,A,build,arena,foe,pad,go})=>{
  const at={x:825,y:375},aim={ax:at.x,ay:at.y},near=(a,b)=>assert.ok(Math.abs(a-b)<.001,a+' != '+b);
  function make(id,{scale=1,sector=0,lv=1,xp={},deployment='relay',en=[{kind:'turret',...at}],shooter={},slot2={},props=[]}={}){
    const member=build({weapon:id==='execute'?'rifle':'match',exploits:xp,gadgets:id==='barrel'?[]:[{id,lv}],...shooter});
    return sim.createRoom({...arena({enemies:en,props}),scale,sector},{deployment,squad:[member,build(slot2),build()]});
  }
  const fire=(s,id,focus=false)=>sim.step(s,pad({...aim,g1:true,fire:id==='execute',focus}));
  function impacts(id,opts={}){
    const oil=id==='barrel',s=make(id,{...opts,props:oil?[{kind:'barrel',tx:16,ty:7,w:1,h:1}]:[]}),e=s.en[0],hits=[];
    A.raise(s);e.maxHp=e.hp=1e5;e.cd=30;if(!e.boss)e.stun=5;
    s.baseData=opts.data||0;
    if(opts.open)e.open=10;
    if(oil)s.props[0].fuse=.001;else fire(s,id,opts.focus);
    for(let i=0;i<135;i++){s.ev.length=0;sim.step(s,pad());if(s.ev.some(v=>v.k==='boom'||v.k==='shock'))hits.push(s.ev.find(v=>v.k==='hit'&&v.id===e.id).n);}
    return hits;
  }
  for(const scale of [1,1.5,2.2,S3.omni.curve(100).scale]){
    const oil=impacts('barrel',{scale})[0];near(oil,60*scale);
    const grenade=impacts('execute',{scale}),rounds=impacts('strike',{scale});
    assert.equal(grenade.length,1);near(grenade[0],140*scale);assert.ok(grenade[0]>2*oil);
    assert.equal(rounds.length,3);rounds.forEach(n=>near(n,1.5*oil));
  }
  for(const [id,levels] of Object.entries({execute:[140,175,210],strike:[90,114,138],cargo:[75,95,115],sergei:[70,90,110],kamikaze:[30,42,54]}))
    for(let i=0;i<3;i++)near(impacts(id,{scale:2.2,lv:i+1})[0],levels[i]*2.2);
  near(impacts('execute',{scale:2.2,lv:3,xp:{bigbang:2,hollow:2}})[0],814.275);
  near(impacts('strike',{scale:2.2,lv:3,xp:{bigbang:2,hollow:2}})[0],437.184);
  for(const [data,hit] of [[0,140],[250,175],[500,210],[850,210]])near(impacts('execute',{data,xp:{hoard:1}})[0],hit);
  const conditional={xp:{hoard:1,reflex:1,bigbang:1},data:500,focus:true,sector:1,shooter:{traits:['nightowl']}};
  near(impacts('execute',conditional)[0],140*(1.5*1.4*1.1+.2));
  near(impacts('execute',{...conditional,sector:0,focus:false})[0],140*(1.5+.2));
  impacts('strike',conditional).forEach(n=>near(n,90*1.2));
  // Real mask + launcher: arming/cancelling never spends the opener. Cash and focus are read on firing, not landing.
  const masked=make('execute',{xp:{hoard:1,reflex:1},shooter:{gadgets:[{id:'execute',lv:1},{id:'mask',lv:1}]}});
  A.raise(masked);const maskTarget=masked.en[0];maskTarget.hp=2000;maskTarget.stun=5;
  sim.step(masked,pad({g2:true}));for(let i=0;i<3;i++)sim.step(masked,pad({...aim,g1:true}));
  assert.ok(masked.p.cloak>0 && masked.p.gad[0].armed);
  masked.baseData=200;masked.gain=50;const mag=masked.p.ammo;
  sim.step(masked,pad({...aim,fire:true,focus:true}));assert.equal(masked.p.cloak,0);
  masked.baseData=500;go(masked,35);near(2000-maskTarget.hp,140*1.25*1.4*3);assert.equal(masked.p.ammo,mag);assert.equal(masked.p.shots,0);
  // Both victims are at the centre; suppression is evaluated against each victim and never silences the impact.
  const ambush=make('execute',{xp:{silencer:1},en:[{kind:'turret',...at},{kind:'turret',...at}]});
  const [unaware,fighting]=ambush.en;for(const e of ambush.en){e.hp=1000;e.stun=5;}
  fighting.state='combat';fire(ambush,'execute');assert.ok(!ambush.ev.some(e=>e.k==='noise'));
  const heard=go(ambush,32);near(1000-unaware.hp,210);near(1000-fighting.hp,140);
  assert.ok(heard.includes('noise') && heard.includes('boom') && !ambush.alert);
  // One explosion can earn weapon lifesteal per enemy and one blast kill refund, never a second kill or overkill healing.
  const hitman={person:S3.ops.person('hitman','leech','contract')};
  const bullet=make('execute',{xp:{hoard:1,reflex:1,reprieve:2},shooter:{...hitman,traits:['nightowl']},sector:1});
  A.raise(bullet);bullet.baseData=500;bullet.en[0].hp=1000;bullet.en[0].stun=5;bullet.en[0].elite='armored';
  bullet.st.spreadMul=bullet.st.critChance=0;bullet.p.hp=10;sim.step(bullet,pad({...aim,fire:true,focus:true}));go(bullet,32);
  const gunHit=18*1.5*1.4*1.1*.7;near(1000-bullet.en[0].hp,gunHit);near(bullet.p.hp,10+gunHit*.05);assert.equal(bullet.p.shots,1);
  for(const [deployment,rank] of [['relay',1],['field',2]]){
    const s=make('execute',{shooter:hitman,deployment,xp:{reprieve:rank,botfarm:1},en:[{kind:'turret',...at},foe('turret',at.x+75,at.y)]});
    A.raise(s);const [last,edge]=s.en;last.hp=60;edge.hp=1000;edge.elite='armored';
    for(const e of s.en)e.stun=8;
    for(const m of s.team){m.st.bwRegen=0;if(m.ai)m.ai.wing=()=>pad();}
    s.p.bw=0;s.p.hp=10;fire(s,'execute');const z=s.payloads[0];
    const edgeHit=140*(1-.4*(Math.hypot(z.x-edge.x,z.y-edge.y)-edge.r)/110);
    assert.ok(sim.swapTo(s,1));const partnerHp=s.p.hp,partnerBw=s.p.bw;go(s,30);
    assert.ok(last.dead);near(1000-edge.hp,edgeHit);near(s.team[0].hp,10+(60+edgeHit)*(rank===1?.03:.05));near(s.p.hp,partnerHp);
    assert.equal(s.stats.kills,1);assert.equal(s.stats.envKills,1);near(s.fireteam?s.team[0].body.bw:s.p.bw,1);
    if(s.fireteam)near(s.p.bw,partnerBw);
  }
  // The launcher lights a barrel. An enemy outside the grenade but inside the second blast cannot heal the shooter.
  const chain=make('execute',{shooter:hitman,xp:{reprieve:2},props:[{kind:'barrel',tx:18,ty:7,w:1,h:1}],en:[foe('turret',1005,375)]});
  A.raise(chain);chain.en[0].hp=1000;chain.en[0].stun=8;chain.p.hp=10;fire(chain,'execute');
  assert.equal(go(chain,72).filter(k=>k==='boom').length,2);assert.ok(chain.en[0].hp<1000);near(chain.p.hp,10);
  const scrap=make('execute',{shooter:hitman,xp:{reprieve:2,salvage:1},en:[foe('turret',at.x+80,at.y),foe('turret',at.x+161,at.y)]});
  A.raise(scrap);const [wreck,adjacent]=scrap.en;wreck.hp=20;adjacent.hp=1000;wreck.stun=adjacent.stun=8;scrap.p.hp=10;
  fire(scrap,'execute');const aftermath=go(scrap,32);
  assert.ok(wreck.dead && aftermath.includes('shock'));assert.ok(adjacent.hp<1000 && adjacent.hp>=992);near(scrap.p.hp,11);
  const fallen=make('execute',{shooter:hitman,xp:{reprieve:2}});A.raise(fallen);fallen.en[0].hp=1000;fallen.en[0].stun=8;
  fire(fallen,'execute');fallen.p.inv=fallen.p.guard=0;A.hitPlayer(fallen,9999);assert.ok(fallen.team[0].down && fallen.active===1);
  const standIn=fallen.p.hp;go(fallen,32);near(fallen.en[0].hp,860);near(fallen.team[0].hp,0);near(fallen.p.hp,standIn);
  const core={en:[{kind:'boss',boss:'keystone',...at}],scale:2.2};
  near(impacts('strike',core).reduce((a,b)=>a+b,0),237.6);near(impacts('strike',{...core,open:true}).reduce((a,b)=>a+b,0),594);
  // A blast is audible. An unseen shooter, even one who hit a survivor, is not an identified intruder.
  for(const id of ['strike','execute']){
    const s=make(id,{en:[{kind:'heavy',...at},foe('guard',1080,455)]}),[survivor,guard]=s.en;
    for(const e of s.en){e.hp=2000;e.speed=0;e.ang=e.base=-Math.PI/2;}
    fire(s,id);assert.ok(!s.alert && !s.en.some(e=>e.call));
    go(s,55);assert.ok(survivor.hp<2000 && survivor.state==='suspect' && guard.state==='suspect' && !guard.call);
    assert.ok(Math.hypot(guard.goal.x-at.x,guard.goal.y-at.y)<10);
    go(s,100);assert.ok(!s.alert && !s.en.some(e=>e.call));
    guard.x=s.p.x+180;guard.y=s.p.y;guard.ang=guard.base=Math.PI;guard.aware=.98;
    for(let i=0;i<8 && !guard.call;i++)sim.step(s,pad());
    assert.ok(guard.call>1 && !s.alert);go(s,85);assert.ok(s.alert);
    const quiet=make(id,{en:[{kind:'guard',...at}]});fire(quiet,id);go(quiet,120);assert.ok(quiet.cleared && quiet.silent && !quiet.alert);
  }
  // One trigger pull can never spill into loud rifle or wing fire. A new rifle trigger still raises the alarm.
  const group=make('execute',{deployment:'field',en:[{kind:'heavy',...at},foe('guard',1120,355)]});
  group.en.forEach(e=>{e.hp=2e3;e.speed=0;e.ang=e.base=-Math.PI/2;});
  fire(group,'execute');const fly=group.payloads[0];assert.ok(fly && !group.p.gad[0].armed);
  go(group,115,pad({...aim,fire:true}));assert.ok(!group.alert && !S3.fireteam.covering(group) && group.team.every(m=>!m.body.shots));
  sim.step(group,pad());sim.step(group,pad({...aim,fire:true,g1:true}));assert.ok(!group.alert,'cooldown denial is not a rifle shot');
  sim.step(group,pad());sim.step(group,pad({...aim,fire:true}));assert.ok(group.alert && S3.fireteam.covering(group) && group.p.shots===1);
  // Swap before impact: only the launcher's vulnerabilities apply; radius, falloff and fixed self-damage survive upgrades.
  for(const id of ['strike','execute']){
    const s=make(id,{xp:{bigbang:1,shortcircuit:1},en:[{kind:'turret',...at},foe('turret',at.x+140,at.y)],slot2:{exploits:{shortcircuit:2}}});
    const [centre,edge]=s.en;centre.stun=edge.stun=8;centre.hp=edge.hp=2000;fire(s,id);
    const z=id==='strike'?s.zones[0]:s.payloads[0];assert.equal(z.r,S3.data.gadgets[id].r*1.2);assert.ok(sim.swapTo(s,1));go(s,40);
    near(2000-centre.hp,S3.data.gadgets[id].dmg*1.2*1.35);assert.ok(edge.hp<2000 && edge.hp>centre.hp);
  }
  for(const scale of [1,2.2]){
    const s=make('execute',{scale,lv:3,shooter:hitman,xp:{bigbang:2,reprieve:2}});s.p.inv=s.p.guard=0;const hp=s.p.hp;
    sim.step(s,pad({g1:true,fire:true,ax:s.p.x,ay:s.p.y}));go(s,15);near(hp-s.p.hp,12);
  }
  const emp=make('kamikaze',{xp:{bigbang:1},en:[foe('shield',at.x+260,at.y)]});emp.spec.mod='rain';
  const shield=emp.en[0];shield.stun=8;fire(emp,'kamikaze');const pulse=emp.zones[0];near(A.shockRadius(emp,pulse.r,pulse.owner),285.6);
  sim.swapTo(emp,1);go(emp,31);assert.ok(shield.hp<shield.maxHp && shield.noShield>4.9);
  for(const id of ['molotov','pipebomb']){
    const s=make(id,{xp:{bigbang:2}});fire(s,id);near(s.payloads[0].r,S3.data.gadgets[id].r*1.44);
  }
  const wing=make('execute',{xp:{bigbang:2},deployment:'field',en:[foe('turret',1100,450)]}),target=wing.en[0];
  sim.swapTo(wing,1);wing.alert=true;wing.tick=5;wing.order={kind:'focus',target};
  wing.team.forEach((m,i)=>Object.assign(m.body,{x:[200,600,500][i],y:[450,690,690][i]}));wing.team[0].gad[0].armed=true;
  const plan=()=>S3.fireteam.as(wing,0,()=>wing.team[0].ai.wing(wing));
  let decision=plan();assert.ok(!decision.fire && decision.g1,'wing unloads rather than wasting the grenade short of its target');
  target.x=705;Object.assign(wing.team[1].body,{x:715,y:460});decision=plan();assert.ok(!decision.fire && decision.g1,'actual splash reaches the leader');
  wing.team[1].body.y=690;assert.ok(plan().fire,'clear lane within range');
  console.log('PASS ordnance: real launcher Hoard (0/250/500/850 data => 140/175/210/210), focus, Night owl, mask, silenced ambush, capped-to-loss Berserk in both deployments, blast refund and no barrel leech; mortar, oil, armour, self-splash, alarm and OMNI 100');
};

exports.recruitment=({S3,E,R,crew,newMeta})=>{
  const m=newMeta();m.seed='alumni';m.echoes=10;m.unlocks={jobs:['hitman'],events:[]};m.invitations=['hitman'];
  m.offers={hitman:S3.ops.person('hitman','first','contract')};m.roster=crew.map(p=>({p,status:'ready'}));
  const fixed=R.volunteers(m)[0];assert.equal(fixed.template,'contract');assert.ok(R.recruit(m,0));assert.equal(m.echoes,10);
  const peer=R.volunteers(m)[0];assert.ok(peer.alumnus && peer.template==='runner' && E.people.name(peer).en!==E.people.name(fixed).en);
  assert.ok(R.hasCollectedKit(m,fixed) && !R.hasCollectedKit(m,peer));
  const bytes=JSON.stringify(peer);R.saveMeta(m);assert.equal(JSON.stringify(R.volunteers(R.meta())[0]),bytes);
  const full=JSON.parse(JSON.stringify(m));while(full.roster.length<R.rosterMax(full))full.roster.push(full.roster[0]);assert.ok(!R.recruit(full,0));assert.equal(JSON.stringify(R.volunteers(full)[0]),bytes);
  assert.ok(R.recruit(m,0));assert.equal(m.echoes,10-R.RECRUIT_COST);assert.equal(m.roster.filter(x=>x.p.elite==='hitman').length,2);
  R.dismiss(m,m.roster.length-1);assert.deepEqual([...m.collectedKits.hitman].sort(),['contract','runner']);assert.deepEqual([...m.unlocks.jobs],['hitman']);
  assert.ok(R.hasCollectedKit(m,peer));
  // A call rotates through people, not loadout rolls. Detention and the station reserve the same identity as a bunk.
  const clone=x=>JSON.parse(JSON.stringify(x)), casting=clone(m);
  casting.echoes=20;
  const four=Array.from({length:4},(_,i)=>R.volunteers({...casting,vol:i})[0]);
  assert.equal(new Set(four.map(p=>p.id)).size,4);
  for(let i=0;i<four.length;i++){
    const live=R.volunteers(casting)[0];assert.ok(!casting.roster.some(x=>x.p.id===live.id));
    assert.ok(R.recruit(casting,0));casting.roster[casting.roster.length-1].status=['held','station','ready','ready'][i];
  }
  assert.equal(R.volunteers(casting).length,2);assert.ok(!R.volunteers(casting).some(p=>p.alumnus));
  casting.unlocks.jobs.push('spy');assert.equal(R.volunteers(casting)[0].elite,'spy');
  const last=casting.roster.at(-1),gone=last.p;gone.imprints=['softstep'];last.runs=7;last.omniBest=50;
  assert.ok(R.dismiss(casting,casting.roster.length-1));const returning=R.meta();returning.invitations=['spy'];
  const back=R.volunteers(returning)[1];assert.equal(JSON.stringify(back),JSON.stringify(gone));assert.ok(R.recruit(returning,1));
  assert.equal(returning.alumniNames.filter(n=>n===gone.fixedName.en).length,1);assert.equal(returning.formerPeers[gone.id],undefined);
  assert.equal(returning.roster.at(-1).runs,7);assert.equal(returning.roster.at(-1).omniBest,50);assert.deepEqual([...returning.roster.at(-1).p.imprints],['softstep']);
  // A v5 procedurally generated colleague and an already-issued non-default offer stay exactly as saved.
  const legacy=clone(m),old={...crew[0],id:'alumni-hitman-7',elite:'hitman',alumnus:true,template:'runner',traits:['fast','nightowl'],quirks:['tea','choir']};
  legacy.roster.push({p:old,status:'held',runs:3});legacy.invitations=['spy'];legacy.offers={spy:{...S3.ops.person('spy','past','undercover'),traits:['strong','fast'],quirks:['gamer','tea']}};
  R.saveMeta(legacy);const before=JSON.stringify(old), restored=R.meta();
  assert.equal(JSON.stringify(restored.roster.at(-1).p),before);assert.equal(JSON.stringify(R.memberOf(restored.roster.at(-1).p).p),before);
  assert.equal(S3.ops.colleagueOf(old),undefined);assert.equal(S3.ops.lookOf(old),null);
  assert.equal(JSON.stringify(R.volunteers(restored)[0]),JSON.stringify(legacy.offers.spy));
  // A slot may get a new actor; service and recall stay with the person who actually served.
  {
    const book=R.newGame('random','recast-record',newMeta()).meta;
    book.unlocks.jobs=['hitman'];book.collectedKits={hitman:['runner','contract']};book.echoes=6;
    const retired=S3.ops.colleagueOf({id:'peer-hitman-a'}),newcomer=S3.ops.colleagues.hitman[0];
    assert.equal(retired.fixedName.en,'Mara Bellamy');assert.equal(newcomer.fixedName.en,'Marc Bellamy');
    const offer=id=>{for(let i=0;i<5;i++){book.vol=i;if(R.volunteers(book)[0].id===id)return true;}return false;};
    assert.ok(!offer(retired.id));const veteran=R.enlist(book,S3.ops.colleague(retired,true));
    veteran.p.imprints=['softstep'];veteran.runs=7;veteran.omniBest=50;
    assert.ok(R.dismiss(book,book.roster.indexOf(veteran)));
    assert.ok(offer(newcomer.id) && R.recruit(book,0));assert.equal(book.roster.at(-1).runs,0);
    assert.ok(!book.roster.at(-1).p.imprints && book.formerPeers[retired.id]);
    assert.ok(offer(retired.id) && R.recruit(book,0));
    const both=R.meta().roster.slice(-2);assert.notEqual(both[0].p.id,both[1].p.id);
    assert.equal(both[1].p.fixedName.en,'Mara Bellamy');assert.equal(both[1].runs,7);assert.equal(both[1].omniBest,50);
    assert.deepEqual([...both[1].p.imprints],['softstep']);
  }
  // In this rotation the second street slot would offer the exact same pilot as the paid special slot.
  const pilots=R.newGame('random','pilot-reserve-example',newMeta()).meta;pilots.vol=275;
  const streetPilot=R.volunteers(pilots)[1];assert.equal(streetPilot.id,'peer-drone_expert-a');
  pilots.unlocks.jobs=['drone_expert'];pilots.collectedKits={drone_expert:['flightdeck','gunship']};
  const offers=R.volunteers(pilots);assert.equal(offers[0].id,streetPilot.id);assert.equal(new Set(offers.map(p=>p.id)).size,3);
  const service=R.enlist(pilots,offers[0]);service.p.imprints=['softstep'];service.runs=3;assert.ok(R.dismiss(pilots,pilots.roster.length-1));
  const wire=S3.omni.create('pilot-return',pilots.roster.slice(0,3).map(x=>x.p),pilots);
  const recovered=S3.omni.rescue(wire,pilots,()=>streetPilot);assert.equal(recovered.p.id,streetPilot.id);assert.ok(!recovered.p.alumnus);
  assert.deepEqual([...recovered.p.imprints],['softstep']);assert.equal(pilots.roster.at(-1).runs,3);assert.equal(pilots.formerPeers[streetPilot.id],undefined);
  console.log('PASS volunteers: paid and free contacts, four fixed peers, custody, street pilots, retired and current identities, independent service on rehire');
};

exports.recruitDefense=args=>{
  exports.recruitment(args);
  const {sim,A,foe,anchor,pad,go,build,room}=args;
  let s=room({enemies:[foe('guard',800,590),anchor()]},{exploits:{breachPlate:2,closeGuard:2}});s.en[0].stun=10;
  sim.step(s,pad({dash:true,my:-1}));go(s,20);const m0=s.team[0];
  const hit=(args)=>{s.p.inv=s.p.guard=0;const h=s.p.hp;A.hitPlayer(s,10,args);return Math.round((h-s.p.hp)*100)/100;};
  assert.ok(m0.breachUntil>s.t);assert.equal(hit({ballistic:true,kx:0,ky:1}),6);assert.equal(hit({ballistic:true,kx:0,ky:-1}),10);assert.equal(hit({}),10);
  sim.step(s,pad({melee:true}));assert.ok(m0.closeUntil>s.t);assert.equal(hit({}),7);
  m0.closeUntil=s.t-1;assert.equal(hit({}),10);
  assert.ok(Math.abs(sim.stats(build({exploits:{plating:3}})).st.dmgTaken-.64946)<.001);
  s=room({enemies:[foe('guard',800,550)]});const e=s.en[0];e.state='combat';e.ang=Math.PI/2;e.atk={k:'burst',t:0,n:1};sim.step(s,pad());
  assert.ok(s.bul.some(b=>Math.abs(b.dmg-23.6)<1e-6));
  console.log('PASS frontline: guard 23.6, plating 35.05%, frontal 6 vs rear 10, close 7 vs expired 10');
};

exports.fireteam=({S3,R,sim,A,arena,foe,anchor,pad,go,crew,newMeta})=>{
  const people=['hooligan','paramedic','anarchist'].map((j,i)=>S3.ops.person(j,'squad-fixture',['turnstile','stretcher','bottle'][i]));
  const make=(en=[anchor()],deployment='field')=>{
    const meta=newMeta();meta.roster=people.map(p=>({p,status:'ready'}));const r=R.start('squad-proof',people,meta,deployment);r.node={type:'fight',reward:'data'};
    const spec=arena({enemies:en}),s=sim.createRoom(spec,R.simBuild(r),R.carry(r));return {s,r,meta,spec};
  };
  const freeze=s=>s.team.forEach(m=>{m.ai={wing:()=>pad()};});
  const first=make([foe('guard',800,375),anchor(),foe('guard',400,450),foe('guard',1200,450)]),{r,meta}=first;let s=first.s;
  assert.equal(s.fireteam,true);assert.equal(new Set(s.team.map(m=>m.body.x+':'+m.body.y)).size,3);assert.equal(s.waves.flat().length,2);
  const positions=s.team.map(m=>[m.hp,m.body.x,m.body.y]);const b=s.team[1].body;b.reload=1;b.guard=0;b.inv=0;b.gad[0].cd=3;
  assert.ok(sim.swapTo(s,1));assert.equal(s.p,b);assert.equal(s.p.inv,0);assert.equal(s.p.reload,1);assert.equal(s.team[1].gad[0].cd,3);assert.deepEqual(s.team.map(m=>[m.hp,m.body.x,m.body.y]),positions);
  sim.swapTo(s,0);sim.step(s,pad({command:true,ax:580,ay:690}));assert.equal(s.order.kind,'hold');go(s,18);assert.ok(Math.abs(b.gad[0].cd-(3-19/60))<1e-6 && Math.abs(b.reload-(1-19/60))<1e-6);go(s,126);
  assert.ok(s.team.slice(1).every(m=>Math.hypot(m.body.x-580,m.body.y-690)<80) && Math.hypot(b.x-s.team[2].body.x,b.y-s.team[2].body.y)>49,'both wings occupy separate posts on the commanded ground');
  assert.equal(s.team.reduce((n,m)=>n+m.body.shots,0),0);assert.equal(s.bul.filter(b=>b.side==='p').length,0);
  sim.step(s,pad({command:true,ax:s.en[0].x,ay:s.en[0].y}));assert.equal(s.order.kind,'focus');
  sim.step(s,pad({command:true,ax:s.p.x,ay:s.p.y}));assert.equal(s.order.kind,'follow');
  R.save(r);assert.equal(R.load().deployment,'field');assert.equal(R.simBuild({...r,omni:{overflow:{}}}).deployment,'relay');R.clear();
  const legacy=make([anchor()],'relay').s,old=legacy.p;sim.swapTo(legacy,1);assert.equal(legacy.p,old);assert.ok(legacy.swapCd && !legacy.fireteam);
  s=make([foe('guard',800,695),foe('guard',1080,720),anchor()]).s;A.raise(s);S3.fireteam.coverShot(s);
  const [offered,other]=s.en;offered.state='combat';offered.stun=10;other.state='combat';s.team[0].body.x=800;s.team[0].body.y=755;other.hp=other.maxHp=2000;
  go(s,45);assert.ok(!offered.dead && offered.hp===offered.maxHp,'save the close takedown');assert.ok(s.team.slice(1).some(m=>m.body.shots || m.gad[0].cd>0),'allies use weapons or kits');
  assert.ok(!s.payloads.some(z=>s.team.some(m=>Math.hypot(m.body.x-z.x,m.body.y-z.y)<z.r)),'no blast under an ally');
  s=make([anchor()]).s;freeze(s);s.team.forEach((m,i)=>{m.body.x=300+i*320;m.body.y=600;m.body.inv=m.body.guard=0;});
  const e=s.en[0],front=s.team[1];e.x=front.body.x+10;e.y=front.body.y-60;e.state='combat';assert.equal(S3.fireteam.enemySlot(s,e),1);
  const oldHp=s.team.map(m=>m.hp);s.bul.push({side:'e',x:front.body.x-25,y:600,vx:1300,vy:0,life:1,r:4,dmg:12});sim.step(s,pad());
  assert.ok(front.hp<oldHp[1] && s.team[0].hp===oldHp[0] && s.team[2].hp===oldHp[2]);
  const FT=S3.data.fireteam,aidTicks=Math.ceil(FT.aid*60);
  S3.fireteam.as(s,1,()=>{s.p.guard=s.p.inv=0;A.hitPlayer(s,2000);});assert.ok(front.down && front.rescue===FT.rescue);assert.ok(!sim.swapTo(s,1));
  s.p.x=front.body.x-33;s.p.y=front.body.y;go(s,aidTicks-6);assert.ok(front.down,'a revive takes the full aid time');
  go(s,8);assert.ok(!front.down && front.hp>0 && front.hp<=Math.ceil(front.maxHp*FT.reviveHp)+1 && s.active===0,'revived with the reduced share of health');
  const t=make([anchor()]);s=t.s;freeze(s);s.team[0].body.x=190;s.team[1].body.x=790;s.team[2].body.x=1120;s.en[0].stun=100;
  S3.fireteam.as(s,1,()=>{s.p.guard=s.p.inv=0;A.hitPlayer(s,2000);});go(s,Math.ceil(FT.rescue*60)+5);assert.equal(s.team[1].rescue,0);
  R.finishRoom(t.r,s,t.meta);assert.equal(t.r.stats.captured,1);assert.ok(t.r.squad[1].down);
  s=make([anchor()]).s;freeze(s);s.en.forEach(e=>e.dead=true);s.waves=[];sim.step(s,pad());s.team[1].body.x=s.cache.x;s.team[1].body.y=s.cache.y;go(s,12);
  assert.ok(!s.cache.taken && s.exit<0,'wing cannot open the cache or doors');
  // Same grenade, same aim: unsafe near a friendly, usable once the lane is clear.
  s=make([foe('guard',800,500),foe('guard',840,510)]).s;A.raise(s);S3.fireteam.coverShot(s);s.team[2].body.x=800;s.team[2].body.y=760;
  s.team[0].body.x=801;s.team[0].body.y=507;s.tick=4;
  const plan=()=>S3.fireteam.as(s,2,()=>s.team[2].ai.wing(s));
  assert.ok(!plan().g1,'wing withholds an incendiary at friendly feet');s.team[0].body.x=380;assert.ok(plan().g1,'wing actually throws on a clear lane');
  // Lethal area damage is resolved for every body; a down and clear in the same room must not create custody.
  const healed=make([anchor()]);s=healed.s;freeze(s);s.team[1].body.inv=s.team[1].body.guard=0;
  S3.fireteam.as(s,1,()=>A.hitPlayer(s,2000));s.waves=[];s.en[0].dead=true;sim.step(s,pad());
  assert.ok(!s.team[1].down);R.finishRoom(healed.r,s,healed.meta);assert.equal(healed.r.stats.captured,0);
  require('./check-s3-squad-ai')({S3,sim,A,arena,foe,pad,go});
  console.log('PASS fireteam: deployment round-trip, distinct bodies and ammo/cooldowns, 4+2 enemies, 3 orders, stealth and reserved target, enemy targeting, rescue vs custody, leader-only cache; legacy relay and OMNI unchanged');
};
