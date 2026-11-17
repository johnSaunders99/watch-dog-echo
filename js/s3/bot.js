// 第三季的機器人玩家：自動測試和平衡用，也可以在網址加 ?bot=1 看它自己打。
// 它的打法是「正常但不完美的玩家」：會躲看得到的子彈和預告、會風箏近戰、會用划算的駭入和裝備、看到被電暈的會去制伏，
// 但不會刻意潛行，瞄準有一點誤差，也不是每一顆子彈都閃得掉。
// act(s) 回傳這一步的輸入，格式跟 js/s3/sim.js 的 step 一樣。
(function (E) {
  const S3 = E.s3, sim = S3.sim, A = sim.api;
  const { T, W, H, GW, GH } = sim, hyp = Math.hypot;
  const DX = [1, 0, -1, 0, 1, 1, -1, -1], DY = [0, 1, 0, -1, 1, -1, 1, -1];

  function create(seed) {
    const rng = E.rng.derive(seed, 'bot');
    const b = { strafe: 1, strafeT: 0, aimErr: 0, aimT: 0, door: 0, last: {} };

    // 往某一點走的方向（會繞牆）。
    function toward(s, x, y) {
      const p = s.p;
      if (A.clear(s, p.x, p.y, x, y, true)) { const d = hyp(x - p.x, y - p.y) || 1; return [(x - p.x) / d, (y - p.y) / d]; }
      const f = A.field(s, x, y);
      const tx = A.clamp(Math.floor(p.x / T), 0, GW - 1), ty = A.clamp(Math.floor(p.y / T), 0, GH - 1);
      let best = f[A.idx(tx, ty)], bx = -1, by = -1;
      if (best < 0) best = 9999;
      for (let k = 0; k < 8; k++) {
        const nx = tx + DX[k], ny = ty + DY[k];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const v = f[A.idx(nx, ny)];
        if (v < 0 || v >= best) continue;
        if (k >= 4 && (s.solid[A.idx(nx, ty)] || s.solid[A.idx(tx, ny)])) continue;
        best = v; bx = nx; by = ny;
      }
      const wx = bx >= 0 ? (bx + 0.5) * T : x, wy = bx >= 0 ? (by + 0.5) * T : y;
      const d = hyp(wx - p.x, wy - p.y) || 1;
      return [(wx - p.x) / d, (wy - p.y) / d];
    }

    // Cross into the wake of a rotating beam, rather than racing its leading edge.
    // The core's opposite arm exists during the warning too, before its first rendered endpoint.
    function laserEscape(s,e,a) {
      const p=s.p,rx=p.x-e.x,ry=p.y-e.y,r=hyp(rx,ry)||1,angle=Math.atan2(ry,rx);
      const gapAt=ang=>a.dir*A.angDiff(angle,ang);
      let gap=gapAt(a.ang);
      if(e.boss==='keystone'){const opposite=gapAt(a.ang+Math.PI);if(Math.abs(opposite)<Math.abs(gap))gap=opposite;}
      const margin=(p.r+18)/r,until=a.go?a.t:a.dur;
      if(gap < -margin || gap > margin+a.rate*Math.min(until,.5) || !A.clear(s,e.x,e.y,p.x,p.y))return null;
      const lead=Math.max(0,gap*r),canDash=p.dashN>0 && p.lock<=0;
      // With no charge, don't walk straight into an active beam: keep the head start or reach cover.
      const retreat=a.go && gap>0 && !canDash && p.dashT<=0;
      const tx=(retreat?-1:1)*a.dir*ry/r,ty=(retreat?1:-1)*a.dir*rx/r;
      const imminent=a.go && gap>=-(p.r+6)/r && lead < p.r+10+.13*(a.rate*r+s.st.speed);
      const stride=imminent && canDash?950*.16*s.st.dashLen:Math.max(55,s.st.speed*.28);
      // Try the tangent first. At a wall try both diagonals and then the open ends of the lane.
      let best=null,value=-Infinity;
      for(const turn of [0,.65,-.65,1.18,-1.18,Math.PI/2,-Math.PI/2,Math.PI]){
        const c=Math.cos(turn),sn=Math.sin(turn),x=tx*c-ty*sn,y=ty*c+tx*sn;
        const q={x:p.x,y:p.y,r:p.r},steps=Math.ceil(stride/16),step=stride/steps;
        for(let i=0;i<steps;i++)A.moveCircle(s,q,x*step,y*step);
        const dx=q.x-p.x,dy=q.y-p.y,along=dx*tx+dy*ty,moved=hyp(dx,dy);
        const cover=!A.clear(s,e.x,e.y,q.x,q.y),score=along+.28*moved+(cover?stride:0);
        if(score>value){value=score;best={x,y,urgent:imminent && canDash && moved>p.r && (along>p.r || cover),any:true,laser:true};}
        if(!turn && along>=stride-.5)break;
      }
      return best;
    }

    // 危險：快打到的子彈、腳下的預告圈、瞄準線、衝撞。回傳 { x, y 該往哪躲, urgent 要不要衝刺 }。
    function danger(s) {
      const p = s.p;
      let dx = 0, dy = 0, urgent = false;
      for (const bl of s.bul) {
        if (bl.side !== 'e') continue;
        // 四顆子彈裡有一顆沒注意到。
        if (bl.botSkip === undefined) bl.botSkip = rng.chance(0.25);
        if (bl.botSkip) continue;
        const rx = p.x - bl.x, ry = p.y - bl.y, v2 = bl.vx * bl.vx + bl.vy * bl.vy;
        const t = (rx * bl.vx + ry * bl.vy) / v2;
        if (t < 0 || t > 0.5) continue;
        const cx = rx - bl.vx * t, cy = ry - bl.vy * t, miss = hyp(cx, cy);
        if (miss > p.r + bl.r + 16) continue;
        const side = (rx * bl.vy - ry * bl.vx) >= 0 ? 1 : -1, l = Math.sqrt(v2), w = 1 / (t + 0.08);
        dx += (bl.vy / l) * side * w;
        dy += (-bl.vx / l) * side * w;
        if (t < 0.12 && miss < p.r + bl.r + 4) urgent = true;
      }
      for (const z of s.zones) {
        if (z.side === 'e' && z.k === 'tele') {
          const d = hyp(p.x - z.x, p.y - z.y);
          if (d > z.r + 30) continue;
          const w = 3 / (z.t + 0.1);
          dx += ((p.x - z.x) / (d || 1)) * w; dy += ((p.y - z.y) / (d || 1)) * w;
          if (z.t < 0.3 && d < z.r + 6) urgent = true;
        } else if (z.k === 'fire' && !s.fl.fireproof && z.thrower!==s.team[s.active]) {
          const d = hyp(p.x - z.x, p.y - z.y);
          if (d < z.r + 24) { dx += ((p.x - z.x) / (d || 1)) * 4; dy += ((p.y - z.y) / (d || 1)) * 4; }
        }
      }
      for (const e of s.en) {
        const a = e.atk;
        if (e.dead || e.ally > 0 || e.confused > 0 || !a) continue;
        const line = (ang, len, width, soon) => {
          const ex = e.x + Math.cos(ang) * len, ey = e.y + Math.sin(ang) * len;
          const d = A.segDist(p.x, p.y, e.x, e.y, ex, ey);
          if (d > width) return;
          const side = ((p.x - e.x) * Math.sin(ang) - (p.y - e.y) * Math.cos(ang)) >= 0 ? 1 : -1;
          dx += Math.sin(ang) * side * 5; dy += -Math.cos(ang) * side * 5;
          if (soon && d < width * 0.6) urgent = true;
        };
        if (a.k === 'snipe' && a.t < 0.3) line(a.ang, 1500, 34, a.t < 0.12);
        else if (a.k === 'charge') line(a.ang, 900, 70, a.go || a.t < 0.2);
        else if (a.k === 'laser') { const path=laserEscape(s,e,a);if(path)return path; }
        else if ((a.k === 'swing' || a.k === 'slam') && hyp(p.x - e.x, p.y - e.y) < 135) {
          const d = hyp(p.x - e.x, p.y - e.y) || 1;
          dx += ((p.x - e.x) / d) * 6; dy += ((p.y - e.y) / d) * 6;
          if (a.t < 0.14) urgent = true;
        } else if (a.k === 'leap' && !a.go) line(e.ang, 260, 40, a.t < 0.1);
      }
      return { x: dx, y: dy, urgent, any: dx !== 0 || dy !== 0 };
    }

    // 這一步要不要駭、駭誰。回傳要點的位置，或 null。
    function hackPlan(s, foes) {
      const p = s.p, range = s.st.hackRange;
      if (p.hackCd > 0 || p.bw < 1) return null;
      const near = (x, y, r) => foes.filter((e) => hyp(e.x - x, e.y - y) < r + e.r).length;
      const can = (x, y) => { const h = sim.pickHack(s, x, y); return h && h.ok ? h : null; };
      let best = null, score = 0;
      const offer = (x, y, sc) => { if (sc > score && hyp(x - p.x, y - p.y) <= range) { const h = can(x, y); if (h && (!s.show || h.prop && ['overload','ignite','steam','drive','breach','raise'].includes(h.act))) { score = sc; best = { x, y, h }; } } };
      for (const pr of s.props) {
        if (pr.gone) continue;
        if (pr.kind === 'junction' && !pr.used && pr.fuse <= 0) { const n = near(pr.x, pr.y, 140); if (n) offer(pr.x, pr.y, n * 3 + (hyp(p.x - pr.x, p.y - pr.y) > 160 ? 1 : 0)); }
        else if (pr.kind === 'barrel' && pr.fuse <= 0 && hyp(p.x - pr.x, p.y - pr.y) > 175) { const n = near(pr.x, pr.y, 125); if (n) offer(pr.x, pr.y, n * 3.5); }
        else if (pr.kind === 'vent' && pr.cool <= 0) { const n = near(pr.x, pr.y, 120); if (n >= (s.show?1:2)) offer(pr.x, pr.y, n * 1.5); }
        else if (pr.kind === 'pylon' && pr.down <= 0) offer(pr.x, pr.y, 9);
        else if (pr.kind === 'car' && !pr.used && !pr.moving) {
          const path = sim.carPath(s, pr), dx = DX[path.dir], dy = DY[path.dir];
          const n = foes.filter((e) => { const along = (e.x - pr.x) * dx + (e.y - pr.y) * dy, off = Math.abs((e.x - pr.x) * dy - (e.y - pr.y) * dx); return along > 0 && along < path.reach + 130 && off < 50; }).length;
          const me = (p.x - pr.x) * dx + (p.y - pr.y) * dy, off = Math.abs((p.x - pr.x) * dy - (p.y - pr.y) * dx);
          if (n && !(me > 0 && off < 60)) offer(pr.x, pr.y, n * 4);
        } else if (pr.kind === 'camera' && pr.cool <= 0 && foes.length >= 3 && p.bw >= 3) offer(pr.x, pr.y, 1.5);
      }
      if(s.show)return best;
      for (const e of foes) {
        if(e.trance>0)continue;
        const d = hyp(e.x - p.x, e.y - p.y);
        if (e.boss === 'bulldog') { if (e.noShield <= 0 && e.stun <= 0) offer(e.x, e.y, 5); continue; }
        if (e.kind === 'drone' && p.bw >= 2) offer(e.x, e.y, 4);
        else if (e.kind === 'turret' && p.bw >= 3) offer(e.x, e.y, 4.5);
        else if (e.kind === 'heavy' && e.grenade) offer(e.x, e.y, 6);
        else if (e.kind === 'shield' && e.noShield <= 0 && e.stun <= 0 && d < 380) offer(e.x, e.y, 3);
        else if (e.kind === 'sniper' && e.atk && e.blind <= 0) offer(e.x, e.y, 4);
        else if ((e.kind === 'rusher' || e.kind === 'hound') && d < 170 && e.stun <= 0 && e.resist <= 0) offer(e.x, e.y, 3.2);
        else if (e.def.human && e.stun <= 0 && e.resist <= 0 && d < 140 && p.bw >= 3) offer(e.x, e.y, 2);
      }
      return best;
    }

    function gadgetPlan(s, foes, inp, specialtyOnly=false, personalOnly=false) {
      const p = s.p;
      p.gad.forEach((g, i) => {
        if (personalOnly && i || g.cd > 0 || !foes.length || inp.g1 && ['performance','hypnosis','metronome','molotov','pipebomb','swarm','shockdrone','injunction'].includes(p.gad[0].id) || specialtyOnly && (i || !['performance','hypnosis','metronome','molotov','pipebomb'].includes(g.id))) return;
        const key = i === 0 ? 'g1' : 'g2';
        const nearMe = foes.filter((e) => hyp(e.x - p.x, e.y - p.y) < 110 + e.r).length;
        const far = foes.slice().sort((a, b) => hyp(a.x - p.x, a.y - p.y) - hyp(b.x - p.x, b.y - p.y))[0];
        const cluster = (r, reach) => { let best = null, n = 0; for (const e of foes) { if (hyp(e.x - p.x, e.y - p.y) > reach) continue; const c = foes.filter((o) => hyp(o.x - e.x, o.y - e.y) < r).length; if (c > n) { n = c; best = e; } } return { e: best, n }; };
        if(g.id==='performance'){
          const r=S3.data.gadgets.performance.r+70*(s.fl.wideStage||0);
          if(foes.some(e=>(e.def.human && !e.elite || e.boss) && hyp(e.x-p.x,e.y-p.y)<r+e.r && A.clear(s,p.x,p.y,e.x,e.y,true))){
            inp[key]=true;inp.mx=inp.my=0;inp.dash=inp.fire=inp.melee=false;}
        }else if(g.id==='hypnosis'||g.id==='metronome'){
          const def=S3.data.gadgets[g.id],r=def.r+50*(s.fl.velvet||0);
          const humans=foes.filter(e=>e.def.human && !e.boss && !(e.trance>.5) && hyp(e.x-p.x,e.y-p.y)<r+e.r && A.clear(s,p.x,p.y,e.x,e.y,true));
          const angle=e=>Math.atan2(e.y-p.y,e.x-p.x);
          let best=null,score=0;
          for(const e of humans){const n=humans.filter(o=>Math.abs(A.angDiff(angle(e),angle(o)))<=def.arc).length,
            value=n+.4*(e.elite?1:0)-hyp(e.x-p.x,e.y-p.y)/(3*r);
            if(value>score){best=e;score=value;}}
          // Pulse originates after movement in this tick. Plant the cast at the sight line just checked.
          if(best && !inp.dash && p.dashT<=0){inp[key]=true;inp.mx=inp.my=0;inp.ax=best.x;inp.ay=best.y;inp.fire=inp.melee=false;}
        }else if(g.id==='molotov'||g.id==='pipebomb'||g.id==='swarm'){
          const def=S3.data.gadgets[g.id],r=def.r+(g.id==='swarm'?0:45*(s.fl.fragments||0));
          // Aim between two foes when one blast can catch both; don't waste the throw beyond reach.
          const within=foes.filter(e=>hyp(e.x-p.x,e.y-p.y)<=def.range+r);
          const future=within.map(e=>{
            const dx=p.x-e.x,dy=p.y-e.y,d=hyp(dx,dy)||1;
            const ambush=g.id==='swarm' && (e.state==='combat' || e.kind==='rusher' || e.kind==='hound') && !e.atk && !e.stun && !e.trance;
            const advance=ambush?Math.min(d*.4,e.def.speed*.65):0;return {x:e.x+dx*advance/d,y:e.y+dy*advance/d,r:e.r,boss:e.boss};});
          const points=future.slice();
          for(let j=0;j<within.length;j++)for(let k=0;k<j;k++){
            const a=future[j],b=future[k];if(hyp(a.x-b.x,a.y-b.y)<1.7*r)points.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2});}
          let best=null,score=0;
          for(const q of points){const d=hyp(q.x-p.x,q.y-p.y),f=Math.min(1,def.range/(d||1)),x=p.x+(q.x-p.x)*f,y=p.y+(q.y-p.y)*f;
            const value=future.reduce((n,e)=>{const m=hyp(e.x-x,e.y-y)/(r+e.r);return n+(m<1?(1-m*.6)*(e.boss?2:1):0);},0);
            if(value>score){score=value;best={x,y};}}
          if(best){inp[key]=true;if(g.id!=='swarm' || hyp(best.x-inp.ax,best.y-inp.ay)>32)inp.fire=false;inp.ax=best.x;inp.ay=best.y;}
        }else if(g.id==='shockdrone'||g.id==='injunction'){
          const def=S3.data.gadgets[g.id],e=g.id==='injunction'?foes.find(e=>S3.field.isSubject(e) && !e.boss && hyp(e.x-p.x,e.y-p.y)<def.range+def.r):cluster(def.r,def.range).e;
          const relay=g.id==='injunction' && s.spec.boss && s.props.find(pr=>pr.kind==='pylon' && pr.down<2 && hyp(pr.x-p.x,pr.y-p.y)<def.range+def.r && !S3.field.stayed(s,pr));
          let at=relay || e;
          if(g.id==='injunction'){
            const boss=foes.find(t=>t.boss && hyp(t.x-p.x,t.y-p.y)<def.range+def.r);
            if(boss && relay && hyp(boss.x-relay.x,boss.y-relay.y)<=2*def.r-16)
              at={x:(boss.x+relay.x)/2,y:(boss.y+relay.y)/2};
            else{
              at=boss || at || (s.alert || s.spec.boss ? p : null);
              if(at && at!==p){const x=at.x-p.x,y=at.y-p.y,f=Math.min(1,(def.r-24)/(hyp(x,y)||1));at={x:at.x-x*f,y:at.y-y*f};}
            }
          }
          if(at && !(g.id==='shockdrone' && s.shockDrone)){inp[key]=true;inp.ax=at.x;inp.ay=at.y;inp.fire=false;}
        }else if(g.id==='medbeacon'){if(p.hp<p.maxHp*.85||foes.length>=2){inp[key]=true;inp.ax=p.x;inp.ay=p.y;}}
        else if(g.id==='escortWrit'||g.id==='hiveguard'){inp[key]=foes.some(e=>hyp(e.x-p.x,e.y-p.y)<(g.id==='escortWrit'?470:220));}
        else if(g.id==='execute' && !g.armed && !inp.melee && s.alert){
          const at=A.launcherImpact(s,far.x,far.y);
          if(!at.unsafe && hyp(far.x-at.x,far.y-at.y)<at.r+far.r){inp[key]=true;inp.ax=far.x;inp.ay=far.y;}
        }
        else if(g.id==='rush'||g.id==='quickstep'){if(nearMe||g.id==='quickstep' && p.ammo<p.mag*.4){inp[key]=true;inp.melee=false;}}
        else if(g.id==='veil'){if(!p.cloak || p.cloak<=0)inp[key]=true;}
        else if (g.id === 'hammer' || g.id === 'sledge') { if (nearMe) { inp[key] = true; inp.ax = far.x; inp.ay = far.y; } }
        else if (g.id === 'eagle' && s.recon) {
          const z = s.recon;
          if (z.orbit && z.dur - z.t >= 1.6 && foes.filter((e) => hyp(e.x - z.x, e.y - z.y) < z.r + e.r).length >= 2) inp[key] = true;
        } else if (g.id === 'eagle' || g.id === 'kamikaze') {
          const c = cluster(160, S3.data.gadgets[g.id].range);
          if (c.e && (c.n >= 2 || c.e.boss || (g.id === 'eagle' && !s.alert))) { inp[key] = true; inp.ax = c.e.x; inp.ay = c.e.y; }
        } else if (g.id === 'sergei' || g.id === 'cargo') {
          const def = S3.data.gadgets[g.id], c = cluster(def.jamRange || def.r, def.range);
          if (c.e && hyp(c.e.x - p.x, c.e.y - p.y) > 120) { inp[key] = true; inp.ax = c.e.x; inp.ay = c.e.y; }
        } else if (g.id === 'escort' || g.id === 'expert' || g.id === 'brawl') { if (s.alert || foes.some((e) => e.state === 'combat')) inp[key] = true; }
        else if (g.id === 'strike') {
          const def = S3.data.gadgets[g.id], c = cluster(def.r*s.st.aoeMul, def.range);
          if (c.e) { inp[key] = true; inp.ax = c.e.x; inp.ay = c.e.y; }
        } else if (g.id === 'eightball') {
          if (hyp(far.x - p.x, far.y - p.y) < S3.data.gadgets[g.id].r) { inp[key] = true; inp.ax = far.x; inp.ay = far.y; }
        }
        else if (g.id === 'spider') { if (s.alert) inp[key] = true; }
        else if (g.id === 'mine') { if (foes.some((e) => (e.kind === 'rusher' || e.kind === 'hound' || e.boss === 'bulldog') && hyp(e.x - p.x, e.y - p.y) < 260)) inp[key] = true; }
        else if (g.id === 'mask') { if (p.hp < p.maxHp * 0.5 && foes.length >= 2) inp[key] = true; }
        else if (g.id === 'blackout') { if (p.hp < p.maxHp * 0.6 && foes.length >= 3) inp[key] = true; }
        else if (g.id === 'lure') { if (foes.length >= 3) { inp[key] = true; inp.ax = W - p.x; inp.ay = H - p.y; } }
      });
    }

    function readAim(){
      b.aimT-=sim.DT;
      if(b.aimT<=0){b.aimT=.25;b.aimErr=(rng.next()-.5)*.14;}
    }
    function act(s) {
      const p = s.p;
      const inp = { mx: 0, my: 0, ax: p.x, ay: p.y - 100, fire: false, focus: false, dash: false, hack: false, melee: false, g1: false, g2: false, reload: false, swap: -1 };
      // 場上的人快倒了，就換體力最多的隊友上來。
      if (!s.cleared && s.swapCd <= 0 && p.hp < p.maxHp * 0.3) {
        let best = -1, frac = 0.45;
        s.team.forEach((m, i) => { if (i !== s.active && !m.down && m.hp / m.maxHp > frac) { frac = m.hp / m.maxHp; best = i; } });
        inp.swap = best;
      } else if(s.active!==0 && s.swapCd<=0 && (s.cleared || s.tick<2)){
        // The reserve bought the specialist time to recover. Hand back the room to a fit lead.
        const lead=s.team[0];if(lead.build.person?.elite && !lead.down && lead.hp>=lead.maxHp*.6)inp.swap=0;
      }
      // 打完了：撿獎勵箱，然後走去門口。
      if (s.cleared) {
        const goal = !s.cache.taken ? s.cache : s.spec.doors[Math.min(b.door, s.spec.doors.length - 1)];
        const [mx, my] = toward(s, goal.x, s.cache.taken ? goal.y + 10 : goal.y);
        inp.mx = mx; inp.my = my;
        inp.reload = p.ammo < p.mag;
        return inp;
      }
      const foes = s.en.filter((e) => !e.dead && e.ally <= 0 && e.spawnT <= 0);
      b.strafeT -= sim.DT;
      if (b.strafeT <= 0) { b.strafeT = 0.8 + rng.next() * 1.2; b.strafe = -b.strafe; }
      readAim();

      // 目標：有射擊線的最近敵人；沒有就最近的。被盾擋住正面的排後面。
      let tgt = null, bd = 1e9, los = false;
      for (const e of foes) {
        const d = hyp(e.x - p.x, e.y - p.y);
        const line = A.clear(s, p.x, p.y, e.x, e.y, true);
        // 已經在打的目標加一點分，免得在兩個差不多的目標之間來回跑。
        const sc = d + (line ? 0 : 600) + (A.shielded(e, p.x, p.y) ? 250 : 0) - (e.stun > 0 ? 120 : 0) - (e.kind === 'jammer' ? 100 : 0) - (e.id === b.tgtId ? 320 : 0);
        if (sc < bd) { bd = sc; tgt = e; los = line; }
      }
      const dg = danger(s);
      b.tgtId = tgt ? tgt.id : 0;
      if (tgt) {
        const d = hyp(tgt.x - p.x, tgt.y - p.y), ang = Math.atan2(tgt.y - p.y, tgt.x - p.x) + b.aimErr * Math.min(1, d / 300);
        inp.ax = p.x + Math.cos(ang) * d; inp.ay = p.y + Math.sin(ang) * d;
        const w = s.weapon, reach = Math.min(w.range * 0.9, 520);
        inp.fire = los && d < reach && (!A.shielded(tgt, p.x, p.y) || tgt.state !== 'combat');
        // 走位：太遠就靠近、太近就退、其他時候橫移。近戰型的敵人保持更遠。
        const melee = tgt.kind === 'rusher' || tgt.kind === 'hound' || tgt.boss === 'bulldog';
        const want = melee ? 250 : w.range < 500 ? 190 : 260;
        let mx = 0, my = 0;
        if (!los || d > Math.min(reach, want + 90)) [mx, my] = toward(s, tgt.x, tgt.y);
        else {
          const nx = (tgt.x - p.x) / (d || 1), ny = (tgt.y - p.y) / (d || 1), rad = d < want - 60 ? -1 : 0;
          mx = nx * rad - ny * b.strafe * 0.8; my = ny * rad + nx * b.strafe * 0.8;
        }
        // 首領戰：中繼器好了就靠過去駭。
        const py = s.spec.boss && p.bw >= 2 ? s.props.filter((q) => q.kind === 'pylon' && q.down <= 0).sort((x, y) => hyp(x.x - p.x, x.y - p.y) - hyp(y.x - p.x, y.y - p.y))[0] : null;
        if (py && hyp(py.x - p.x, py.y - p.y) > s.st.hackRange * 0.9) [mx, my] = toward(s, py.x, py.y);
        // 被電暈的就衝過去制伏。
        const down = foes.filter((e) => (e.stun > 0.35 || e.trance>.5 || (e.distract > 0.5 && e.state !== 'combat')) && !e.boss && hyp(e.x - p.x, e.y - p.y) < (e.trance>0 ? Math.min(430,e.trance*s.st.speed+sim.LUNGE) : 190)).sort((x, y) => hyp(x.x - p.x, x.y - p.y) - hyp(y.x - p.x, y.y - p.y))[0];
        if (down && !dg.urgent) [mx, my] = toward(s, down.x, down.y);
        if (sim.takedownTarget(s)) inp.melee = true;
        else if (melee && d < 58 + tgt.r && p.meleeCd <= 0 && !tgt.atk) inp.melee = true;
        // 躲
        if (dg.any) { const l = hyp(dg.x, dg.y) || 1; mx = mx * 0.35 + (dg.x / l) * 1.2; my = my * 0.35 + (dg.y / l) * 1.2; }
        // 離牆太近會卡住，稍微往場地中間偏。
        mx += ((W / 2 - p.x) / W) * 0.25; my += ((H / 2 - p.y) / H) * 0.25;
        inp.mx = mx; inp.my = my;
        if (dg.urgent && p.dashN > 0 && rng.chance(0.8)) inp.dash = true;
        inp.focus = p.hp < p.maxHp * 0.35 && dg.any;
        if(dg.laser){inp.mx=dg.x;inp.my=dg.y;inp.dash=dg.urgent;inp.melee=false;return inp;}
        // The test pilot has the same G key as a player. A boss, or a shield its hack
        // cannot lower, warrants a marked target even when the pilot carries a quiet gun.
        if(s.fireteam && s.alert && !s.order.target && inp.swap<0 && los && !S3.fireteam.reserved(s,tgt) &&
          (tgt.boss || tgt.kind==='shield' && tgt.elite==='firewall' && A.shielded(tgt,p.x,p.y))){
          inp.command=true;inp.ax=tgt.x;inp.ay=tgt.y;inp.fire=inp.melee=false;return inp;
        }

        const hypnotist=s.build.person?.elite==='hypnotist';
        if(hypnotist && (tgt.boss || tgt.def.machine || tgt.state==='combat' && !tgt.trance) && los && inp.fire && (p.focus>35 || p.focusing))inp.focus=true;
        if(!s.show && !inp.dash && !(inp.melee && down?.trance>0))gadgetPlan(s,foes,inp,true);
        if(!(inp.g1||inp.g2)){
          const hp=hackPlan(s,foes);
          if(hp){inp.hack=true;inp.ax=hp.x;inp.ay=hp.y;inp.fire=false;}
          else if(!s.show)gadgetPlan(s,foes,inp);
        }
        if(down?.trance>0 && !dg.urgent){inp.fire=false;if(!inp.g1 && !inp.g2 && !inp.hack){inp.ax=down.x;inp.ay=down.y;}}
        if(s.show && !dg.urgent && (inp.hack || s.show.t>S3.data.gadgets.performance.dur-1.15)){
          inp.mx=inp.my=0;inp.fire=inp.dash=inp.melee=false;inp.reload=p.ammo<p.mag;
        }
      } else {
        // 場上暫時沒人（增援還沒到）：回場地中間等。
        const [mx, my] = toward(s, W / 2, H * 0.6);
        if (hyp(W / 2 - p.x, H * 0.6 - p.y) > 60) { inp.mx = mx; inp.my = my; }
        if (dg.any) { inp.mx = dg.x; inp.my = dg.y; if (dg.urgent && p.dashN > 0) inp.dash = true; }
        inp.reload = p.ammo < p.mag;
      }
      return inp;
    }
    // The wing uses the test pilot's navigation, threat reading and gear planner, not its route/menu authority.
    function wing(s){
      const p=s.p,lead=s.team[s.control].body,g=s.order,dist=(a,b)=>hyp(a.x-b.x,a.y-b.y);
      const inp={mx:0,my:0,ax:lead.x,ay:lead.y,reload:p.ammo<p.mag*.5};
      const hostile=s.en.filter(e=>!e.dead && e.ally<=0 && e.spawnT<=0),reserved=e=>S3.fireteam.reserved(s,e);
      const safe=hostile.filter(e=>!reserved(e)),rescue=s.team.filter(m=>m.down && m.rescue>0).sort((a,b)=>dist(a.body,p)-dist(b.body,p))[0];
      const goal=rescue?rescue.body:S3.fireteam.post(s,s.active),leash=rescue?41:24;
      if(dist(p,goal)>leash)[inp.mx,inp.my]=toward(s,goal.x,goal.y);
      else if(!rescue && g.kind!=='hold'){
        // Leave the leader's approach and line of fire clear.
        const near=s.team.find(m=>!m.down && m.body!==p && dist(m.body,p)<38);
        if(near){inp.mx=(p.x-near.body.x)/28;inp.my=(p.y-near.body.y)/28;}
      }
      const speed=hyp(inp.mx,inp.my);
      if(speed && !rescue){
        const nx=inp.mx/speed,ny=inp.my/speed;
        for(const m of s.team)if(!m.down && m.body!==p){
          const dx=m.body.x-p.x,dy=m.body.y-p.y,ahead=nx*dx+ny*dy,across=nx*dy-ny*dx;
          if(ahead>0 && ahead<76 && Math.abs(across)<44){
            const side=Math.abs(across)>3?-Math.sign(across):s.active%2?1:-1,steer=1.6*(1-ahead/90);
            inp.mx-=ny*side*steer;inp.my+=nx*side*steer;
          }
        }
      }
      const dangerNow=danger(s);
      if(dangerNow.laser && !s.cleared){inp.mx=dangerNow.x;inp.my=dangerNow.y;inp.dash=dangerNow.urgent;return inp;}
      if(dangerNow.any && !s.cleared){inp.mx+=dangerNow.x;inp.my+=dangerNow.y;inp.dash=dangerNow.urgent;}
      if(s.cleared || !s.alert && !S3.fireteam.covering(s))return inp;
      // A designation before discovery is silent. An alarm allows aid, not unlimited gunfire.
      // Don't switch to a calm bystander, a hypnotist's audience or a target behind a wall.
      const marked=g.kind==='focus' && safe.includes(g.target)?g.target:null;
      const visible=safe.filter(e=>!(e.confused>0 || e.trance>0) && !S3.field.audience(s,e) &&
        (e===marked || e.boss || e.state==='combat') && A.clear(s,p.x,p.y,e.x,e.y,true) && !A.steamed(s,p.x,p.y,e.x,e.y));
      const target=g.kind==='focus'?(visible.includes(marked)?marked:null):visible.reduce((a,e)=>!a||dist(e,p)<dist(a,p)?e:a,null);
      if(!target)return inp;
      const range=dist(target,p),engage=!!marked || s.alert && S3.fireteam.covering(s);
      readAim();
      const aim=Math.atan2(target.y-p.y,target.x-p.x)+b.aimErr*Math.min(1,range/300);
      inp.ax=p.x+Math.cos(aim)*range;inp.ay=p.y+Math.sin(aim)*range;
      // Covering fire in bursts. A deliberate focus order commits both wings to sustained fire.
      const covering=(s.t+s.active*.47)%1.6<.85;
      inp.fire=engage && !rescue && !dangerNow.urgent && (!!marked||covering) && range<s.weapon.range*.92 && !A.shielded(target,p.x,p.y);
      const td=sim.takedownTarget(s);
      inp.melee=!rescue && td===target && !reserved(td);
      if(inp.melee)inp.fire=false;
      if(!inp.melee && !rescue && (s.tick+s.active*4)%12===0){
        // Slot two is the player's shared gear. Never let it replace a wing's aim or movement.
        if(engage)gadgetPlan(s,g.kind==='focus'?[target]:visible,inp,false,true);
        const medic=p.gad[0];
        if(medic?.id==='medbeacon' && medic.cd<=0){
          const patient=s.team.filter(m=>!m.down && dist(m.body,p)<S3.data.gadgets.medbeacon.range && m.hp<m.maxHp*.8).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
          if(patient){inp.g1=true;inp.fire=false;inp.ax=patient.body.x;inp.ay=patient.body.y;}
        }
        for(let slot=0;slot<2;slot++){const key=slot?'g2':'g1',gear=p.gad[slot];if(!inp[key]||!gear)continue;
          const id=gear.id,def=S3.data.gadgets[id],area=!!def.r||['eagle','cargo','sergei','spider','brawl','expert','escort','shockdrone','mine','execute'].includes(id);
          const allyArea=area && !['medbeacon','injunction','escortWrit','hiveguard','veil','hypnosis','metronome','performance'].includes(id);
          const limit=def.range??Infinity,len=dist({x:inp.ax,y:inp.ay},p)||1,k=Math.min(1,limit/len);
          const at=id==='execute'?A.launcherImpact(s,inp.ax,inp.ay):{x:p.x+(inp.ax-p.x)*k,y:p.y+(inp.ay-p.y)*k};
          const r=60+((def.r||100)+(['molotov','pipebomb'].includes(id)?45*(s.fl.fragments||0):0))*
            (['execute','strike','molotov','pipebomb'].includes(id)?s.st.aoeMul:1);
          if(slot || allyArea && (s.team.some(m=>!m.down && dist(m.body,at)<r) || hostile.some(e=>reserved(e) && dist(e,at)<r)))inp[key]=false;
        }
        if(!inp.g1 && !inp.g2 && (engage || s.alert && dist(target,p)<180) && !reserved(target)){
          const h=sim.pickHack(s,target.x,target.y);
          if(h?.ok && h.enemy===target && h.act!=='detonate' && !(h.act==='stun' && (target.stun>.3 || target.beeOpen>s.t || target.trance>0))){inp.hack=true;inp.ax=target.x;inp.ay=target.y;inp.fire=false;}
        }
      }
      const armed=p.gad.find(g=>g.armed);
      if(armed && inp.fire){
        const impact=A.launcherImpact(s,inp.ax,inp.ay),r=impact.r+60;
        if(impact.unsafe || dist(target,impact)>impact.r+target.r || hostile.some(e=>reserved(e) && dist(e,impact)<r)){
          inp.fire=false;inp[p.gad[0]===armed?'g1':'g2']=true; // Unload: the wing can cover this lane with its rifle instead.
        }
      }
      if(inp.fire && hostile.some(e=>reserved(e) && A.segDist(e.x,e.y,p.x,p.y,inp.ax,inp.ay)<e.r+22))inp.fire=false;
      return inp;
    }
    return { act, wing, state: b };
  }

  // ===== 路上的決定：選門、選獎勵、逛黑市 =====
  const TAG_LOVE = { shock: 3, net: 2.5, blast: 2, body: 2.2, gun: 2.4, puppet: 1.5 };
  function scoreExploit(run, id) {
    const x = S3.run.exploitDef(id), own = run.build.exploits;
    let sc = { c: 1, u: 1.6, r: 2.4 }[x.rar] * (TAG_LOVE[x.tag] || 1);
    if (Object.keys(own).some((o) => S3.run.exploitDef(o).tag === x.tag)) sc *= 1.25;
    if (id === 'kevlar' || id === 'plating' || id === 'secondwind') sc *= 1.5;
    if (id === 'glasscannon' || id === 'silencer' || id === 'hoard') sc *= 0.5;
    return sc;
  }
  // 全隊還剩幾成體力（倒下的人算零）。
  function health(run) {
    let hp = 0, top = 0;
    run.squad.forEach((m, i) => { top += S3.run.maxHp(run, i); if (!m.down) hp += m.hp; });
    return hp / top;
  }
  function chooseDoor(run,keepCrew=false) {
    const frac = health(run);
    let best = 0, bs = -1e9;
    run.options.forEach((o, i) => {
      if(keepCrew && o.type==='cells')return; // Always at least one combat or non-cell door.
      let sc = 0;
      if (o.type === 'safe') sc = frac < 0.7 ? 9 : 3;
      else if (o.type === 'shop') sc = run.data >= 70 ? 7 : 2;
      else if (o.type === 'event') sc = 5;
      else if (o.type === 'elite') sc = frac > 0.7 ? 6 : 0;
      else if (o.type === 'boss') sc = 1;
      else if (o.type === 'cells') sc = run.squad.some((m) => m.down) ? 9 : run.held ? 6.5 : 4.5;
      else sc = { exploit: 5.5, gadget: 4.5, heal: frac < 0.6 ? 8 : 2, max: 5, data: 3.5 }[o.reward] || 4;
      if (o.mod === 'overtime' || o.mod === 'sweep' || o.mod === 'kennel' || o.mod === 'jam') sc -= frac < 0.6 ? 3 : 1;
      if (o.mod === 'supply' || o.mod === 'shift') sc += 1;
      if (sc > bs) { bs = sc; best = i; }
    });
    return best;
  }
  function chooseReward(run, rw) {
    if (!rw.picks) return null;
    if (rw.kind === 'gadget') {
      // 隊上已經有的就升級；共用的那一格空著就拿新的；都不是就不換。
      const have = (id) => run.squad.some((m) => m.gadget.id === id) || (run.gear && run.gear.id === id);
      return rw.picks.find(have) || (run.gear ? null : rw.picks[0]);
    }
    return rw.picks.slice().sort((a, b) => scoreExploit(run, b) - scoreExploit(run, a))[0];
  }
  function settle(run) {
    // 把安全屋、事件給的「再挑一個」領完。
    while (run.phase === 'reward' && run.pending) S3.run.take(run, chooseReward(run, run.pending));
  }
  function visit(run) {
    const frac = health(run);
    if (run.phase === 'shop') {
      const items = run.shop.items;
      const healIdx = items.findIndex((it) => it.k === 'heal');
      if (frac < 0.65) S3.run.buy(run, healIdx);
      items.map((it, i) => ({ it, i })).filter((o) => o.it.k === 'exploit').sort((a, b) => (b.it.owner?3:0)-(a.it.owner?3:0)+scoreExploit(run, b.it.id) - scoreExploit(run, a.it.id)).forEach((o) => S3.run.buy(run, o.i));
      if (!run.gear) S3.run.buy(run, items.findIndex((it) => it.k === 'gadget'));
      run.phase = 'done';
    } else if (run.phase === 'safe') S3.run.safe(run, frac < 0.7 ? 'rest' : 'tune');
    else if (run.phase === 'event') {
      const def = S3.run.eventDef(run.event.id), c0 = def.choices[0];
      const risky = (c0.fx && (c0.fx.hurt || c0.fx.maxHp < 0) && frac < 0.6) || !S3.run.canChoose(run, 0);
      S3.run.choose(run, risky ? 1 : 0);
    }
    settle(run);
  }

  // 自己打完一整趟。o：{ perks 永久強化、held 名冊裡有幾個人被關、limit 每間最多幾步 }。回傳 { won, run, rooms: [...] }。
  function playRun(seed, o = {}) {
    const m = o.meta || { echoes: 0, perks: o.perks || {}, runs: 0, wins: 0, best: 0, seen: {}, roster: [] };
    const people=o.crew || S3.run.crewFor(seed);
    if(o.omni)m.roster=people.map(p=>({p,status:'ready',runs:0}));
    const run=o.omni ? S3.omni.create(seed,people,m) : S3.run.start(seed,people,m,o.deployment);
    if (o.held && !o.omni) run.held = o.held;
    const windows=[];
    const limit = o.limit || 60 * 150, rooms = [];
    let nextDoor=null;
    for (let guard = 0; guard < (o.omni ? o.stopAt || 300 : 80) && run.phase === 'route'; guard++) {
      const spec = S3.run.enter(run, nextDoor??chooseDoor(run,o.keepCrew));nextDoor=null;
      if(run.omni)S3.omni.snapshot(run,m);
      if (spec) {
        const s = sim.createRoom(spec, S3.run.simBuild(run), S3.run.carry(run));
        const bot = create(seed + ':' + run.roomNo);
        const tick=()=>{sim.step(s,bot.act(s));s.ev.length=0;};
        while (!s.over && !(s.cleared && s.cache.taken) && s.tick<limit)tick();
        const stalled=!s.over && !(s.cleared && s.cache.taken);
        const row={ no: run.roomNo, type: run.node.type, mod: run.node.mod, boss: spec.boss, secs: Math.round(s.rt), ticks:s.tick, hp: Math.round(s.p.hp), hurt: Math.round(s.stats.hurt), dead: s.over==='dead', timeout:stalled, silent: s.silent, down: s.team.filter(t=>t.down).length };
        rooms.push(row);
        if(stalled && (o.walkDoors || run.omni)){run.phase='timeout';break;}
        if(stalled && !s.cleared){s.over='dead';row.dead=true;} // Legacy CI pilot treats the limit as a loss.
        const rw = S3.run.finishRoom(run, s, m);
        if (!rw) break;
        if (rw.kind === 'rescue') S3.run.rescue(run, run.omni || o.meta?m:null); else S3.run.take(run, chooseReward(run, rw));
        if(o.walkDoors && S3.run.advance(run)==='route'){
          S3.run.syncRoom(run,s);s.doorsOpen=true;bot.state.door=chooseDoor(run,o.keepCrew);
          const stop=s.tick+60*30;
          while(s.exit<0 && s.tick<stop)tick();
          row.ticks=s.tick;row.secs=Math.round(s.rt);
          if(s.exit<0){row.timeout=true;run.phase='timeout';break;}
          nextDoor=s.exit;if(!run.squad[s.active].down)run.active=s.active;
        }
      } else visit(run);
      if (run.phase === 'doors' || run.phase === 'done') S3.run.advance(run);
      if(run.omni && run.phase==='window'){
        // 同一個抵達狀態分岔：記下此刻真實退出的結算，原隊依策略撤出或繼續。
        S3.omni.snapshot(run,m);
        const twin=JSON.parse(JSON.stringify(m)),exit=S3.omni.decide(twin.omniRun,twin,true);
        windows.push({no:run.roomNo,alive:S3.run.alive(run).length,earned:exit.earned});
        S3.omni.decide(run,m,!!o.exitAt && run.roomNo>=o.exitAt);
      }
    }
    if(run.omni && run.phase==='dead')S3.omni.finish(run,m);
    return { won: run.phase === 'won' || run.phase==='exited', run, rooms, ...(o.omni?{windows}:{} ) };
  }

  S3.bot = { create, playRun, chooseDoor, chooseReward, visit, health };
})(window.ECHO = window.ECHO || {});
