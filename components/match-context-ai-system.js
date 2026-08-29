(()=>{'use strict';
const VERSION='0.57';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine,base=window.FutLiveFootballAI,tactics=window.FutLiveFootballTactics,intel=window.FutLivePlayerIntelligence;
  if(!e||!base||!tactics||!intel||!e.players?.length){setTimeout(boot,40);return}
  if(e.__matchContextV057)return;e.__matchContextV057=true;
  const old={moveToward:e.moveToward.bind(e),choosePassTarget:e.choosePassTarget.bind(e),pass:e.pass.bind(e),ownedAI:e.ownedAI.bind(e),takePossession:e.takePossession.bind(e)};
  const context={blue:null,red:null};
  const possession={blue:0,red:0,lastTeam:null,lastAt:performance.now()};
  const attack=t=>t==='blue'?1:-1;
  const fielders=t=>e.players.filter(p=>!p.sentOff&&!p.goalkeeper&&(!t||p.team===t));
  const goalX=(t,f)=>t==='blue'?f.right:f.left;
  const scoreDiff=t=>t==='blue'?e.score.blue-e.score.red:e.score.red-e.score.blue;
  const elapsed=()=>Math.max(0,window.FutLiveMatchFlow?.getElapsedMs?.()??window.FutLiveMatchState?.elapsedMs??0);
  function stage(){const s=elapsed()/1000;return s<90?'EARLY':s<210?'MID':'LATE'}
  function possessionShare(team){const total=possession.blue+possession.red;return total>0?possession[team]/total:.5}
  function updatePossessionClock(){const n=performance.now(),team=e.ball.owner?.team||null,playing=window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.();if(playing&&possession.lastTeam)possession[possession.lastTeam]+=n-possession.lastAt;possession.lastAt=n;possession.lastTeam=team}
  function derive(team,f){
    const diff=scoreDiff(team),st=stage(),brain=base.teams[team],share=possessionShare(team),losing=diff<0,winning=diff>0,late=st==='LATE';
    let mentality='BALANCED',risk=.50,tempo=.55,line=.50,press=.50,verticality=.50,width=.50;
    if(losing&&late){mentality='ALL_OUT';risk=.82;tempo=.88;line=.73;press=.90;verticality=.82;width=.64}
    else if(losing){mentality='CHASE';risk=.68;tempo=.74;line=.62;press=.72;verticality=.68;width=.60}
    else if(winning&&late){mentality='PROTECT';risk=.27;tempo=.36;line=.38;press=.39;verticality=.32;width=.46}
    else if(winning){mentality='CONTROL';risk=.39;tempo=.46;line=.46;press=.48;verticality=.42;width=.50}
    if(share<.38&&!winning){press=clamp(press+.10,0,1);tempo=clamp(tempo+.07,0,1)}
    if(share>.62&&winning){tempo=clamp(tempo-.08,0,1);risk=clamp(risk-.07,0,1)}
    if(brain.phase==='COUNTER_ATTACK'){tempo=clamp(tempo+.16,0,1);verticality=clamp(verticality+.18,0,1)}
    if(brain.phase==='LOW_BLOCK')line=clamp(line-.12,0,1);
    const ballY=e.ball.y,center=f.h*.5,strongSide=ballY<center?'TOP':'BOTTOM',weakSide=strongSide==='TOP'?'BOTTOM':'TOP';
    const c={team,stage:st,diff,mentality,risk,tempo,line,press,verticality,width,strongSide,weakSide,possession:share,updatedAt:performance.now()};
    context[team]=c;
    if(e.game){e.game.dataset[team+'Mentality']=mentality;e.game.dataset[team+'Tempo']=tempo.toFixed(2);e.game.dataset[team+'Risk']=risk.toFixed(2)}return c
  }
  function getContext(team,f){const c=context[team];return c&&Number.isFinite(c.verticality)&&Number.isFinite(c.width)&&Number.isFinite(c.line)&&Number.isFinite(c.press)&&Number.isFinite(c.risk)&&Number.isFinite(c.tempo)?c:derive(team,f)}
  function nearestOpponentDistance(team,q){const opp=fielders(other(team));return opp.length?Math.min(...opp.map(o=>Math.hypot(q.x-o.x,q.y-o.y))):120}
  function weakSideBonus(team,p,f){const c=getContext(team,f);const isTop=p.y<f.h*.5,isWeak=(c.weakSide==='TOP'&&isTop)||(c.weakSide==='BOTTOM'&&!isTop);return isWeak?18:0}
  function adaptTarget(p,tx,ty,speed){
    if(!p||p.goalkeeper||p.sentOff)return{x:tx,y:ty,speed};const f=e.field(),c=getContext(p.team,f),a=attack(p.team),carrier=e.ball.owner,ownPoss=carrier?.team===p.team;
    let x=tx,y=ty,mult=1;
    if(ownPoss){const vertical=(c.verticality-.5)*f.w*.11;x+=a*vertical;const center=f.h*.5,spread=(p.y<center?-1:1)*(c.width-.5)*f.h*.16;y+=spread;if(c.mentality==='PROTECT'&&p!==carrier)x-=a*f.w*.035;if(c.mentality==='ALL_OUT'&&p.personality!=='creator')x+=a*f.w*.045;mult=.86+c.tempo*.26}
    else if(carrier){const lineShift=(c.line-.5)*f.w*.13;x+=a*lineShift;const center=f.h*.5;y=center+(y-center)*(c.mentality==='PROTECT'?.78:c.mentality==='ALL_OUT'?.92:.86);const brain=base.teams[p.team];if((p===brain.pressor||p===brain.cover)&&c.press>.65)mult=1+(c.press-.5)*.38;else mult=.92+c.press*.12}
    return{x:clamp(x,f.left+30,f.right-30),y:clamp(y,f.top+30,f.bottom-42),speed:speed*mult}
  }
  e.moveToward=(p,tx,ty,speed,dt)=>{const q=adaptTarget(p,tx,ty,speed);return old.moveToward(p,q.x,q.y,q.speed,dt)};
  e.choosePassTarget=(c)=>{if(!c)return null;const f=e.field(),ctx=getContext(c.team,f),a=attack(c.team),cands=fielders(c.team).filter(p=>p!==c&&!tactics.offside(p,c.x));let best=null,bestScore=-1e9;for(const p of cands){const forward=(p.x-c.x)*a,space=nearestOpponentDistance(c.team,p),dist=e.dist(c,p),goalGain=Math.abs(goalX(c.team,f)-c.x)-Math.abs(goalX(c.team,f)-p.x),weak=weakSideBonus(c.team,p,f);let s=space*.58-dist*.05+forward*(.12+ctx.verticality*.22)+goalGain*(.08+ctx.risk*.18)+weak*(.4+ctx.width*.6);if(ctx.mentality==='PROTECT'&&forward<0)s+=20;if(ctx.mentality==='ALL_OUT'&&forward>35)s+=22;if(p.personality==='creator'&&ctx.mentality==='CONTROL')s+=12;if(p.personality==='finisher'&&ctx.risk>.62&&forward>0)s+=16;if(s>bestScore){bestScore=s;best=p}}return best||old.choosePassTarget(c)};
  e.pass=(c,t)=>{if(!c||!t)return;const f=e.field(),ctx=getContext(c.team,f),a=attack(c.team);const forward=(t.x-c.x)*a,across=Math.abs(t.y-c.y)>f.h*.30;if(across&&ctx.width>.54&&nearestOpponentDistance(c.team,t)>38){const originalPass=c.skill.pass;c.skill.pass=clamp(c.skill.pass+.05,0,1);e.game.dataset.lastTeamAction='SWITCH_PLAY';const r=old.pass(c,t);c.skill.pass=originalPass;return r}if(forward>45&&ctx.verticality>.68)e.game.dataset.lastTeamAction='DIRECT_ATTACK';else if(forward<0&&ctx.mentality==='PROTECT')e.game.dataset.lastTeamAction='RECYCLE';return old.pass(c,t)};
  e.takePossession=(p,reason='control')=>{updatePossessionClock();const r=old.takePossession(p,reason);if(p){const f=e.field(),ctx=derive(p.team,f);if(ctx.mentality==='ALL_OUT')p.nextThink=Math.min(p.nextThink||Infinity,performance.now()+260);if(ctx.mentality==='PROTECT')p.nextThink=Math.max(p.nextThink||0,performance.now()+520)}return r};
  e.ownedAI=(dt,f)=>{updatePossessionClock();derive('blue',f);derive('red',f);const owner=e.ball.owner;if(owner&&!owner.goalkeeper){const ctx=getContext(owner.team,f);owner.aiTeamRisk=ctx.risk;owner.aiTeamTempo=ctx.tempo;owner.aiMentality=ctx.mentality}return old.ownedAI(dt,f)};
  const oldFree=e.freeAI.bind(e);e.freeAI=(dt,f)=>{updatePossessionClock();derive('blue',f);derive('red',f);return oldFree(dt,f)};
  derive('blue',e.field());derive('red',e.field());
  window.FutLiveMatchContextAI={version:VERSION,context,possession,get:team=>context[team]?{...context[team]}:null,stage,debug:()=>({stage:stage(),elapsedMs:elapsed(),blue:context.blue?{...context.blue}:null,red:context.red?{...context.red}:null,possession:{blue:possession.blue,red:possession.red,shareBlue:possessionShare('blue')}})};
}
boot();
})();