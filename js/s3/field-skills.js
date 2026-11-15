/* Field equipment. All timers, placement and orders belong to the room, not the renderer. */
(function (S) {
  'use strict';
  const A=S.sim.api, dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), live=e=>!e.dead && e.ally<=0 && e.spawnT<=0;
  const nearby=(s,from,e,r)=>dist(from,e)<=r+e.r && A.clear(s,from.x,from.y,e.x,e.y,true);
  function audience(s,e) {
    return !!(s.show && live(e) && e.def.human && !e.elite && !e.boss && nearby(s,s.show,e,s.show.r));
  }
  function curtain(s) {
    if(s.show?.encore) for(const e of s.en) if(audience(s,e)) A.stun(s,e,1.6);
    s.show=null;
  }
  const isSubject=e=>e.kind==='turret' || e.def.fly && e.def.machine;
  function stayed(s,o) {return s.installations.some(z=>z.kind==='writ' && dist(z,o)<=z.r);}
  // First intersection from outside, including a fast round traversing the whole ward in one step.
  function intercept(s,x,y,nx,ny) {
    const dx=nx-x,dy=ny-y,len2=dx*dx+dy*dy;if(!len2)return null;
    let best=Infinity;
    for(const z of s.installations){
      if(z.kind!=='ward')continue;
      const ox=x-z.x,oy=y-z.y,c=ox*ox+oy*oy-z.r*z.r,along=ox*dx+oy*dy;
      if(c<=0 || along>=0)continue;
      const disc=along*along-len2*c;if(disc<0)continue;
      const k=(-along-Math.sqrt(disc))/len2;if(k>=0 && k<=1 && k<best)best=k;
    }
    return best===Infinity?null:{x:x+best*dx,y:y+best*dy};
  }
  function pulse(s,z) {
    s.ev.push({k:'hypnosis',x:z.x,y:z.y,ang:z.ang,r:z.r,arc:z.arc});
    for(const e of s.en) if(live(e) && e.def.human && !e.boss && nearby(s,z,e,z.r) &&
      Math.abs(A.angDiff(Math.atan2(e.y-z.y,e.x-z.x),z.ang))<=z.arc){
      e.trance=Math.max(e.trance,z.dur*(e.elite ? .5 : 1)); e.tranceCast=z; e.atk=null;e.kx=e.ky=0;
    }
  }
  function order(s,g,ax,ay) {
    const z=s.suggestion;
    if(!z || z.owner!==s.active || g.id!==z.id || !z.ready) return false;
    const e=s.en.filter(e=>live(e) && e.trance>0 && e.tranceCast===z)
      .sort((a,b)=>dist(a,{x:ax,y:ay})-dist(b,{x:ax,y:ay}))[0];
    if(!e)return false;
    z.ready=false;e.march={x:ax,y:ay};s.ev.push({k:'order',x:e.x,y:e.y,x2:ax,y2:ay});return true;
  }
  function input(s,i,dt) {
    const p=s.p, moving=i.mx || i.my || i.dash || i.fire;
    s.standing=!moving && p.dashT<=0 && p.lock<=0;
    if(s.show) {
      if(moving || s.show.owner!==s.active) curtain(s);
      else {p.kx=p.ky=0;return {...i,melee:false,g1:false,g2:false};}
    }
    const d=s.shockDrone;
    if(!d){
      const launch=p.gad.some((g,k)=>g.id==='shockdrone' && g.cd<=0 && (k?i.g2&&i.g2Hold:i.g1&&i.g1Hold));
      if(launch){p.kx=p.ky=0;return {...i,mx:0,my:0,fire:false,melee:false,dash:false};}
      return i;
    }
    const held=d.owner===s.active && (d.slot===0?i.g1Hold:i.g2Hold);
    d.hold=held?d.hold+dt:0;
    if(d.manual && !held){d.tx=d.x;d.ty=d.y;d.phase=0;}
    d.manual=d.hold>=.18;
    if(!held)return i;
    const mx=i.mx||0,my=i.my||0,n=Math.max(1,Math.hypot(mx,my));
    if(mx||my)d.ang=Math.atan2(my,mx);
    if(d.manual)A.moveCircle(s,d,330*dt*mx/n,330*dt*my/n,true);
    p.kx=p.ky=0;return {...i,mx:0,my:0,fire:false,melee:false,dash:false,hack:false,g1:false,g2:false};
  }
  function block(s,g) {
    if(g.id==='performance')return !s.standing;
    if(g.id==='execute')return s.team[s.active].execCd>0 || !execution(s);
    return false;
  }
  function execution(s){
    return s.en.filter(e=>live(e)&&!e.boss&&nearby(s,s.p,e,S.data.gadgets.execute.r))
      .sort((a,b)=>dist(a,s.p)-dist(b,s.p))[0];
  }
  function retire(s,d){if(d.salvage)A.shock(s,d.x,d.y,110,8,1,'ally');s.shockDrone=null;}
  function cast(s,g,slot,reach) {
    const d=S.data.gadgets[g.id],p=s.p,f=s.fl,lv=g.lv-1,owner=s.active;
    switch(g.id){
      case 'execute':{const e=execution(s);s.team[owner].execCd=g.cd;p.lock=.22;p.inv=Math.max(p.inv,.35);
        s.stats.takedowns++;s.ev.push({k:'takedown',x:e.x,y:e.y});A.kill(s,e,{by:'melee'});break;}
      case 'quickstep': case 'rush':{
        p.dashT=g.id==='rush'?.23:.16;p.dvx=Math.cos(p.ang)*860;p.dvy=Math.sin(p.ang)*860;
        p.inv=Math.max(p.inv,p.dashT+.07);p.dashHit=new Set();p.rushing=g.id==='rush';
        if(!p.rushing){p.reload=0;p.ammo=p.mag;s.decoys.push({x:p.x,y:p.y,t:2.5,r:380,ghost:true});}
        s.ev.push({k:'dash',x:p.x,y:p.y,ang:p.ang});break;}
      case 'veil':
        p.cloak=d.dur+2*lv; for(const e of s.en){e.aware=0;if(e.call>0)e.call=S.sim.CALL;}break;
      case 'performance':
        p.kx=p.ky=0;s.show={owner,x:p.x,y:p.y,r:d.r+70*(f.wideStage||0),t:d.dur+lv,encore:f.encore};break;
      case 'shockdrone':{const at=reach(d.range);if(s.shockDrone)retire(s,s.shockDrone);
        s.shockDrone={owner,slot,x:p.x,y:p.y,r:11,tx:at.x,ty:at.y,ang:p.ang,phase:0,hold:0,manual:false,
          t:(d.dur+2*lv+4*(f.overcell||0))*s.st.hijackMul,beat:.15,flash:0,sight:d.r,extra:f.coilTap||0,
          dmg:(d.dmg+3*lv)*s.st.hijackMul,salvage:!!f.salvage};break;}
      case 'hypnosis': case 'metronome':{const z={id:g.id,owner,x:p.x,y:p.y,ang:p.ang,r:d.r+50*(f.velvet||0),arc:d.arc,
        dur:d.dur+lv+2*(f.suggestion||0),ready:!!(lv||f.suggestion),beats:g.id==='metronome'?2:0,time:.72};
        s.suggestion=z;pulse(s,z);break;}
      case 'molotov': case 'pipebomb':{
        const at=reach(d.range),flight=g.id==='molotov'?.42:.72;
        s.payloads.push({...at,fx:p.x,fy:p.y,t:flight,flight,id:g.id,r:d.r+45*(f.fragments||0),
          dmg:(d.dmg+12*lv)*s.st.aoeDmg,dur:d.dur+lv+2*(f.longWick||0),burn:d.burn*s.st.burnMul});break;}
      case 'hiveguard':
        s.zones.push({k:'swarm',owner,x:p.x,y:p.y,r:d.r,t:d.dur+lv,tick:0,
          dmg:(d.dmg+3*lv)*(1+.5*(f.hiveDose||0)),linger:1.5*(f.afterbuzz||0)});break;
      case 'medbeacon': case 'injunction': case 'escortWrit':{
        const ward=g.id==='medbeacon',follow=ward?!!f.mobileWard:g.id==='escortWrit';
        const at=follow?{x:p.x,y:p.y}:reach(d.range), r=d.r+(ward?35*(f.wideWard||0):0);
        if(!follow && A.solidAt(s,at.x,at.y)){const a=Math.atan2(at.y-p.y,at.x-p.x),end=A.rayEnd(s,p.x,p.y,a,dist(at,p),true),l=Math.max(0,end.d-20);at.x=p.x+Math.cos(a)*l;at.y=p.y+Math.sin(a)*l;}
        s.installations=s.installations.filter(z=>z.owner!==owner || z.kind!==(ward?'ward':'writ'));
        s.installations.push({...at,owner,kind:ward?'ward':'writ',follow,r,t:d.dur+lv+(ward?0:2*(f.extension||0)),heal:ward?d.heal+lv+3*(f.triage||0):0});break;}
      default:return false;
    }
    return true;
  }
  function step(s,dt) {
    const p=s.p;
    if(s.show){
      if(s.show.owner!==s.active || (s.show.t-=dt)<=0)curtain(s);
      else if(s.fl.hatTips)p.bw=Math.min(s.st.bwMax,p.bw+s.fl.hatTips*dt);
    }
    const spell=s.suggestion;
    if(spell && spell.beats>0 && (spell.time-=dt)<=0){spell.time+=.72;spell.beats--;pulse(s,spell);}
    for(const z of s.installations){
      if(z.follow && z.owner===s.active){const k=Math.min(1,305*dt/(dist(z,p)||1));z.x+=(p.x-z.x)*k;z.y+=(p.y-z.y)*k;}
      if(z.kind==='ward' && dist(z,p)<=z.r && !s.over)p.hp=Math.min(p.maxHp,p.hp+z.heal*dt);
      z.t-=dt;
    }
    s.installations=s.installations.filter(z=>z.t>0);
    for(const z of s.payloads)if((z.t-=dt)<=0){
      A.blast(s,z.x,z.y,z.r,z.dmg,{by:'env',self:10,knock:130});A.noise(s,z.x,z.y,500);
      s.zones.push({k:'fire',x:z.x,y:z.y,r:z.r*.8,t:z.dur,burn:z.burn,tick:0});
    }
    s.payloads=s.payloads.filter(z=>z.t>0);
    const d=s.shockDrone;if(!d)return;
    if((d.t-=dt)<=0){retire(s,d);return;}
    if(!d.manual){d.phase+=dt;const dx=d.tx+36*Math.cos(d.phase*1.7)-d.x,dy=d.ty+27*Math.sin(d.phase*1.7)-d.y,
      k=Math.min(1,390*dt/(Math.hypot(dx,dy)||1));if(dx||dy)d.ang=Math.atan2(dy,dx);A.moveCircle(s,d,dx*k,dy*k,true);}
    d.flash-=dt;if((d.beat-=dt)>0)return;
    const targets=s.en.filter(e=>live(e) && nearby(s,d,e,d.sight)).sort((a,b)=>dist(a,d)-dist(b,d)).slice(0,1+d.extra);
    if(!targets.length)return;
    d.beat=S.data.gadgets.shockdrone.gap;d.flash=.23;
    targets.forEach((e,i)=>{A.stun(s,e,.8);A.hurt(s,e,d.dmg,{by:'ally'});s.ev.push({k:'arc',x:d.x,y:d.y,x2:e.x,y2:e.y,cue:i?false:'droneArc'});});
  }
  function occupies(s,e,dt) {
    if(e.trance>0){e.trance-=dt;
      if(e.march){if(dist(e,e.march)>12)A.moveToward(s,e,e.march.x,e.march.y,145,dt);if(e.trance<=0)e.march=null;}
      return true;}
    if(!e.boss && isSubject(e) && stayed(s,e)){e.atk=null;e.call=0;e.aware=0;return true;}
    if(!audience(s,e))return false;
    e.atk=null;e.aware=0;e.call=0;e.seen=false;e.state=s.alert?'combat':'calm';e.goal=null;
    const z=s.show,a=e.id*2.39996, x=z.x+Math.cos(a)*68,y=z.y+Math.sin(a)*68;
    if(Math.hypot(e.x-x,e.y-y)>12 && e.stun<=0)A.moveToward(s,e,x,y,Math.min(130,e.def.speed),dt);
    e.ang=Math.atan2(z.y-e.y,z.x-e.x);return true;
  }
  S.field={input,block,cast,step,occupies,order,audience,stayed,isSubject,intercept,curtain};
})(window.ECHO.s3);
