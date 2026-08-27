(()=>{'use strict';
const VERSION='0.55.1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine,tactics=window.FutLiveFootballTactics,base=window.FutLiveFootballAI;
  if(!e||!tactics||!base||!e.players?.length){setTimeout(boot,40);return}
  if(e.__playerIntelligenceV0551)return;e.__playerIntelligenceV0551=true;

  const old={choosePassTarget:e.choosePassTarget.bind(e),pass:e.pass.bind(e),takePossession:e.takePossession.bind(e),shoot:e.shoot.bind(e),ownedAI:e.ownedAI.bind(e),moveToward:e.moveToward.bind(e)};
  const memory=new Map();
  const living=p=>p&&!p.sentOff;
  const fielders=t=>e.players.filter(p=>living(p)&&!p.goalkeeper&&(!t||p.team===t));
  const attack=t=>t==='blue'?1:-1;
  const goalX=(t,f)=>t==='blue'?f.right:f.left;
  const now=()=>performance.now();
  const id=p=>p?.el?.id||`${p?.team}-${p?.slot}`;

  function profile(p){
    if(p.aiProfile)return p.aiProfile;
    const role=p.personality;
    let style=role==='wing'?'DRIBBLER':role==='creator'?'PLAYMAKER':role==='finisher'?'POACHER':role==='support'?'CONNECTOR':'BALANCED';
    p.aiProfile={style,risk:clamp(.28+(p.skill.vision-.5)*.25+(p.skill.composure-.5)*.20, .14,.70),peripheral:clamp(.55+p.skill.vision*.38,.55,.92),firstTouch:clamp(.46+p.skill.control*.46,.50,.91),oneTouch:clamp(.20+p.skill.pass*.40+p.skill.vision*.25,.22,.83),throughBall:clamp(.18+p.skill.pass*.35+p.skill.vision*.34,.22,.84),cross:clamp(.18+p.skill.pass*.42+(style==='DRIBBLER'?.14:0),.20,.86),dribble:clamp(.18+p.skill.control*.48+(style==='DRIBBLER'?.20:0),.22,.90)};
    return p.aiProfile
  }
  e.players.forEach(profile);

  function remember(p,event,data={}){
    if(!p)return;const key=id(p),m=memory.get(key)||{events:[],lastReceiver:null,lastPassAt:0,lastLossAt:0,lastPressure:0};
    m.events.push({event,at:now(),...data});if(m.events.length>8)m.events.shift();
    if(event==='PASS'){m.lastReceiver=data.to||null;m.lastPassAt=now()}
    if(event==='LOSS')m.lastLossAt=now();memory.set(key,m);return m
  }
  function recent(p,event,ms=2400){const m=memory.get(id(p));return !!m?.events?.some(x=>x.event===event&&now()-x.at<ms)}

  function facingVector(p){const d=p.facing||p.lastDir|| (p.team==='blue'?'right':'left');return d==='left'?[-1,0]:d==='up'?[0,-1]:d==='down'?[0,1]:[1,0]}
  function peripheralScore(p,q){const [fx,fy]=facingVector(p),dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,dot=(fx*dx+fy*dy)/d,prof=profile(p);return dot>=-.15?1:prof.peripheral*(dot>-.65?.74:.42)}
  function pressureAround(p,r=58){return fielders(other(p.team)).filter(o=>e.dist(p,o)<r).sort((a,b)=>e.dist(p,a)-e.dist(p,b))}
  function laneSafety(c,t){const opps=fielders(other(c.team)),dx=t.x-c.x,dy=t.y-c.y,len2=dx*dx+dy*dy||1;let min=999;for(const o of opps){const u=clamp(((o.x-c.x)*dx+(o.y-c.y)*dy)/len2,0,1),px=c.x+dx*u,py=c.y+dy*u;min=Math.min(min,Math.hypot(o.x-px,o.y-py))}return min}
  function dirTo(c,t){const dx=t.x-c.x,dy=t.y-c.y;return Math.abs(dx)>=Math.abs(dy)*1.08?(dx>=0?'right':'left'):(dy>=0?'down':'up')}
  function orientForAction(c,t){const dir=dirTo(c,t);c.facing=dir;c.lastDir=dir;if(c.aiVelocity){c.aiVelocity.x*=.35;c.aiVelocity.y*=.35}c.ctrl?.cancelPendingDirection?.();if(c.ctrl?.play)c.ctrl.play(dir,c.ctrl.fps||8,{restart:false});else c.ctrl?.move?.(dir);return dir}
  function targetDot(c,t){const [fx,fy]=facingVector(c),dx=t.x-c.x,dy=t.y-c.y,d=Math.hypot(dx,dy)||1;return(fx*dx+fy*dy)/d}

  function scoreTarget(c,p){
    const f=e.field(),a=attack(c.team),prof=profile(c),forward=(p.x-c.x)*a,dist=e.dist(c,p),space=Math.min(...fielders(other(c.team)).map(o=>e.dist(p,o)),120),lane=laneSafety(c,p),vision=peripheralScore(c,p),goalGain=Math.abs(goalX(c.team,f)-c.x)-Math.abs(goalX(c.team,f)-p.x);let score=space*.55+lane*.54+forward*.20+goalGain*.18-dist*.055+vision*24;
    if(p.personality==='finisher'&&forward>20)score+=16;if(p.personality==='creator'&&lane>30)score+=10;if(recent(c,'PASS',1400)&&memory.get(id(c))?.lastReceiver===p)score-=8;
    const risky=lane<20||space<28;if(risky)score-=22*(1-prof.risk);
    if(tactics.offside(p,c.x))score-=999;return score
  }
  e.choosePassTarget=(c)=>{if(!c)return null;const cands=fielders(c.team).filter(p=>p!==c&&!tactics.offside(p,c.x));let best=null,score=-1e9;for(const p of cands){const s=scoreTarget(c,p);if(s>score){score=s;best=p}}return score>10?best:old.choosePassTarget(c)};

  function launchPass(c,t,{kind='normal',lead=0,powerMul=1}={}){
    if(!c||!t)return false;orientForAction(c,t);const a=attack(c.team),start=e.foot(c),prof=profile(c),tx=t.x+a*lead,ty=t.y+27,dx=tx-start.x,dy=ty-start.y,d=Math.hypot(dx,dy)||1;
    const precision=clamp(c.skill.pass*.72+c.skill.vision*.28,.4,.95),err=(1-precision)*(kind==='through'?32:kind==='cross'?42:18),targetY=ty+(Math.random()-.5)*err,targetX=tx+(Math.random()-.5)*err*.55,ddx=targetX-start.x,ddy=targetY-start.y,dd=Math.hypot(ddx,ddy)||1;
    let speed=Math.min(kind==='cross'?300:kind==='through'?270:235,(145+d*.28)*powerMul);
    e.ball.owner=null;e.ball.type=kind==='through'?'through-pass':kind==='cross'?'cross-pass':kind==='one-touch'?'one-touch-pass':'pass';e.ball.intended=t;e.ball.lastTouch=c;e.ball.pickupLock=now()+(kind==='one-touch'?95:125);e.ball.x=start.x+a*7;e.ball.y=start.y;e.ball.vx=ddx/dd*speed;e.ball.vy=ddy/dd*speed;e.ball.curve=kind==='cross'?(Math.random()<.5?-1:1)*.12*prof.cross:0;e.actionLock=now()+(kind==='one-touch'?300:420);remember(c,'PASS',{to:t,kind});e.game.dataset.lastAction=e.ball.type;return true
  }
  e.pass=(c,t)=>{if(!c||!t)return;const prof=profile(c),f=e.field(),a=attack(c.team),forward=(t.x-c.x)*a,space=Math.min(...fielders(other(c.team)).map(o=>e.dist(t,o)),120),wide=c.y<f.top+f.h*.23||c.y>f.bottom-f.h*.23,advanced=Math.abs(goalX(c.team,f)-c.x)<f.w*.35;
    const through=forward>55&&space>34&&prof.throughBall>.48&&!tactics.offside(t,c.x);
    const cross=wide&&advanced&&Math.abs(t.y-c.y)>70&&prof.cross>.48;
    if(cross)return launchPass(c,t,{kind:'cross',lead:42,powerMul:1.18});if(through)return launchPass(c,t,{kind:'through',lead:44+(t.personality==='finisher'?24:0),powerMul:1.12});return old.pass(c,t)};

  e.takePossession=(p,reason='control')=>{const previous=e.ball.owner;const result=old.takePossession(p,reason);if(previous&&previous!==p)remember(previous,'LOSS',{to:p});if(p){p.receivedAt=now();p.receiveReason=reason;remember(p,'RECEIVE',{reason})}return result};

  function maybeOneTouch(c){
    if(!c||c.goalkeeper||!c.receivedAt)return false;const age=now()-c.receivedAt,prof=profile(c);if(age>360||prof.oneTouch<.43)return false;const press=pressureAround(c,54),target=e.choosePassTarget(c);if(!target)return false;
    const dot=targetDot(c,target);if(dot<-.08)return false;
    const lane=laneSafety(c,target),chance=prof.oneTouch+(press.length?.18:0)+(lane>32?.08:0);if(Math.random()<clamp(chance-.35,.10,.72)){c.receivedAt=0;orientForAction(c,target);launchPass(c,target,{kind:'one-touch',lead:target.personality==='finisher'?20:8,powerMul:1.02});return true}return false
  }

  function dribbleDirection(c){
    const f=e.field(),a=attack(c.team),opps=pressureAround(c,82);const candidates=[{x:c.x+a*44,y:c.y},{x:c.x+a*36,y:c.y-34},{x:c.x+a*36,y:c.y+34},{x:c.x-a*10,y:c.y-38},{x:c.x-a*10,y:c.y+38}];let best=candidates[0],score=-1e9;for(const q0 of candidates){const q={x:clamp(q0.x,f.left+30,f.right-30),y:clamp(q0.y,f.top+30,f.bottom-42)},space=opps.length?Math.min(...opps.map(o=>Math.hypot(q.x-o.x,q.y-o.y))):90,forward=(q.x-c.x)*a,center=-Math.abs(q.y-f.h*.5)*.025,s=space*.78+forward*.30+center;if(s>score){score=s;best=q}}return best
  }
  function influenceDribble(c,dt){
    if(!c||c.goalkeeper)return false;const prof=profile(c),press=pressureAround(c,62),intent=c.aiDribbleIntent;const can=(intent==='TAKE_ON'||(prof.dribble>.66&&press.length<=1))&&press.length<=2;if(!can)return false;const q=dribbleDirection(c),risk=press.length?1-prof.risk*.28:1;if(Math.random()<dt*(.55+prof.dribble*.65)*risk){old.moveToward(c,q.x,q.y,c.speed*(1.02+prof.dribble*.10),dt);e.syncOwnedBall();c.nextThink=Math.max(c.nextThink||0,now()+180);e.game.dataset.lastDribbleDirection=`${Math.round(q.x)},${Math.round(q.y)}`;remember(c,'DRIBBLE',{x:q.x,y:q.y});return true}return false
  }

  e.shoot=(c,f)=>{if(!c)return;const prof=profile(c),goal=goalX(c.team,f),dist=Math.abs(goal-c.x),press=pressureAround(c,44).length,central=1-clamp(Math.abs(c.y-f.h*.5)/(f.h*.45),0,1);let type='POWER';if(dist<f.w*.14&&c.skill.composure>.68)type='PLACED';else if(dist>f.w*.25&&c.skill.shoot>.78)type='LONG';else if(press>=2&&c.skill.composure>.72)type='QUICK';c.aiFinishType=type;e.game.dataset.lastFinishType=type;
    if(type==='PLACED'){const originalCurve=c.skill.curve;c.skill.curve=Math.max(c.skill.curve,.72);const r=old.shoot(c,f);c.skill.curve=originalCurve;remember(c,'SHOT',{type});return r}
    if(type==='LONG'){const originalShoot=c.skill.shoot;c.skill.shoot=Math.min(1,c.skill.shoot+.10);const r=old.shoot(c,f);c.skill.shoot=originalShoot;remember(c,'SHOT',{type});return r}
    remember(c,'SHOT',{type,central,press});return old.shoot(c,f)};

  e.ownedAI=(dt,f)=>{
    const c=e.ball.owner;if(c&&!c.goalkeeper){const m=memory.get(id(c));if(m)m.lastPressure=pressureAround(c,62).length;if(maybeOneTouch(c))return;if(influenceDribble(c,dt))return}
    return old.ownedAI(dt,f)
  };

  window.FutLivePlayerIntelligence={version:VERSION,memory,profile,remember,peripheralScore,pressureAround,debug:p=>({profile:profile(p),memory:memory.get(id(p))||null,dribbleIntent:p?.aiDribbleIntent||null,finish:p?.aiFinishType||null})};
}
boot();
})();