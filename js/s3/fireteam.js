/* Live campaign deployment. The room owns the world; each on-field member owns one body.
   Only the command slot can open a cache, choose a door, or steer the camera. */
(function(S){
  'use strict';
  const A=S.sim.api, d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  // A real, loud trigger pull asks for one short burst. Wings, punches and the alarm
  // itself cannot renew it; use real time so focus never prolongs covering fire.
  function coverShot(s){if(s.active===s.control)s.coverUntil=s.rt+1.1;}
  function covering(s){return s.rt<s.coverUntil;}
  function bind(s,i){
    const m=s.team[i];s.active=i;s.p=m.body;s.st=m.st;s.fl=m.fl;s.build=m.build;s.weapon=m.weapon;
  }
  function as(s,i,fn){
    if(!s.fireteam || i===s.active)return fn();
    const back=s.active;bind(s,i);try{return fn();}finally{bind(s,back);}
  }
  function live(s,fn){
    if(!s.fireteam){fn(s.p,s.active);return;}
    s.team.forEach((m,i)=>{if(!m.down)as(s,i,()=>fn(m.body,i));});
  }
  function place(s,i,at){
    const m=s.team[i],p=m.body;
    const side=i%2?1:-1;
    for(const [dx,dy] of [[side*46,11],[-side*46,-8],[0,-48],[side*32,-32],[0,0]]){
      const x=at.x+dx,y=at.y+dy;
      if(!A.clear(s,at.x,at.y,x,y,true) || [[-14,-14],[14,-14],[-14,14],[14,14]].some(([a,b])=>A.solidAt(s,x+a,y+b)))continue;
      if((dx||dy) && s.team.some(n=>n!==m && n.body && !n.down && d(n.body,{x,y})<29))continue;
      p.x=x;p.y=y;break;
    }
  }
  function attach(s,i,body){
    const m=s.team[i];m.body=body;m.ai=S.bot.create(s.spec.seed+':wing:'+i);
    Object.defineProperty(m,'hp',{enumerable:true,configurable:true,get:()=>body.hp,set:v=>{body.hp=v;}});
  }
  function install(s,makeBody){
    s.control=s.active;s.order={kind:'follow'};s.coverUntil=0;
    for(const k of ['show','suggestion','shockDrone','standing','freeUsed']){
      Object.defineProperty(s,k,{configurable:true,get(){return s.team[s.active][k];},set(v){s.team[s.active][k]=v;}});
    }
    attach(s,s.control,s.p);
    s.team.forEach((m,i)=>{if(i!==s.control){attach(s,i,makeBody(s,m));place(s,i,s.p);}});
    // Derive a separate reserve, never more initial damage or duplicate bosses. Quiet clears still bypass the alarm reserves.
    const ordinary=s.spec.enemies.concat(...s.waves).filter(e=>!e.boss && e.kind!=='boss');
    if(ordinary.length){
      const rng=window.ECHO.rng.derive(s.spec.seed,'field-reserve'),count=Math.round(ordinary.length*S.data.fireteam.reserve);
      for(let n=0;n<count;){const wave=[];for(let j=0;j<3 && n<count;j++,n++)wave.push({kind:rng.pick(ordinary).kind});s.waves.push(wave);}
    }
  }
  function select(s,i,forced=false){if(!s.team[i] || s.team[i].down || s.over || i===s.control)return false;
    s.control=i;s.coverUntil=0;bind(s,i);s.ev.push({k:'swap',x:s.p.x,y:s.p.y,i,forced});return true;}
  function command(s,x,y){
    const close=s.en.filter(e=>!e.dead && e.ally<=0 && d(e,{x,y})<=e.r+30).sort((a,b)=>d(a,{x,y})-d(b,{x,y}))[0];
    if(close){if(s.order.target===close){s.order={kind:'follow'};s.coverUntil=0;}else s.order={kind:'focus',target:close};return;}
    if(d(s.p,{x,y})<60 || s.order.kind==='hold' && d(s.order,{x,y})<65){s.order={kind:'follow'};s.coverUntil=0;return;}
    if(!A.solidAt(s,x,y) && A.field(s,x,y)[A.idx(Math.floor(s.p.x/S.sim.T),Math.floor(s.p.y/S.sim.T))]>=0)s.order={kind:'hold',x,y,ang:Math.atan2(y-s.p.y,x-s.p.x)};
  }
  function enemySlot(s,e){
    if(e.atk && s.team[e.targetSlot] && !s.team[e.targetSlot].down)return e.targetSlot;
    let best=s.control,score=Infinity;
    for(const [i,m] of s.team.entries())if(!m.down){
      const p=m.body,ang=Math.atan2(p.y-e.y,p.x-e.x),seen=A.clear(s,e.x,e.y,p.x,p.y) && !A.steamed(s,e.x,e.y,p.x,p.y);
      const blind=p.cloak>0 || !seen || e.state!=='combat' && Math.abs(A.angDiff(ang,e.ang))>e.def.fov;
      const rank=d(e,p)+(blind?900:0)+(i===e.id%s.team.length?0:55)-(i===e.targetSlot?22:0);
      if(rank<score){score=rank;best=i;}
    }return e.targetSlot=best;
  }
  function reserved(s,e){
    if(!s.fireteam || !e)return false;
    return e===s.reserved || (e.trance>0 || e.beeOpen>s.t) && d(e,s.team[s.control].body)<185;
  }
  // A loose wedge when following, two separated posts when holding. If a flank is in a wall,
  // approach the common reachable point; local separation still keeps the bodies distinguishable.
  function post(s,i){
    const leader=s.team[s.control].body,o=s.order,hold=o.kind==='hold',origin=hold?o:leader,
      side=s.team.filter((m,j)=>j!==s.control && !m.down).indexOf(s.team[i])===0?1:-1,
      ang=hold?o.ang:leader.ang,
      x=origin.x-side*50*Math.sin(ang)-(hold?0:53)*Math.cos(ang),
      y=origin.y+side*50*Math.cos(ang)-(hold?0:53)*Math.sin(ang);
    return !A.solidAt(s,x,y) && A.clear(s,origin.x,origin.y,x,y,true)?{x,y}:origin;
  }
  function space(s){
    for(let i=0;i<s.team.length;i++)for(let j=i+1;j<s.team.length;j++){
      const a=s.team[i],b=s.team[j];if(a.down||b.down)continue;
      const dx=a.body.x-b.body.x,dy=a.body.y-b.body.y,len=Math.hypot(dx,dy);
      if(len>=44)continue;
      const sx=(len?dx/len:1)*(44-len),sy=(len?dy/len:0)*(44-len);
      if(i!==s.control)A.moveCircle(s,a.body,sx*(j===s.control?1:.5),sy*(j===s.control?1:.5));
      if(j!==s.control)A.moveCircle(s,b.body,-sx*(i===s.control?1:.5),-sy*(i===s.control?1:.5));
    }
  }
  function down(s,i){
    const m=s.team[i];m.down=true;m.body.hp=0;m.rescue=S.data.fireteam.rescue;m.aid=0;m.show=null;
    s.ev.push({k:'down',x:m.body.x,y:m.body.y,i});
    if(s.team.every(n=>n.down)){s.team.forEach(n=>n.rescue=0);s.over='dead';s.ev.push({k:'dead',x:m.body.x,y:m.body.y});}
  }
  function recover(s,m){
    m.down=false;m.rescue=0;m.aid=0;m.body.hp=Math.ceil(m.maxHp*S.data.fireteam.reviveHp);m.body.inv=1;
    s.ev.push({k:'revive',x:m.body.x,y:m.body.y});
  }
  function endStep(s,dt){
    if(s.over)return;
    if(s.team[s.control].down){const i=s.team.findIndex(m=>!m.down);if(i>=0)select(s,i,true);}
    for(const m of s.team)if(m.down && m.rescue>0){
      if(s.cleared){recover(s,m);continue;}
      const helping=s.team.some(n=>!n.down && d(m.body,n.body)<62 && A.clear(s,n.body.x,n.body.y,m.body.x,m.body.y,true));
      m.aid=helping?m.aid+dt:0;
      if(m.aid>=S.data.fireteam.aid)recover(s,m);
      else if((m.rescue=Math.max(0,m.rescue-dt))===0)s.ev.push({k:'fieldHeld',i:s.team.indexOf(m)});
    }
    if(s.order.target && (s.order.target.dead || s.order.target.ally>0)){s.order={kind:'follow'};s.coverUntil=0;}
  }
  S.fireteam={as,live,attach,place,install,select,command,enemySlot,reserved,post,space,down,endStep,coverShot,covering};
})(window.ECHO.s3);
