(()=>{'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIR={right:[1,0],left:[-1,0],up:[0,-1],down:[0,1]};
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,50);return}if(e.__tackleV041)return;e.__tackleV041=true;
  const cooldown=new Map(),active=new Map(),vulnerable=new Map();
  const originalMove=e.moveToward.bind(e),originalOwned=e.ownedAI.bind(e),originalFree=e.freeAI.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{const t=performance.now();if(p?.sentOff)return 0;if(active.has(p))return Math.hypot(tx-p.x,ty-p.y);if((vulnerable.get(p)||0)>t)speed*=.44;return originalMove(p,tx,ty,speed,dt)};
  const vec=p=>DIR[p.facing]||DIR[p.lastDir]||[p.team==='blue'?1:-1,0];
  function dotTo(p,target){const f=vec(p),dx=target.x-p.x,dy=target.y-p.y,m=Math.hypot(dx,dy)||1;return(f[0]*dx+f[1]*dy)/m}
  function carrierRear(p,c){const f=vec(c),dx=p.x-c.x,dy=p.y-c.y,m=Math.hypot(dx,dy)||1;return(f[0]*dx+f[1]*dy)/m<-.35}
  function emotionRisk(p){const s=p.emotionState||'calm';return s==='angry'?.10:s==='frustrated'?.07:s==='motivated'?.035:s==='cocky'?.055:s==='focused'?-.06:s==='demotivated'?-.08:0}
  function canAttempt(p,c,dt){
    if(window.FutLiveMatchState?.phase!=='PLAYING'||p.goalkeeper||p.sentOff||p===c||p.team===c.team||active.has(p))return false;const now=performance.now();if((cooldown.get(p)||0)>now||(vulnerable.get(p)||0)>now)return false;
    const d=e.dist(p,c),foot=e.footDist(p),angle=dotTo(p,c),rear=carrierRear(p,c),press=window.FutLiveGroundGame?.pressureFor(c)?.filter(x=>x!==p).length||0;
    if(d<27||d>58)return false;if(foot>54)return false;if(angle<.46)return false;
    const defend=p.skill.defend||.5,comp=p.skill.composure||.5,speed=clamp((p.speed-48)/42,0,1),ownerSpeed=clamp((c.speed-48)/45,0,1),geometry=clamp((58-d)/31,0,1),riskOfMiss=rear*.14+Math.max(0,ownerSpeed-speed)*.18+(press>0?.06:0);
    const opportunity=.025+defend*.055+comp*.028+speed*.025+geometry*.045+emotionRisk(p)-riskOfMiss;
    return Math.random()<clamp(opportunity,0,.14)*dt
  }
  function start(p,c){const dx=c.x-p.x,dy=c.y-p.y,m=Math.hypot(dx,dy)||1,now=performance.now();p.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');active.set(p,{owner:c,nx:dx/m,ny:dy/m,start:now,end:now+390,contact:false,outcome:null,startBallDist:e.footDist(p)});cooldown.set(p,now+5200+Math.random()*1900);p.ctrl.slide();p.lastDir='slide'}
  function finish(p,penalty){active.delete(p);vulnerable.set(p,performance.now()+penalty);if(penalty>700)p.ctrl.idle()}
  function classify(p,c,s){const ballDist=e.footDist(p),body=e.dist(p,c),rear=carrierRear(p,c),angle=dotTo(p,c),relSpeed=clamp((p.speed+(c.speed||55))/150,0,1),ballFirst=ballDist<=15&&ballDist<=body*.72,intensity=clamp(.44+relSpeed*.34+(rear?.18:0)+(angle<.58?.08:0),0,1);
    let classification='CLEAN_TACKLE';if(!ballFirst){classification='FOUL';if(rear||intensity>.77)classification='RECKLESS_FOUL';if((rear&&intensity>.84)||intensity>.93||ballDist>26)classification='DANGEROUS_FOUL'}else if(rear&&intensity>.88)classification='RECKLESS_FOUL';
    return{classification,ballFirst,rear,intensity,ballDist,body,angle}}
  function updateSlides(dt){const now=performance.now();for(const [p,s] of [...active]){
    const c=s.owner;if(!c||c.sentOff){finish(p,500);continue}p.x+=s.nx*p.speed*1.58*dt;p.y+=s.ny*p.speed*1.58*dt;
    if(!s.contact){const ballDist=e.footDist(p),body=e.dist(p,c);if(ballDist<=17||body<=p.radius+c.radius+5){s.contact=true;const info=classify(p,c,s);s.outcome=info.classification;
      if(info.classification!=='CLEAN_TACKLE'){e.ball.owner=null;e.ball.type='foul-dead';e.ball.vx=e.ball.vy=0;e.ball.x=e.foot(c).x;e.ball.y=e.foot(c).y;window.dispatchEvent(new CustomEvent('futlive:foul',{detail:{...info,offender:p,victim:c,x:e.ball.x,y:e.ball.y}}));finish(p,info.classification==='DANGEROUS_FOUL'?1450:info.classification==='RECKLESS_FOUL'?1320:1180);continue}
      const defend=p.skill.defend||.5,comp=p.skill.composure||.5,control=c.skill.control||.5,reach=clamp(1-info.ballDist/20,0,1),success=clamp(.25+defend*.34+comp*.14+info.angle*.13+reach*.18-control*.18,.18,.86);
      if(Math.random()<success){e.knockLoose(c,p);if(!e.ball.owner){e.ball.vx=s.nx*(48+p.speed*.42);e.ball.vy=s.ny*(48+p.speed*.42);e.ball.type='slide-loose';e.ball.pickupLock=now+170}finish(p,430)}else finish(p,1250);continue}}
    if(now>=s.end)finish(p,1380)
  }}
  e.ownedAI=(dt,f)=>{if(window.FutLiveMatchState?.phase!=='PLAYING')return;const c=e.ball.owner;if(c&&!c.goalkeeper&&!c.sentOff){for(const p of e.opponents(c.team))if(canAttempt(p,c,dt)){start(p,c);break}}originalOwned(dt,f);updateSlides(dt)};
  e.freeAI=(dt,f)=>{if(window.FutLiveMatchState?.phase!=='PLAYING')return;originalFree(dt,f);updateSlides(dt)};
  window.FutLiveTackleSystem={cooldown,active,vulnerable,try:(id)=>{const p=e.players.find(x=>x.el.id===id),c=e.ball.owner;if(p&&c&&p.team!==c.team&&!p.sentOff){start(p,c);return true}return false}};
}
boot();
})();