// 試聽室的「上一版」：128e678 實際播放的第 6–9 階段配方。遊戲不載入此檔。
// 原第 5 階段的配方已回到遊戲本體（sounds.js），不必在比較頁再註冊一份。
(function (sfx) {
  sfx.add(kit => {
    const {osc, hiss, rotor, rnd} = kit;
    const tone = (f,t,d,v,to=f,w='sine',o={}) => osc(w,f,t,d,v,{to,...o});
    const knock = (t,f=132,v=.23,d=.115) => tone(f,t,d,v,f*.38,'sine',{a:.002});
    const metal = (t,f=860,v=.11,d=.07) => tone(f,t,d,v,f*.85,'triangle',{a:.002,lp:2200,fm:{ratio:1.46,depth:f*.22}});
    const air = (t,d,v,f,to=f) => hiss(t,d,v,{f,to,q:.83,a:.002});
    const motor = (f,rate,d,v,lp=590) => rotor(0,d,v,{f,rate,lp});
    const notes = (fs,gap,d,v,w='sine',o={}) => fs.forEach((f,i)=>tone(f,i*gap,d,v,f,w,o));
    return {
      s3v6_rifle: ()=>{ knock(0,rnd(148,156),.39,.097); air(0,.060,.37,2050,590); tone(317,0,.052,.18,118,'triangle'); metal(.047,740,.115,.035); },
      s3v6_rifleQuiet: ()=>{ knock(0,172,.17,.075); metal(.031,825,.083,.036); metal(.058,448,.048,.028); },
      s3v6_carbine: ()=>{ knock(0,191,.23,.067); air(0,.047,.18,1700,850); metal(.031,935,.107,.036); },
      s3v6_carbineQuiet: ()=>{ knock(0,199,.132,.054); metal(.028,1035,.070,.041); },
      s3v6_cargo: ()=>{ motor(68,19,.65,.065,360); metal(.08,350,.14,.09); },
      s3v6_cargoDrop: ()=>{ knock(0,106,.31,.22); knock(.057,150,.14,.095); metal(.105,330,.086,.073); },
      s3v6_eagleLure: ()=>{ notes([430,570],.115,.097,.125,'triangle',{lp:1150}); },
      s3v6_hypnosis: ()=>{ notes([536,504,476],.14,.27,.090,'sine',{detune:12,wet:.13}); },
      s3v6_execute: ()=>{metal(0,1120,.12,.036);knock(.052,108,.27,.13);},
      s3v6_quickstep: ()=>{air(0,.12,.15,550,1700);metal(.07,660,.12,.05);metal(.13,970,.08,.036);},
      s3v6_veil: ()=>{tone(760,0,.32,.12,186,'sine',{detune:8});tone(355,.15,.31,.08,185);},
      s3v6_shockdrone: ()=>{motor(205,42,.46,.048,1380);tone(510,.07,.24,.105,1090,'triangle');},
      s3v6_droneArc: ()=>{air(0,.06,.12,2600,1100);tone(1140,.014,.10,.10,376,'triangle',{fm:{ratio:1.8,depth:340}});},
      s3v6_rush: ()=>{knock(0,125,.19);knock(.07,140,.23);air(.09,.19,.12,520,1130);},
      s3v6_hiveguard: ()=>{[253,269,289].forEach((f,i)=>tone(f,i*.045,.42,.044,f*.68,'sawtooth',{lp:870,pan:(i-1)*.4}));},
      s3v6_performance: ()=>{metal(0,706,.08,.1);tone(943,.12,.46,.09,942,'sine',{wet:.15});},
      s3v6_metronome: ()=>{[0,.19,.38].forEach((t,i)=>{metal(t,i===2?920:735,.09,.045);knock(t,310,.065,.04);});},
      s3v6_molotov: ()=>{metal(0,1450,.075,.115);air(.05,.29,.10,1430,650);},
      s3v6_pipebomb: ()=>{knock(0,229,.15,.08);metal(.025,540,.12,.16);air(.12,.25,.08,1900,1400);},
      s3v6_medbeacon: ()=>{knock(0,165,.16);notes([440,659,880],.087,.17,.084,'sine',{wet:.09});},
      s3v6_injunction: ()=>{knock(0,146,.25,.12);metal(.025,430,.07,.08);tone(610,.11,.27,.11,305,'triangle');},
      s3v6_escortWrit: ()=>{[0,.08].forEach(t=>knock(t,204,.16,.08));notes([349,523],.16,.21,.08,'triangle',{lp:1320});},
      s3v6_boom: ()=>{ knock(0,111,.32,.38); air(0,.23,.29,1830,240); [0,.09].forEach((t,i)=>metal(.10+t,680-220*i,.10,.08)); },
      s3v6_omniEntry: ()=>{tone(132,0,.56,.13,376,'sine',{a:.08});tone(397,.08,.46,.07,376,'triangle');metal(.53,752,.075,.10);},
      s3v6_omniWindow: ()=>{notes([330,495],.18,.33,.115,'sine',{a:.024,wet:.22});tone(660,.41,.36,.085);},
      s3v6_omniOverflow: ()=>{notes([580,870,1160],.052,.12,.095,'triangle',{wet:.11});tone(1740,.16,.11,.035);},
      s3v6_omniHeld: ()=>{air(0,.12,.11,1750,380);metal(.11,460,.15,.05);knock(.24,105,.23,.20);tone(135,.29,.23,.09,73);},
    };
  });
})(window.ECHO.sfx);
