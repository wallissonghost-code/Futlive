(()=>{'use strict';
const VERSION='0.61.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
const now=()=>performance.now();
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||!e.players?.length||typeof e.ownedAI!=='function'){setTimeout(boot,45);return}
  if(e.__possessionIntelligenceV061)return;e.__possessionIntelligenceV061=true;
  const oldOwned=e.ownedAI.bind(e);
  const attack=t=>t==='blue'?1:-1;
  const living=p=>p&&!p.sentOff&&!p.tempSuspended;
  const fielders=t=>e.players.filter(p=>living(p)&&!p.goalkeeper&&(!t||p.team===t));
  const opponents=t=>fielders(other(t));
  const mates=(t,c)=>fielders(t).filter(p=>p!==c);
  const goalX=(t,f)=>t==='blue'?f.right:f.left;
  const ownGoalX=(t,f)=>t==='blue'?f.left:f.right;
  function nearestOppDist(team,q){const os=opponents(team);return os.length?Math.min(...os.map(o=>Math.hypot(q.x-o.x,q.y-o.y))):999}
  function pressureCount(p,r=54){return opponents(p.team).filter(o=>e.dist(p,o)<r).length}
  function laneSafety(c,t){const os=opponents(c.team),dx=t.x-c.x,dy=t.y-c.y,len2=dx*dx+dy*dy||1;let min=999,count=0;for(const o of os){const u=clamp(((o.x-c.x)*dx+(o.y-c.y)*dy)/len2,0,1),px=c.x+dx*u,py=c.y+dy*u,d=Math.hypot(o.x-px,o.y-py);min=Math.min(min,d);if(d<28)count++}return{min,count}}
  function marking(t){const n=opponents(t.team).filter(o=>e.dist(t,o)<52).length,close=opponents(t.team).filter(o=>e.dist(t,o)<34).length;return{n,close,space:nearestOppDist(t.team,t)}}
  function passScore(c,t,f){const a=attack(c.team),forward=(t.x-c.x)*a,dist=e.dist(c,t),mark=marking(t),lane=laneSafety(c,t),goalGain=Math.abs(goalX(c.team,f)-c.x)-Math.abs(goalX(c.team,f)-t.x);let score=0;score+=forward*.28+goalGain*.18+mark.space*.62+lane.min*.68-dist*.06;score-=mark.n*24+mark.close*28+lane.count*24;if(t.personality==='finisher'&&forward>25)score+=14;if(t.personality==='wing'&&mark.space>48)score+=10;if(forward<0)score-=18;if(dist<34)score-=35;if(dist>f.w*.46)score-=42;if(mark.n>=3)score-=85;if(lane.count>=2)score-=55;return{score,mark,lane,forward,dist}}
  function bestPass(c,f){let best=null,bestMeta=null;for(const t of mates(c.team,c)){const m=passScore(c,t,f);if(!bestMeta||m.score>bestMeta.score){best=t;bestMeta=m}}return{target:best,meta:bestMeta}}
  function openGoalLane(c,f){const gx=goalX(c.team,f),gy=(f.goalTop+f.goalBottom)/2,dx=gx-c.x,dy=gy-c.y,len2=dx*dx+dy*dy||1;let min=999,count=0;for(const o of opponents(c.team)){const u=clamp(((o.x-c.x)*dx+(o.y-c.y)*dy)/len2,0,1),px=c.x+dx*u,py=c.y+dy*u,d=Math.hypot(o.x-px,o.y-py);min=Math.min(min,d);if(d<26)count++}return{min,count}}
  function shouldLongShoot(c,f,pressure){const dist=Math.abs(goalX(c.team,f)-c.x),ratio=dist/f.w;if(ratio<.16||ratio>.43)return false;const lane=openGoalLane(c,f),central=1-clamp(Math.abs(c.y-f.h*.5)/(f.h*.45),0,1),skill=c.skill?.shoot||.6,comp=c.skill?.composure||.6;let chance=.025+skill*.10+comp*.055+central*.055+(lane.min>34?.05:0)-(pressure*.045)-(lane.count*.045);if(c.personality==='finisher')chance+=.045;if(ratio>.34)chance*=.58;return Math.random()<clamp(chance,.015,.22)}
  function runTarget(p,c,f,index){const a=attack(p.team),baseAdvance=p.personality==='finisher'?118:p.personality==='wing'?102:p.personality==='support'?76:62;let x=c.x+a*baseAdvance,y=p.y;const side=p.home?.[1]<.5?-1:1;if(p.personality==='wing')y=clamp(c.y+side*(72+index*8),f.top+34,f.bottom-44);else if(p.personality==='finisher')y=clamp(c.y+side*24,f.top+36,f.bottom-46);else if(p.personality==='support')y=clamp(c.y-side*54,f.top+34,f.bottom-44);else y=clamp((p.y+c.y)*.5,f.top+34,f.bottom-44);const os=opponents(p.team);if(os.length){const near=os.sort((u,v)=>e.dist(p,u)-e.dist(p,v))[0];const dy=y-near.y;if(Math.abs(dy)<42)y+=dy>=0?36:-36}return{x:clamp(x,f.left+34,f.right-34),y:clamp(y,f.top+34,f.bottom-44)}}
  function supportRuns(c,dt,f){const list=mates(c.team,c).sort((a,b)=>Math.abs(goalX(c.team,f)-a.x)-Math.abs(goalX(c.team,f)-b.x));list.forEach((p,i)=>{const q=runTarget(p,c,f,i);const mul=p.personality==='finisher'||p.personality==='wing'?0.90:0.74;e.moveToward(p,q.x,q.y,p.speed*mul,dt)})}
  function defendWhileOwned(c,dt,f){const os=opponents(c.team).sort((a,b)=>e.dist(a,c)-e.dist(b,c));os.forEach((p,i)=>{if(i===0){e.moveToward(p,c.x-attack(p.team)*10,c.y,p.speed*.88,dt);return}if(i===1){e.moveToward(p,c.x-attack(p.team)*52,(c.y+p.y)*.5,p.speed*.70,dt);return}const hx=f.w*p.home[0],hy=f.h*p.home[1];e.moveToward(p,clamp(hx+(c.x-f.w*.5)*.10,f.left+32,f.right-32),clamp(hy+(c.y-f.h*.5)*.16,f.top+32,f.bottom-44),p.speed*.56,dt)})}
  function carrierMove(c,dt,f,pressure){const a=attack(c.team),gx=goalX(c.team,f),gy=(f.goalTop+f.goalBottom)/2;let tx=c.x+a*(pressure>=2?24:pressure?34:48),ty=c.y+(gy-c.y)*(pressure?0.08:0.16);const os=opponents(c.team).filter(o=>e.dist(c,o)<72);if(os.length){let avoidX=0,avoidY=0;for(const o of os){const dx=c.x-o.x,dy=c.y-o.y,d=Math.hypot(dx,dy)||1,w=(74-Math.min(74,d))/74;avoidX+=dx/d*w;avoidY+=dy/d*w}tx+=avoidX*(pressure>=2?28:18);ty+=avoidY*(pressure>=2?34:22)}if(pressure>=3){tx=c.x-a*22;ty=c.y+(c.y<gy?-24:24)}e.moveToward(c,clamp(tx,f.left+30,f.right-30),clamp(ty,f.top+30,f.bottom-42),c.speed*(pressure>=3?.62:pressure>=2?.72:.88),dt);e.syncOwnedBall()}
  function decide(c,f,pressure){const t=now();if(t<(c.__possessionThinkAt||0))return false;const possess=t-(e.ownerSince||t),pick=bestPass(c,f);const safe=pick.target&&pick.meta&&pick.meta.score>34&&pick.meta.mark.n<3&&pick.meta.lane.count<2;const forwardSafe=safe&&pick.meta.forward>8;if(t>e.actionLock&&possess>520&&shouldLongShoot(c,f,pressure)){c.__possessionThinkAt=t+900;e.shoot(c,f);return true}if(pressure>=3){if(safe&&pick.meta.score>48){c.__possessionThinkAt=t+700;e.pass(c,pick.target);return true}c.__possessionThinkAt=t+380;return false}if(pressure>=2&&safe&&possess>620){c.__possessionThinkAt=t+720;e.pass(c,pick.target);return true}if(forwardSafe&&possess>900&&Math.random()<.46){c.__possessionThinkAt=t+760;e.pass(c,pick.target);return true}if(safe&&pick.meta.forward<0&&pressure>=1&&possess>1100){c.__possessionThinkAt=t+760;e.pass(c,pick.target);return true}c.__possessionThinkAt=t+(pressure?360:480);return false}
  e.ownedAI=(dt,f)=>{if(window.FutLiveMatchState?.phase&&window.FutLiveMatchState.phase!=='PLAYING')return;const c=e.ball.owner;if(!c)return;if(c.goalkeeper)return oldOwned(dt,f);if(c.sentOff||c.tempSuspended)return;const pressure=pressureCount(c,54);supportRuns(c,dt,f);defendWhileOwned(c,dt,f);carrierMove(c,dt,f,pressure);if(e.challengeOwner(c,dt))return;decide(c,f,pressure)};
  window.FutLivePossessionIntelligence={version:VERSION,bestPass,passScore,marking,laneSafety,pressureCount,shouldLongShoot};
}
boot();
})();