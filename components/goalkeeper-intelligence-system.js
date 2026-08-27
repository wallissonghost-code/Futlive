(()=>{'use strict';
const VERSION='0.58';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine,base=window.FutLiveFootballAI,tactics=window.FutLiveFootballTactics;
  if(!e||!base||!tactics||!e.goalkeepers?.length){setTimeout(boot,40);return}
  if(e.__goalkeeperIntelligenceV058)return;e.__goalkeeperIntelligenceV058=true;
  const old={updateGoalkeepers:e.updateGoalkeepers.bind(e),takePossession:e.takePossession.bind(e),pass:e.pass.bind(e)};
  const state=new Map();
  const now=()=>performance.now();
  const fielders=t=>e.players.filter(p=>!p.goalkeeper&&!p.sentOff&&(!t||p.team===t));
  const ownGoalX=(g,f)=>g.team==='blue'?f.left:f.right;
  const attackDir=t=>t==='blue'?1:-1;
  const speed=()=>Math.hypot(e.ball.vx,e.ball.vy);
  function gs(g){if(!state.has(g))state.set(g,{mode:'SET',lastSaveAt:0,lastDecisionAt:0,claimUntil:0,distribution:null});return state.get(g)}
  function shotIntersection(g,f){
    if(e.ball.owner)return null;const gx=ownGoalX(g,f),vx=e.ball.vx;if(Math.abs(vx)<1)return null;
    const toward=g.team==='blue'?vx<0:vx>0;if(!toward)return null;const t=(gx-e.ball.x)/vx;if(t<=0||t>2.2)return null;
    const y=e.ball.y+e.ball.vy*t;return{t,y,speed:speed(),inMouth:y>=f.goalTop-18&&y<=f.goalBottom+18}
  }
  function anglePosition(g,f){
    const gx=ownGoalX(g,f),center=(f.goalTop+f.goalBottom)/2,ball=e.ball.owner?e.foot(e.ball.owner):e.ball;
    const distX=Math.abs(ball.x-gx),depth=clamp(distX/(f.w*.42),0,1),stepOut=(1-depth)*(f.w*.045);
    const x=g.team==='blue'?gx+18+stepOut:gx-18-stepOut;
    const lateral=clamp((ball.y-center)*.34,-(f.goalBottom-f.goalTop)*.34,(f.goalBottom-f.goalTop)*.34);
    return{x,y:clamp(center-27+lateral,f.goalTop+6,f.goalBottom-34)}
  }
  function oneVsOne(g,f){
    const c=e.ball.owner;if(!c||c.team===g.team||c.goalkeeper)return null;
    const gx=ownGoalX(g,f),distGoal=Math.abs(c.x-gx),nearestDef=fielders(g.team).reduce((m,p)=>Math.min(m,e.dist(p,c)),999);
    const central=c.y>f.goalTop-42&&c.y<f.goalBottom+42;
    if(distGoal<f.w*.20&&central&&nearestDef>46)return{carrier:c,distGoal,nearestDef};return null
  }
  function looseBallClaim(g,f){
    if(e.ball.owner||speed()>145)return null;const gx=ownGoalX(g,f),dx=Math.abs(e.ball.x-gx),inArea=dx<f.w*.17&&e.ball.y>f.goalTop-70&&e.ball.y<f.goalBottom+70;if(!inArea)return null;
    const gd=e.footDist(g),enemy=fielders(other(g.team)).reduce((m,p)=>Math.min(m,e.footDist(p)),999);
    if(gd<enemy*.92&&gd<96)return{gd,enemy};return null
  }
  function parry(g,f,impactY,shotSpeed){
    const side=impactY<(f.goalTop+f.goalBottom)/2?-1:1,a=attackDir(g.team),quality=clamp((g.skill.defend-.72)*1.7+(g.skill.composure-.55)*.55,0,.85);
    e.ball.owner=null;e.ball.type='goalkeeper-parry';e.ball.lastTouch=g;e.ball.intended=null;e.ball.pickupLock=now()+240;
    e.ball.x=e.foot(g).x;e.ball.y=e.foot(g).y;e.ball.vx=a*(70+shotSpeed*.16)*(1-quality*.22);e.ball.vy=side*(80+shotSpeed*.18)*(1-quality*.18);e.ball.curve=0;
    gs(g).mode='PARRY';gs(g).lastSaveAt=now();e.game.dataset.lastGoalkeeperAction='PARRY';
  }
  function catchBall(g,reason='goalkeeper-catch'){
    old.takePossession(g,reason);const s=gs(g);s.mode='HOLD';s.lastSaveAt=now();s.claimUntil=now()+520;e.game.dataset.lastGoalkeeperAction='CATCH';
  }
  function chooseDistribution(g,f){
    const mates=fielders(g.team),opps=fielders(other(g.team));let best=null,score=-1e9;for(const m of mates){const dist=e.dist(g,m),space=opps.length?Math.min(...opps.map(o=>e.dist(m,o))):100,forward=(m.x-g.x)*attackDir(g.team),risk=dist>f.w*.45?22:0;const s=space*.72+forward*.16-dist*.04-risk+(m.personality==='creator'?12:0);if(s>score){score=s;best=m}}
    return best
  }
  function distribute(g,f){
    const s=gs(g),t=chooseDistribution(g,f);if(!t)return false;const pressure=fielders(other(g.team)).reduce((m,p)=>Math.min(m,e.dist(g,p)),999),long=pressure<82||e.dist(g,t)>f.w*.34;
    if(long){const start=e.foot(g),a=attackDir(g.team),lead=34*a,dx=t.x+lead-start.x,dy=t.y+27-start.y,d=Math.hypot(dx,dy)||1;e.ball.owner=null;e.ball.type='goalkeeper-distribution';e.ball.intended=t;e.ball.lastTouch=g;e.ball.pickupLock=now()+160;e.ball.x=start.x+a*8;e.ball.y=start.y;e.ball.vx=dx/d*250;e.ball.vy=dy/d*250;e.ball.curve=0;e.actionLock=now()+500;e.game.dataset.lastGoalkeeperAction='LONG_DISTRIBUTION'}else{old.pass(g,t);e.game.dataset.lastGoalkeeperAction='SHORT_DISTRIBUTION'}
    s.mode='DISTRIBUTE';s.distribution={to:t,at:now(),long};return true
  }
  e.updateGoalkeepers=(dt,f)=>{
    const n=now(),ballSpeed=speed();
    for(const g of e.goalkeepers){
      if(g.sentOff)continue;const s=gs(g);
      if(e.ball.owner===g){e.syncOwnedBall();s.mode='HOLD';if(n>=g.nextThink&&n>=s.claimUntil){if(distribute(g,f))g.nextThink=n+700;else g.nextThink=n+320}continue}
      const shot=shotIntersection(g,f),duel=oneVsOne(g,f),claim=looseBallClaim(g,f),basePos=anglePosition(g,f);
      let tx=basePos.x,ty=basePos.y,moveMul=.82;
      if(shot&&shot.inMouth){s.mode='SHOT_RESPONSE';const reaction=.10+(1-g.skill.defend)*.12,predY=shot.y+e.ball.vy*reaction*.12;ty=clamp(predY-27,f.goalTop+2,f.goalBottom-34);moveMul=1.38+g.skill.defend*.28;tx=g.team==='blue'?f.left+42:f.right-42}
      else if(duel){s.mode='ONE_V_ONE';const c=duel.carrier,step=clamp(duel.distGoal*.28,24,58);tx=g.team==='blue'?f.left+step:f.right-step;ty=clamp(c.y-27,f.goalTop-18,f.goalBottom-14);moveMul=1.28}
      else if(claim){s.mode='CLAIM';tx=e.ball.x;ty=e.ball.y-27;moveMul=1.34}
      else s.mode='SET';
      e.moveToward(g,tx,ty,g.speed*moveMul,dt);
      g.x=clamp(g.x,g.team==='blue'?f.left+16:f.right-f.w*.19,g.team==='blue'?f.left+f.w*.19:f.right-16);g.y=clamp(g.y,f.top+12,f.bottom-42);
      const fd=e.footDist(g),towardShot=shot&&shot.inMouth;
      if(!e.ball.owner&&n>=e.ball.pickupLock){
        if(towardShot&&fd<=18){const catchChance=clamp(.34+g.skill.defend*.34+g.skill.composure*.18-ballSpeed/900,.16,.86);if(Math.random()<catchChance)catchBall(g,'goalkeeper-catch');else parry(g,f,shot.y,ballSpeed);continue}
        if((claim||duel)&&fd<=16){const enemy=fielders(other(g.team)).reduce((m,p)=>Math.min(m,e.footDist(p)),999),secure=clamp(.60+g.skill.defend*.26+(enemy>24?.08:-.10),.38,.92);if(Math.random()<secure)catchBall(g,'goalkeeper-claim');else parry(g,f,e.ball.y,Math.max(80,ballSpeed));continue}
        if(ballSpeed<95&&fd<=14)catchBall(g,'goalkeeper-recovery')
      }
      g.aiGoalkeeperMode=s.mode;
    }
  };
  window.FutLiveGoalkeeperAI={version:VERSION,state,shotIntersection,oneVsOne,looseBallClaim,debug:g=>({...(gs(g)),mode:g?.aiGoalkeeperMode||gs(g).mode})};
}
boot();
})();