'use strict';
const assert=require('node:assert/strict');
module.exports=({S3,sim,A,arena,foe,pad,go})=>{
  const body=weapon=>({weapon,skills:{physical:1,hack:1,social:1},traits:[],quirks:[],exploits:{},gadgets:[]});
  const build={deployment:'field',squad:['rifle','pistol','pistol'].map(body)};
  const s=sim.createRoom(arena({enemies:[foe('hound',800,721),foe('guard',1000,475)]}),build);
  const [dog,guard]=s.en;dog.ang=dog.base=Math.PI/2;dog.hp=dog.maxHp=10000;dog.cd=90;dog.speed=0;
  guard.hp=guard.maxHp=20000;guard.stun=40;s.waves=[];
  const shots=()=>s.team.slice(1).map(m=>m.body.shots),at=e=>({ax:e.x,ay:e.y});
  sim.step(s,pad({...at(dog),melee:true}));assert.ok(dog.hp<dog.maxHp && dog.call>0 && !s.alert);
  go(s,25);assert.deepEqual(shots(),[0,0],'a loud wing must not join a quiet punch');
  go(s,100);assert.ok(s.alert,'the surviving hound really called the alarm');assert.deepEqual(shots(),[0,0],'an enemy call is not a fire order');
  A.kill(s,dog,{by:'melee'});sim.step(s,pad({...at(guard),fire:true}));go(s,75);
  const burst=shots();assert.ok(burst.every(n=>n>0),'both wings cover a real rifle shot: '+JSON.stringify({burst,lead:s.p.shots,until:s.coverUntil,rt:s.rt,alert:s.alert,en:s.en.map(e=>[e.kind,e.state,e.hp]),bodies:s.team.map(m=>[m.down,m.body.x,m.body.y])}));
  go(s,240);assert.deepEqual(shots(),burst,'holding position in the same alarm cannot renew the burst');
  sim.step(s,pad({...at(guard),command:true}));go(s,110);const focused=shots();go(s,110);
  assert.ok(shots().every((n,i)=>n>focused[i]),'sustained fire needs a live focus order');
  sim.step(s,pad({...at(s.p),command:true}));const recalled=shots();go(s,100);assert.deepEqual(shots(),recalled,'recall stops both guns');
  const spare=A.spawn(s,'turret',1150,500);spare.stun=30;
  sim.step(s,pad({...at(guard),command:true}));go(s,20);
  sim.step(s,pad({...at(guard),fire:true}));assert.ok(S3.fireteam.covering(s));A.kill(s,guard,{by:'gun'});
  const before=shots();go(s,100);assert.deepEqual(shots(),before,'a dead mark never hands the order to another enemy');
  const hidden=sim.createRoom(arena({enemies:[foe('turret',825,405)]}),build);
  hidden.solid[A.idx(16,10)]=1;const target=hidden.en[0];A.raise(hidden);hidden.team[1].body.x=825;hidden.team[1].body.y=720;
  S3.fireteam.command(hidden,target.x,target.y);
  assert.ok(!S3.fireteam.as(hidden,1,()=>hidden.team[1].ai.wing(hidden)).fire,'a marked gun may not shoot through a wall');
  const flanked=sim.createRoom(arena({enemies:[{...foe('shield',800,500),elite:'firewall'}]}),build),pilotG=S3.bot.create('mark-firewall');
  flanked.en[0].ang=Math.PI/2;assert.ok(!pilotG.act(flanked).command,'a patrol is not a reason to give away the squad');
  A.raise(flanked);const mark=pilotG.act(flanked);assert.ok(mark.command && mark.ax===800 && mark.ay===500);
  sim.step(flanked,mark);assert.equal(flanked.order.target,flanked.en[0]);assert.ok(!pilotG.act(flanked).command,'do not toggle the mark back off');

  function beamRoom(boss,dir,opposite,field,warning=0){
    const spec=arena({enemies:[{kind:'boss',boss,x:800,y:440}]});spec.boss=boss;
    const h=sim.createRoom(spec,field?build:body('pistol')),e=h.en[0],side=opposite?-1:1;
    e.atk={k:'laser',dir,rate:1,go:!warning,t:warning||1.5,dur:1.5,ang:-dir*.14};
    if(field){h.team[0].body.x=800;h.team[0].body.y=710;}
    for(const [i,m] of h.team.entries())if(!field || i){
      const p=m.body??h.p;Object.assign(p,{x:800+side*(i===2?408:300),y:440,inv:0,guard:0,bw:0});
    }
    return h;
  }
  let crossings=0;
  for(const [boss,opposite] of [['carrier',false],['keystone',false],['keystone',true]])for(const dir of [1,-1]){
    const still=beamRoom(boss,dir,opposite,false);go(still,32);assert.ok(still.p.hp<still.p.maxHp,'the exact same beam hits a stationary player');
    for(const field of [false,true]){
      const h=beamRoom(boss,dir,opposite,field),bot=S3.bot.create('counter-sweep');
      const order=()=>field?pad():bot.act(h);
      const members=field?h.team.slice(1):[h.team[0]],bodies=members.map(m=>m.body??h.p);
      const plans=field?members.map(m=>S3.fireteam.as(h,h.team.indexOf(m),()=>m.ai.wing(h))):[bot.act(h)];
      assert.ok(plans.every(q=>q.dash && q.my*dir*(opposite?-1:1)<-.7),'dash across the approaching arm, in both directions');
      go(h,32,order);assert.ok(bodies.every(p=>p.hp===p.maxHp),'cross the real sweeping damage line without losing health');crossings+=bodies.length;
    }
  }
  const warn=beamRoom('keystone',1,true,false,.8),pilot=S3.bot.create('early');
  const early=pilot.act(warn);assert.ok(early.my>.7 && !early.dash,'walk out of the rear warning before the endpoint is drawn');
  const blocked=beamRoom('carrier',1,false,false);blocked.solid[A.idx(19,8)]=1;
  assert.ok(!pilot.act(blocked).dash,'solid cover blocks the beam; keep the charge');
  const corner=beamRoom('carrier',1,false,false);corner.p.x=1123;corner.p.y=418;corner.solid[A.idx(22,7)]=1;
  corner.en[0].atk.ang=Math.atan2(-22,323)-.1;
  const escape=pilot.act(corner);assert.ok(escape.dash && Math.abs(escape.mx)>.3,'take a clear diagonal instead of dashing into the wall');
  const x=corner.p.x;go(corner,20,()=>pilot.act(corner));assert.ok(Math.abs(corner.p.x-x)>30 && corner.p.hp===corner.p.maxHp);
  const empty=beamRoom('carrier',1,false,false);empty.p.dashN=0;
  const walk=pilot.act(empty);assert.ok(!walk.dash && walk.my>0,'without invulnerability, try to stay ahead rather than cross a live beam on foot');
  console.log('PASS wing discipline: hound punch and actual alarm 0/0 shots, one rifle burst '+burst.join('/')+', four seconds idle unchanged, focus/recall/dead mark/wall; '+crossings+' live laser crossings without damage (both sweeps, both core arms, leader and wings), warning, hard cover, corner and empty dash');
};
