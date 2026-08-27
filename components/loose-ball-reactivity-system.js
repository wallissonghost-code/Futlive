(()=>{'use strict';
const VERSION='0.60.2';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||!e.players?.length||!e.moveToward||!e.freeAI){setTimeout(boot,45);return}
  if(e.__looseBallReactivityV0602)return;e.__looseBallReactivityV0602=true;
  const oldFree=e.freeAI.bind(e);
  const fielders=t=>e.players.filter(p=>!p.goalkeeper&&!p.sentOff&&!p.tempSuspended&&(!t||p.team===t));
  const playable=()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.();
  function predict(t){
    if(e.ball.owner)return{x:e.ball.x,y:e.ball.y};
    const drag=e.ball.type?.startsWith('shot')?.76:.60;
    const factor=t>0?(1-Math.pow(drag,t))/Math.max(.001,-Math.log(drag)):0;
    return{x:e.ball.x+e.ball.vx*factor,y:e.ball.y+e.ball.vy*factor}
  }
  function interceptScore(p,q){
    const d=Math.hypot(q.x-p.x,q.y-(p.y+27));
    const roleBoost=p.personality==='wing'?10:p.personality==='support'?7:p.personality==='creator'?5:0;
    return d/Math.max(38,p.speed)-roleBoost/100
  }
  function reactTeam(team,dt,f){
    const ps=fielders(team);if(!ps.length)return;
    const speed=Math.hypot(e.ball.vx,e.ball.vy),passing=/pass|cross|throw-in|goal-kick/.test(e.ball.type||'');
    const qFast=predict(speed>150?.32:.24),qLead=predict(speed>120?.48:.36);
    const ranked=ps.map(p=>({p,score:interceptScore(p,qFast)})).sort((a,b)=>a.score-b.score);
    const chosen=[];
    if(e.ball.intended&&e.ball.intended.team===team&&!e.ball.intended.goalkeeper&&!e.ball.intended.sentOff)chosen.push({p:e.ball.intended,rank:-1});
    for(const item of ranked){if(chosen.some(x=>x.p===item.p))continue;chosen.push({p:item.p,rank:chosen.length});if(chosen.length>=3)break}
    chosen.forEach((item,i)=>{
      const p=item.p,rank=item.rank<0?0:item.rank;
      let tx=rank===0?qFast.x:qLead.x,ty=rank===0?qFast.y-27:qLead.y-27;
      if(rank===1){const side=p.y<qLead.y?-1:1;ty+=side*18}
      if(rank===2){const attack=team==='blue'?1:-1;tx-=attack*28;ty+=(p.home?.[1]<.5?-1:1)*22}
      tx=clamp(tx,f.left+26,f.right-26);ty=clamp(ty,f.top+24,f.bottom-40);
      const dist=Math.hypot(tx-p.x,ty-p.y);
      if(dist<8)return;
      const mul=rank===0?(passing?1.08:1.02):rank===1?.84:.66;
      e.moveToward(p,tx,ty,p.speed*mul,dt)
    })
  }
  e.freeAI=(dt,f)=>{
    if(!playable())return;
    oldFree(dt,f);
    if(e.ball.owner)return;
    reactTeam('blue',dt,f);reactTeam('red',dt,f);
    if(performance.now()>=e.ball.pickupLock){
      const candidates=fielders().map(p=>({p,d:e.footDist(p)})).sort((a,b)=>a.d-b.d).slice(0,6);
      for(const {p,d} of candidates){
        if(d>14)continue;
        const speed=Math.hypot(e.ball.vx,e.ball.vy),control=clamp(.50+(p.skill.control||.5)*.38-speed/1050,.16,.90);
        if(Math.random()<control){e.takePossession(p,'proactive-recovery');break}
      }
    }
  };
  window.FutLiveLooseBallReactivity={version:VERSION,predict,debug:()=>({ball:{type:e.ball.type,speed:+Math.hypot(e.ball.vx,e.ball.vy).toFixed(1)},phase:window.FutLiveMatchState?.phase})};
}
boot();
})();