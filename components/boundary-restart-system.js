(()=>{'use strict';
const VERSION='0.3.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
 const e=window.FutLiveFootballEngine,sp=window.FutLiveSetPieces,game=document.getElementById('game');
 if(!e||!sp?.state||!game||!e.players?.length){setTimeout(boot,60);return}
 if(window.FutLiveBoundaryRestarts)return;
 const state=sp.state;
 const alive=p=>p&&!p.sentOff&&!p.tempSuspended;
 const fielders=t=>e.players.filter(p=>alive(p)&&!p.goalkeeper&&(!t||p.team===t));
 const goalkeepers=t=>e.players.filter(p=>alive(p)&&p.goalkeeper&&(!t||p.team===t));
 const other=t=>t==='blue'?'red':'blue',attack=t=>t==='blue'?1:-1,pid=p=>p?.el?.id||null;
 const pause=()=>window.FutLiveApp?.setPaused?.(true);
 const resume=()=>{window.FutLiveMatchFlow?.setPhase?.('PLAYING');window.FutLiveApp?.setPaused?.(false);window.FutLiveReferee?.releaseFollow?.()};
 const emit=(type,detail)=>window.dispatchEvent(new CustomEvent(type,{detail}));
 let watchdog=null,positionRaf=null;
 if(!document.getElementById('futlive-throwin-style')){const st=document.createElement('style');st.id='futlive-throwin-style';st.textContent='.player.throw-in-hands{z-index:40!important}.player.throw-in-hands.throw-top{transform:translateY(-22px)!important}.player.throw-in-hands.throw-bottom{transform:translateY(22px)!important}.player.throw-in-hands .player-sprite-img{filter:drop-shadow(0 3px 4px #0008)!important}';document.head.appendChild(st)}
 function stop(p){p.aiVelocity={x:0,y:0};p.lastDir='idle';p.ctrl?.idle?.()}
 function clearThrowVisual(p){p?.el?.classList.remove('throw-in-hands','throw-top','throw-bottom')}
 function cleanup(){if(positionRaf){cancelAnimationFrame(positionRaf);positionRaf=null}if(watchdog){clearTimeout(watchdog);watchdog=null}for(const p of e.players)clearThrowVisual(p)}
 function forceResume(reason='watchdog'){
   cleanup();state.busy=false;state.exclusive=false;state.stage=null;state.lastRestartAt=performance.now();
   e.ball.owner=null;if(e.ball.type==='throw-in-held'||e.ball.type==='set-piece-dead'){e.ball.type='free';e.ball.vx=e.ball.vy=0;e.ball.z=0;e.ball.vz=0;e.ball.pickupLock=performance.now()+180}
   resume();emit('futlive:restart-recovered',{reason,type:state.type,team:state.team,spot:state.spot});e.paint?.();
 }
 function armWatchdog(ms=7200){if(watchdog)clearTimeout(watchdog);watchdog=setTimeout(()=>{if(state.busy&&state.exclusive)forceResume('boundary-timeout')},ms)}
 function beginState(type,team,taker,spot,stage){cleanup();state.busy=true;state.exclusive=true;state.type=type;state.team=team;state.taker=taker;state.spot=spot;state.stage=stage;pause();window.FutLiveMatchFlow?.setPhase?.('SET_PIECE');armWatchdog()}
 function finish(delay=260){setTimeout(()=>{if(!state.busy)return;cleanup();state.busy=false;state.exclusive=false;state.stage=null;state.lastRestartAt=performance.now();resume();emit('futlive:restart',{type:state.type,team:state.team,spot:state.spot})},delay)}
 function chooseTaker(team,spot,kind){return fielders(team).slice().sort((a,b)=>{const da=e.dist(a,spot),db=e.dist(b,spot);let sa=-da*.09+(a.skill?.pass||.6)*18+(a.skill?.composure||.6)*6,sb=-db*.09+(b.skill?.pass||.6)*18+(b.skill?.composure||.6)*6;if(kind==='CORNER'){sa+=(a.skill?.curve||.5)*14;sb+=(b.skill?.curve||.5)*14}return sb-sa})[0]||null}
 function position(map,ballSpot,onReady,{heldBy=null,timeout=3600}={}){
   const started=performance.now();let last=started,stable=0,done=false;
   const complete=(timedOut,max)=>{if(done)return;done=true;positionRaf=null;for(const [p] of map)stop(p);state.stage=timedOut?'POSITIONED_TIMEOUT':'POSITIONED';emit('futlive:boundary-positioned',{type:state.type,team:state.team,timedOut,residual:Number((max||0).toFixed(1))});onReady()};
   function frame(t){if(done||!state.busy||!state.exclusive)return;const dt=Math.min(.04,(t-last)/1000||.016);last=t;let max=0;
     for(const [p,q] of map){const d=Math.hypot(q.x-p.x,q.y-p.y);max=Math.max(max,d);if(d>2)e.moveToward(p,q.x,q.y,p.speed*(p.goalkeeper?.82:.96),dt);else stop(p)}
     e.ball.owner=null;e.ball.vx=e.ball.vy=0;e.ball.curve=0;e.ball.intended=null;e.ball.type=heldBy?'throw-in-held':'set-piece-dead';
     if(heldBy){e.ball.lastTouch=heldBy;e.ball.x=ballSpot.x;e.ball.y=ballSpot.y;e.ball.z=24;e.ball.vz=0}else{e.ball.x=ballSpot.x;e.ball.y=ballSpot.y;e.ball.z=0;e.ball.vz=0}
     e.paint?.();stable=max<7?stable+1:0;if(stable>5)return complete(false,max);if(t-started>=timeout)return complete(true,max);positionRaf=requestAnimationFrame(frame)
   }positionRaf=requestAnimationFrame(frame)
 }
 function kickFrom(taker,target,type,speed=220,curve=0){const s=e.foot(taker),dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;e.ball.owner=null;e.ball.type=type;e.ball.lastTouch=taker;e.ball.intended=null;e.ball.x=s.x;e.ball.y=s.y;e.ball.z=0;e.ball.vz=0;e.ball.vx=dx/d*speed;e.ball.vy=dy/d*speed;e.ball.curve=curve;e.ball.pickupLock=performance.now()+150;taker.ctrl?.kick?.();game.dataset.lastSetPiece=state.type;game.dataset.lastAction=type}
 function throwFrom(taker,target,side){
   const sx=state.spot.x,sy=state.spot.y,tx=target.x,ty=target.y+27,dx=tx-sx,dy=ty-sy,d=Math.hypot(dx,dy)||1,skill=taker.skill?.pass||.65;
   const err=(1-(.84+skill*.12))*9,ex=(Math.random()-.5)*err,ey=(Math.random()-.5)*err,dd=Math.hypot(dx+ex,dy+ey)||1,speed=158+Math.min(34,d*.11);
   e.ball.owner=null;e.ball.type='throw-in-hand-air';e.ball.lastTouch=taker;e.ball.intended=target;e.ball.x=sx;e.ball.y=sy;e.ball.z=25;e.ball.vz=145;e.ball.vx=(dx+ex)/dd*speed;e.ball.vy=(dy+ey)/dd*speed;e.ball.curve=0;e.ball.pickupLock=performance.now()+260;
   window.FutLiveAerialBall?.launch?.(145,25);clearThrowVisual(taker);game.dataset.lastSetPiece='THROW_IN';game.dataset.lastAction='throw-in-hand-air';
   emit('futlive:throwin-release',{team:taker.team,taker:pid(taker),target:pid(target),side,x:state.spot.x,y:state.spot.y,z:e.ball.z,vz:e.ball.vz})
 }
 function beginThrowIn(d){
   const f=e.field(),team=d.team,side=d.side==='top'?'top':'bottom',spot={x:clamp(d.x,f.left+2,f.right-2),y:side==='top'?f.top:f.bottom},taker=chooseTaker(team,spot,'THROW_IN');if(!taker)return false;
   beginState('THROW_IN',team,taker,spot,'APPROACH_TOUCHLINE');
   const map=new Map(),logicalY=side==='top'?f.top+13:f.bottom-40;map.set(taker,{x:spot.x,y:logicalY});
   const mates=fielders(team).filter(p=>p!==taker),a=attack(team);
   mates.forEach((p,i)=>map.set(p,{x:clamp(spot.x+a*(54+(i%3)*38),f.left+34,f.right-34),y:clamp(side==='top'?f.top+70+i*26:f.bottom-98-i*22,f.top+38,f.bottom-48)}));
   fielders(other(team)).forEach((p,i)=>map.set(p,{x:clamp(spot.x-a*(22+(i%3)*28),f.left+36,f.right-36),y:clamp((mates[i%Math.max(1,mates.length)]?.y??f.h*.5)+(i%2?25:-25),f.top+38,f.bottom-48)}));
   goalkeepers().forEach(g=>map.set(g,{x:g.team==='blue'?f.left+42:f.right-42,y:(f.goalTop+f.goalBottom)/2-27}));
   position(map,spot,()=>{if(!state.busy)return;state.stage='HANDS_OVER_HEAD';taker.el?.classList.add('throw-in-hands',side==='top'?'throw-top':'throw-bottom');taker.facing=side==='top'?'down':'up';taker.ctrl?.stop?.(false);taker.ctrl?.setState?.(taker.facing,{restart:false});taker.ctrl?.show?.(0);e.ball.type='throw-in-held';e.ball.lastTouch=taker;e.ball.x=spot.x;e.ball.y=spot.y;e.ball.z=25;e.ball.vz=0;e.paint?.();emit('futlive:throwin-ready',{team,taker:pid(taker),x:spot.x,y:spot.y,side,ballZ:e.ball.z});
     setTimeout(()=>{if(!state.busy||state.type!=='THROW_IN')return;const opp=fielders(other(team)),target=mates.slice().sort((a,b)=>{const ao=opp.reduce((m,o)=>Math.min(m,e.dist(a,o)),999),bo=opp.reduce((m,o)=>Math.min(m,e.dist(b,o)),999);return bo-ao})[0]||mates[0];if(!target)return forceResume('throw-no-target');throwFrom(taker,target,side);finish(480)},680)
   },{heldBy:taker,timeout:3200});return true
 }
 function beginCorner(d){const f=e.field(),team=d.team,end=d.side==='left'?'left':'right',vertical=d.y<=(f.top+f.bottom)/2?'top':'bottom',spot={x:end==='left'?f.left:f.right,y:vertical==='top'?f.top:f.bottom},taker=chooseTaker(team,spot,'CORNER');if(!taker)return false;beginState('CORNER',team,taker,spot,'EXACT_CORNER');const map=new Map(),inX=end==='left'?1:-1,inY=vertical==='top'?1:-1,goalY=(f.goalTop+f.goalBottom)/2;map.set(taker,{x:spot.x+inX*18,y:spot.y+inY*22});const mates=fielders(team).filter(p=>p!==taker),defs=fielders(other(team));mates.forEach((p,i)=>map.set(p,{x:clamp(spot.x+inX*(58+i*13),f.left+30,f.right-30),y:clamp(goalY+(i%2?30:-30)-27,f.top+30,f.bottom-42)}));defs.forEach((p,i)=>map.set(p,{x:clamp(spot.x+inX*(42+i*10),f.left+30,f.right-30),y:clamp(goalY+(i%2?24:-24)-27,f.top+30,f.bottom-42)}));goalkeepers().forEach(g=>map.set(g,{x:g.team==='blue'?f.left+42:f.right-42,y:goalY-27}));position(map,spot,()=>{if(!state.busy)return;const target={x:spot.x+inX*(82+Math.random()*34),y:goalY+(Math.random()-.5)*62},curve=inY*inX*(.12+(taker.skill?.curve||.5)*.18);kickFrom(taker,target,'corner-cross',240+(taker.skill?.pass||.6)*36,curve);emit('futlive:corner-restart',{team,taker:pid(taker),end,vertical,x:spot.x,y:spot.y});finish(280)},{timeout:3400});return true}
 function beginGoalKick(d){const f=e.field(),team=d.team,g=goalkeepers(team)[0];if(!g)return false;const end=d.side==='right'?'right':'left',upper=d.y<=(f.top+f.bottom)/2,spot={x:end==='left'?f.left+58:f.right-58,y:(f.goalTop+f.goalBottom)/2+(upper?-24:24)};beginState('GOAL_KICK',team,g,spot,'GOAL_AREA');const map=new Map();map.set(g,{x:spot.x,y:spot.y-27});fielders(team).forEach(p=>map.set(p,{x:clamp(f.w*(p.home?.[0]??.5)+attack(team)*24,f.left+34,f.right-34),y:clamp(f.h*(p.home?.[1]??.5),f.top+34,f.bottom-46)}));fielders(other(team)).forEach(p=>map.set(p,{x:clamp(f.w*(p.home?.[0]??.5),f.left+34,f.right-34),y:clamp(f.h*(p.home?.[1]??.5),f.top+34,f.bottom-46)}));position(map,spot,()=>{if(!state.busy)return;const target=fielders(team).slice().sort((a,b)=>e.dist(b,g)-e.dist(a,g))[0];if(!target)return forceResume('goalkick-no-target');kickFrom(g,{x:target.x+attack(team)*28,y:target.y+27},'goal-kick',250);finish(280)},{timeout:3400});return true}
 function handle(d){if(!d||state.busy)return false;if(d.kind==='throw-in')return beginThrowIn(d);if(d.kind==='corner')return beginCorner(d);if(d.kind==='goal-kick')return beginGoalKick(d);return false}
 window.FutLiveBoundaryRestarts={version:VERSION,handle,beginThrowIn,beginCorner,beginGoalKick,forceResume,state};
}
boot();
})();