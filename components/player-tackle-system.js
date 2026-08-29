(()=>{'use strict';
const VERSION='0.63';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIR={right:[1,0],left:[-1,0],up:[0,-1],down:[0,1]};
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,50);return}if(e.__tackleV063)return;e.__tackleV063=true;
  const cooldown=new Map(),active=new Map(),vulnerable=new Map();
  const originalMove=e.moveToward.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{const t=performance.now();if(p?.sentOff)return 0;if(active.has(p))return Math.hypot(tx-p.x,ty-p.y);if((vulnerable.get(p)||0)>t)speed*=.44;return originalMove(p,tx,ty,speed,dt)};
  const vec=p=>{const s=active.get(p);if(s)return[s.nx,s.ny];return DIR[p.facing]||DIR[p.lastDir]||[p.team==='blue'?1:-1,0]};
  const pid=p=>p?.el?.id||null;
  function emit(type,detail){window.dispatchEvent(new CustomEvent(type,{detail}))}
  function dotTo(p,target){const f=vec(p),dx=target.x-p.x,dy=target.y-p.y,m=Math.hypot(dx,dy)||1;return(f[0]*dx+f[1]*dy)/m}
  function carrierRear(p,c){const f=vec(c),dx=p.x-c.x,dy=p.y-c.y,m=Math.hypot(dx,dy)||1;return(f[0]*dx+f[1]*dy)/m<-.35}
  function emotionRisk(p){const s=p.emotionState||'calm';return s==='angry'?.10:s==='frustrated'?.07:s==='motivated'?.035:s==='cocky'?.055:s==='focused'?-.06:s==='demotivated'?-.08:0}
  function horizontalHistory(p){
    const vx=p.aiVelocity?.x||0;if(Math.abs(vx)>2)return vx>0?'right':'left';
    const d=p.facing||p.lastDir;if(d==='right'||d==='left')return d;
    return null
  }
  function slideFrameFor(p,dx,dy){
    const ax=Math.abs(dx),ay=Math.abs(dy);
    if(ax>Math.max(5,ay*.18))return dx>=0?31:32;
    const history=horizontalHistory(p);if(history)return history==='right'?31:32;
    if(dx>0)return 31;if(dx<0)return 32;
    return p.team==='blue'?31:32
  }
  function holdSlideFrame(p,frame){
    const c=p.ctrl;if(!c)return;
    c.cancelPendingDirection?.();c.stop?.(false);c.state='slide';c.index=0;
    if(c.img&&c.src)c.img.src=c.src(frame);
    if(c.el){c.el.dataset.anim='slide';c.el.dataset.slideFrame=String(frame)}
    p.slideFrame=frame
  }
  function clearSlideFrame(p){
    if(p.ctrl?.el)delete p.ctrl.el.dataset.slideFrame;
    delete p.slideFrame
  }
  function canAttempt(p,c,dt){
    if(window.FutLiveMatchState?.phase!=='PLAYING'||!c||e.ball.owner!==c||p.goalkeeper||p.sentOff||p===c||p.team===c.team||active.has(p))return false;
    const now=performance.now();if((cooldown.get(p)||0)>now||(vulnerable.get(p)||0)>now)return false;
    const d=e.dist(p,c),foot=e.footDist(p),angle=dotTo(p,c),rear=carrierRear(p,c),press=window.FutLiveGroundGame?.pressureFor(c)?.filter(x=>x!==p).length||0;
    if(d<25||d>56||foot>52||angle<.42)return false;
    const defend=p.skill.defend||.5,comp=p.skill.composure||.5,speed=clamp((p.speed-48)/42,0,1),ownerSpeed=clamp((c.speed-48)/45,0,1),geometry=clamp((56-d)/31,0,1),riskOfMiss=(rear?.12:0)+Math.max(0,ownerSpeed-speed)*.16+(press>0?.04:0);
    const opportunity=.035+defend*.075+comp*.035+speed*.03+geometry*.055+emotionRisk(p)-riskOfMiss;
    return Math.random()<clamp(opportunity,0,.19)*dt
  }
  function start(p,c){
    if(!c||e.ball.owner!==c)return false;
    const dx=c.x-p.x,dy=c.y-p.y,m=Math.hypot(dx,dy)||1,now=performance.now(),frame=slideFrameFor(p,dx,dy);
    const physicalDir=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    p.facing=physicalDir;
    active.set(p,{owner:c,nx:dx/m,ny:dy/m,start:now,end:now+410,contact:false,outcome:null,ownerHadBall:true,frame});cooldown.set(p,now+4200+Math.random()*1800);
    holdSlideFrame(p,frame);p.lastDir=physicalDir;emit('futlive:tackle-start',{player:pid(p),team:p.team,target:pid(c),targetHadBall:true,frame,direction:physicalDir});return true
  }
  function finish(p,penalty=650){active.delete(p);clearSlideFrame(p);vulnerable.set(p,performance.now()+penalty);setTimeout(()=>{if(!active.has(p)&&!p.sentOff)p.ctrl?.idle?.()},Math.min(220,penalty));}
  function classify(p,c,s){
    const ballDist=e.footDist(p),body=e.dist(p,c),rear=carrierRear(p,c),angle=dotTo(p,c),relSpeed=clamp((p.speed+(c.speed||55))/150,0,1),late=e.ball.owner!==c;
    const ballFirst=!late&&ballDist<=15&&ballDist<=body*.72,intensity=clamp(.42+relSpeed*.34+(rear?.18:0)+(angle<.58?.08:0)+(late?.12:0),0,1);
    let classification='CLEAN_TACKLE';
    if(!ballFirst){classification='FOUL';if(late||rear||intensity>.78)classification='RECKLESS_FOUL';if((late&&intensity>.82)||(rear&&intensity>.85)||intensity>.94||ballDist>30)classification='DANGEROUS_FOUL'}
    return{classification,ballFirst,rear,late,intensity,ballDist,body,angle}
  }
  function foul(p,c,info){
    e.ball.owner=null;e.ball.type='foul-dead';e.ball.vx=e.ball.vy=0;const q=e.foot(c);e.ball.x=q.x;e.ball.y=q.y;
    emit('futlive:tackle-result',{player:pid(p),victim:pid(c),result:info.classification,ballFirst:false,late:info.late,intensity:info.intensity});
    window.dispatchEvent(new CustomEvent('futlive:foul',{detail:{...info,offender:p,victim:c,x:e.ball.x,y:e.ball.y}}));
    finish(p,info.classification==='DANGEROUS_FOUL'?1500:info.classification==='RECKLESS_FOUL'?1320:1120)
  }
  function cleanTackle(p,c,s,info){
    const defend=p.skill.defend||.5,comp=p.skill.composure||.5,control=c.skill.control||.5,reach=clamp(1-info.ballDist/20,0,1),success=clamp(.30+defend*.36+comp*.14+info.angle*.12+reach*.18-control*.16,.24,.90);
    if(Math.random()<success){e.knockLoose(c,p);if(!e.ball.owner){e.ball.vx=s.nx*(52+p.speed*.44);e.ball.vy=s.ny*(52+p.speed*.44);e.ball.type='slide-loose';e.ball.pickupLock=performance.now()+170}emit('futlive:tackle-result',{player:pid(p),victim:pid(c),result:'CLEAN_TACKLE',ballFirst:true,success:true});finish(p,520);return}
    emit('futlive:tackle-result',{player:pid(p),victim:pid(c),result:'MISSED_BALL',ballFirst:true,success:false});finish(p,1050)
  }
  function updateSlides(dt){
    const now=performance.now();for(const [p,s] of [...active]){
      const c=s.owner;if(!c||c.sentOff){finish(p,500);continue}
      holdSlideFrame(p,s.frame);p.x+=s.nx*p.speed*1.52*dt;p.y+=s.ny*p.speed*1.52*dt;
      if(!s.contact){const ballDist=e.footDist(p),body=e.dist(p,c),late=e.ball.owner!==c;
        if(ballDist<=17||body<=p.radius+c.radius+5){s.contact=true;const info=classify(p,c,s);s.outcome=info.classification;if(info.classification!=='CLEAN_TACKLE'){foul(p,c,info);continue}cleanTackle(p,c,s,info);continue}
        if(late&&body<=p.radius+c.radius+11){s.contact=true;const info=classify(p,c,s);foul(p,c,info);continue}
      }
      if(now>=s.end)finish(p,1050)
    }
  }
  let last=performance.now();function loop(t){const dt=Math.min(.04,(t-last)/1000||.016);last=t;if(window.FutLiveMatchState?.phase==='PLAYING'){
      const c=e.ball.owner;if(c&&!c.goalkeeper&&!c.sentOff){for(const p of e.opponents(c.team)){if(canAttempt(p,c,dt)){start(p,c);break}}}
      updateSlides(dt)
    }else if(active.size){for(const p of [...active.keys()])finish(p,500)}requestAnimationFrame(loop)}requestAnimationFrame(loop);
  window.FutLiveTackleSystem={version:VERSION,cooldown,active,vulnerable,slideFrameFor,try:(id)=>{const p=e.players.find(x=>x.el.id===id),c=e.ball.owner;if(p&&c&&p.team!==c.team&&!p.sentOff)return start(p,c);return false}};
}
boot();
})();