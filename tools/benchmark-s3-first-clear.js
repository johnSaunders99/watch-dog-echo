// Offline only: node tools/benchmark-s3-first-clear.js [paired seeds=32] [workers=6] [relay|field] > results.json
// Uses the page's real campaign modules and an in-memory save, never a player's storage.
'use strict';
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const root=path.join(__dirname,'..'),modes=['relay','field'];
function boot(){
  const store=new Map();global.window=global;global.document={documentElement:{}};
  global.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const html=fs.readFileSync(path.join(root,'s3.html'),'utf8');
  for(const [,src] of html.matchAll(/<script src="([^"]+)"/g))
    if(src.startsWith('js/engine/') || src.startsWith('content-') || /^js\/s3\/(gen|sim|fireteam|field-skills|foes|run|omni|bot)\.js$/.test(src))require(path.join(root,src));
  return global.ECHO.s3;
}
function oneSeed(S,i,onlyJob,onlyMode){
  const R=S.run,seed='first-clear-'+i;
  let opening,draw=0;
  do{opening=R.newGame('random',seed+':camden:'+draw++,{}).meta;}while(opening.roster.some(m=>m.p.elite || m.p.signal));
  const ordinary=opening.roster.slice(0,3).map(m=>m.p);
  const runs=[];
  for(const job of ['ordinary',...Object.keys(S.ops.profiles)])for(const mode of modes){
    if(onlyJob && onlyJob!==job || onlyMode && onlyMode!==mode)continue;
    const meta=structuredClone(opening),people=structuredClone(ordinary);
    if(job!=='ordinary'){
      // One legal first-clear state: Return with its guaranteed contact and no bonus contact.
      // Only the identity of the free invitation changes between the ten post-clear groups.
      meta.runs=meta.wins=1;meta.endings.return=1;meta.story.ended='return';meta.unlocks={jobs:[job],events:[S.data.endingContacts.return]};
      meta.invitations=[job];meta.offers={[job]:S.ops.person(job)};
      if(!R.recruit(meta,0))throw new Error('Free invitation was not recruitable: '+job);
      people[0]=meta.roster.at(-1).p;
    }
    const {rooms,run,won}=S.bot.playRun(seed,{deployment:mode,meta,crew:people,keepCrew:true,walkDoors:true});
    if(rooms.some(r=>r.type==='cells') || run.squad.some((m,j)=>!R.same(m.p,people[j])))throw new Error('Starting lineup changed: '+seed+'/'+job+'/'+mode);
    if(won && (run.roomNo!==20 || run.stats.bosses!==3))throw new Error('Premature clear');
    runs.push({job,mode,kit:people[0].template??null,outcome:run.phase,room:run.roomNo,bosses:run.stats.bosses,
      ticks:rooms.reduce((n,r)=>n+r.ticks,0),...(rooms.some(r=>r.timeout)?{timeoutRoom:rooms.find(r=>r.timeout).no}:{})});
  }
  return {seed,opening:opening.seed,ordinary:ordinary.map(p=>({id:p.id,job:p.occupation})),runs};
}
function report(samples){
  const summary=[],n=samples.length;
  for(const {job,mode,kit} of samples[0].runs){
    const all=samples.map(s=>s.runs.find(r=>r.job===job && r.mode===mode)),wins=all.filter(r=>r.outcome==='won'),stalls=all.filter(r=>r.timeoutRoom);
    const sum=xs=>xs.reduce((t,r)=>t+r.ticks,0);
    summary.push({job,mode,kit,n,wins:wins.length,stalls:stalls.length,
      meanWinSec:wins.length?sum(wins)/(60*wins.length):null,secPerWin:wins.length && !stalls.length?sum(all)/(60*wins.length):null});
  }
  return {design:'first-clear-v1',hz:60,n,summary,samples,condition:{
    baseline:'First three ordinary Camden starters without inheritance, perks or signal actors.',
    after:'Return with Aiden only, one free founder recruited into slot 1, same two ordinary teammates. No permanent perks or detours for replacement recruits.',
    timing:'60 Hz, from first combat through doors to final reward/ending menu or defeat. No reading, menus or real-time rendering overhead.',
    index:'Total ticks including losses per win, relative to ordinary relay=100.'
  }};
}
if(require.main!==module){module.exports={boot,oneSeed,report};}
else if(!isMainThread){
  const S=boot();for(const i of workerData.ids)parentPort.postMessage(oneSeed(S,i,null,workerData.mode));
}else{
  const n=Number(process.argv[2]??32),parallel=Number(process.argv[3]??Math.min(6,os.availableParallelism())),mode=process.argv[4];
  if(!Number.isSafeInteger(n)||!Number.isSafeInteger(parallel)||n<1||parallel<1)throw new Error('Expected positive counts');
  if(mode && !modes.includes(mode))throw new Error('Expected relay or field');
  const width=Math.min(n,parallel),samples=Array(n);
  Promise.all(Array.from({length:width},(_,w)=>new Promise((resolve,reject)=>{
    const ids=Array.from({length:Math.ceil((n-w)/width)},(_,j)=>w+j*width);
    const worker=new Worker(__filename,{workerData:{ids,mode}});let done=0;
    worker.on('message',s=>{samples[ids[done++]]=s;process.stderr.write(s.seed+' done\n');});
    worker.on('error',reject);worker.on('exit',code=>code===0 && done===ids.length?resolve():reject(new Error('Incomplete worker '+w)));
  }))).then(()=>{
    const result=report(samples);
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if(result.summary.some(g=>g.stalls)){console.error('Unresolved stalled rooms; do not rate these as defeats.');process.exitCode=2;}
  }).catch(e=>{console.error(e);process.exitCode=1;});
}
