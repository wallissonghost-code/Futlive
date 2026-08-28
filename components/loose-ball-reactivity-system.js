(()=>{'use strict';
const VERSION='0.61.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||!e.players?.length||!e.moveToward||!e.freeAI){setTimeout(boot,45);return}
  if(e.__looseBallReactivityV061)return;e.__looseBallReactivityV061=true;
  const oldFree=e.freeAI.bind(e);
  const fielders=t=>e.players.filter(p=>!p.goalkeeper&&!p.sentOff&&!p.tempSuspended&&(!t||p.team===t));
  const playable=()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.();
  function predict(t){if(e.ball.owner)return{x:e.ball.x,y:e.ball.y};const drag=e.ball.type?.startsWith('shot')?.76:.60,factor=t>0?(1-Math.pow(drag,t))/Math.max(.001,-Math.log(drag)):0;return{x:e.ball.x+e.ball.vx*factor,y:e.ball.y+e.ball.vy*factor}}
  function interceptScore(p,q){const d=Math.hypot(q.x-p.x,q.y-(p.y+27)),roleBoost=p.personality==='wing'?8:p.personality==='support'?5:p.personality==='creator'?4:0;return d/Math.max(38,p.speed)-roleBoost/100}
  function reactTeam(team,dt,f){
    const ps=fielders(team);if(!ps.length)return;
    const speed=Math.hypot(e.ball.vx,e.ball.vy),passing=/pass|cross|throw-in|goal-kick/.test(e.ball.type||''),qFast=predict(speed>150?.32:.24),qLead=predict(speed>120?.48:.36);
    const ranked=ps.map(p=>({p,score:interceptScore(p,qFast)})).sort((a,b)=>a.score-b.score);
    const primary=e.ball.intended&&e.ball.intended.team===team&&!e.ball.intended.goalkeeper&&!e.ball.intended.sentOff?e.ball.intended:ranked[0]?.p;
    const cover=ranked.find(x=>x.p!==primary)?.p||null;
    if(primary){const tx=clamp(qFast.x,f.left+28,f.right-28),ty=clamp(qFast.y-27,f.top+26,f.bottom-40);if(Math.hypot(tx-primary.x,ty-primary.y)>8)e.moveToward(primary,tx,ty,primary.speed*(passing?1.05:1),dt)}
    if(cover){const attack=team==='blue'?1:-1,side=cover.home?.[1]<.5?-1:1,tx=clamp(qLead.x-attack*46,f.left+34,f.right-34),ty=clamp(qLead.y-27+side*34,f.top+30,f.bottom-44);if(Math.hypot(tx-cover.x,ty-cover.y)>10)e.moveToward(cover,tx,ty,cover.speed*.62,dt)}
  }
  e.freeAI=(dt,f)=>{
    if(!playable())return;
    oldFree(dt,f);
    if(e.ball.owner)return;
    reactTeam('blue',dt,f);reactTeam('red',dt,f);
    if(performance.now()>=e.ball.pickupLock){const candidates=fielders().map(p=>({p,d:e.footDist(p)})).sort((a,b)=>a.d-b.d).slice(0,4);for(const {p,d} of candidates){if(d>14)continue;const speed=Math.hypot(e.ball.vx,e.ball.vy),control=clamp(.50+(p.skill.control||.5)*.38-speed/1050,.16,.90);if(Math.random()<control){e.takePossession(p,'proactive-recovery');break}}}
  };
  window.FutLiveLooseBallReactivity={version:VERSION,predict,debug:()=>({ball:{type:e.ball.type,speed:+Math.hypot(e.ball.vx,e.ball.vy).toFixed(1)},phase:window.FutLiveMatchState?.phase})};
}
boot();
})();