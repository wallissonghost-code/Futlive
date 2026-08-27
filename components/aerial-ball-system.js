(()=>{'use strict';
const VERSION='0.61.4',G=215;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now=()=>performance.now();
function boot(){
  const e=window.FutLiveFootballEngine,ballNode=document.querySelector('.ball');
  if(!e||!e.ball||!e.players?.length||!ballNode){setTimeout(boot,45);return}
  if(e.__aerialBallV0614)return;e.__aerialBallV0614=true;
  const old={physics:e.physics.bind(e),shoot:e.shoot.bind(e),pass:e.pass.bind(e),takePossession:e.takePossession.bind(e),resetBall:e.resetBall.bind(e),syncOwnedBall:e.syncOwnedBall.bind(e),updateGoalkeepers:e.updateGoalkeepers.bind(e),intercept:e.intercept.bind(e)};
  const state={lastType:null,bounces:0,lastLaunchAt:0};
  const ensure=()=>{if(!Number.isFinite(e.ball.z))e.ball.z=0;if(!Number.isFinite(e.ball.vz))e.ball.vz=0};
  const airborne=()=>{ensure();return e.ball.z>2||Math.abs(e.ball.vz)>8};
  const ownPenalty=(g,f=e.field())=>{const depth=f.w*.19,center=(f.goalTop+f.goalBottom)/2,half=Math.max((f.goalBottom-f.goalTop)*1.34,f.h*.235),inX=g.team==='blue'?e.ball.x>=f.left-2&&e.ball.x<=f.left+depth:e.ball.x<=f.right+2&&e.ball.x>=f.right-depth;return inX&&e.ball.y>=center-half&&e.ball.y<=center+half};
  const deliberateBackpass=(g)=>{const lt=e.ball.lastTouch;if(!lt||lt===g||lt.team!==g.team||lt.goalkeeper)return false;return ['pass','through-pass','one-touch-pass','low-cross','aerial-cross','cross-pass'].includes(e.ball.type)};
  function launch(vz=120,z=2){ensure();e.ball.z=Math.max(e.ball.z,z);e.ball.vz=vz;state.bounces=0;state.lastLaunchAt=now()}
  function detectLaunchType(){ensure();const type=e.ball.type||'';if(type===state.lastType)return;state.lastType=type;if(e.ball.owner||airborne())return;if(type==='aerial-cross')launch(138,2);else if(type==='cross-pass')launch(116,2);else if(type==='goalkeeper-distribution')launch(128,2)}
  function setHandState(g,on){g.aiHoldingHands=!!on;g.aiHandCatchUntil=on?now()+2600:0;if(on){e.ball.z=18;e.ball.vz=0;e.game.dataset.lastGoalkeeperAction='HAND_CATCH'}else if(e.ball.owner===g){e.ball.z=0;e.ball.vz=0}}

  e.resetBall=()=>{const r=old.resetBall();ensure();e.ball.z=0;e.ball.vz=0;state.bounces=0;state.lastType=e.ball.type;for(const g of e.goalkeepers||[])setHandState(g,false);return r};
  e.takePossession=(p,reason='control')=>{ensure();if(p&&!p.goalkeeper&&e.ball.z>13)return false;if(p?.goalkeeper){const handReason=/goalkeeper-(catch|claim|save|recovery)/.test(reason),canHands=handReason&&ownPenalty(p)&&!deliberateBackpass(p)&&e.ball.z<=48,r=old.takePossession(p,reason);setHandState(p,canHands);return r}const r=old.takePossession(p,reason);e.ball.z=0;e.ball.vz=0;return r};
  e.intercept=(dt)=>{ensure();if(e.ball.z>13)return;return old.intercept(dt)};
  e.syncOwnedBall=()=>{const p=e.ball.owner;if(p?.goalkeeper&&p.aiHoldingHands){const a=p.team==='blue'?1:-1;e.ball.x=p.x+a*7;e.ball.y=p.y+15;e.ball.z=18;e.ball.vz=0;return}old.syncOwnedBall();ensure();if(p){e.ball.z=0;e.ball.vz=0}};
  e.shoot=(c,f)=>{const goalDist=Math.abs((c.team==='blue'?f.right:f.left)-c.x),r=old.shoot(c,f);ensure();const long=goalDist>f.w*.24,chance=long?.58:.34;if(Math.random()<chance){const strength=e.ball.type?.includes('strong')?1.15:e.ball.type?.includes('weak')?.82:1;launch((long?142:112)*strength,2);e.ball.type+='-air';state.lastType=e.ball.type}return r};
  e.pass=(c,t)=>old.pass(c,t);
  e.updateGoalkeepers=(dt,f)=>{const r=old.updateGoalkeepers(dt,f);ensure();for(const g of e.goalkeepers||[]){const gs=window.FutLiveGoalkeeperAI?.state?.get?.(g),caughtByLegacy=e.ball.owner===g&&gs?.mode==='HOLD';if(caughtByLegacy&&!g.aiHoldingHands&&ownPenalty(g,f)&&!deliberateBackpass(g)&&e.ball.z<=48)setHandState(g,true);if(e.ball.owner===g&&g.aiHoldingHands){if(!ownPenalty(g,f)||deliberateBackpass(g))setHandState(g,false);else if(now()>g.aiHandCatchUntil){setHandState(g,false);g.nextThink=Math.min(g.nextThink||now(),now())}}else if(e.ball.owner!==g&&g.aiHoldingHands)setHandState(g,false)}detectLaunchType();return r};
  e.physics=(dt,f)=>{ensure();detectLaunchType();const hadAir=airborne(),r=old.physics(dt,f);ensure();if(e.ball.owner)return r;if(hadAir||airborne()){e.ball.z+=e.ball.vz*dt;e.ball.vz-=G*dt;if(e.ball.z<=0){e.ball.z=0;if(Math.abs(e.ball.vz)>58&&state.bounces<2){e.ball.vz=Math.abs(e.ball.vz)*.27;state.bounces++;e.ball.vx*=.88;e.ball.vy*=.88}else{e.ball.vz=0;state.bounces=0}}}return r};

  let shadow=ballNode.querySelector('.ball-air-shadow'),trail=ballNode.querySelector('.ball-air-trail');if(!shadow){shadow=document.createElement('span');shadow.className='ball-air-shadow';ballNode.prepend(shadow)}if(!trail){trail=document.createElement('span');trail.className='ball-air-trail';ballNode.prepend(trail)}const img=()=>ballNode.querySelector('.ball-sprite-img');
  Object.assign(shadow.style,{position:'absolute',left:'50%',bottom:'1px',width:'11px',height:'5px',borderRadius:'50%',background:'#000',pointerEvents:'none',transform:'translateX(-50%)',transformOrigin:'center',zIndex:'-1',opacity:'0'});Object.assign(trail.style,{position:'absolute',left:'50%',bottom:'8px',height:'1.5px',width:'0px',borderRadius:'999px',background:'linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.52))',pointerEvents:'none',transformOrigin:'100% 50%',zIndex:'-1',opacity:'0'});
  function visual(){ensure();const im=img(),z=Math.max(0,e.ball.z),spd=Math.hypot(e.ball.vx||0,e.ball.vy||0),air=z>2;if(im){im.style.transform=`translateX(-50%) translateY(${-Math.min(z,62)}px)`;im.style.filter=air?'drop-shadow(0 1px 2px #0005)':'drop-shadow(0 2px 3px #0008)'}if(air){const scale=clamp(1-z/120,.48,1);shadow.style.opacity=String(clamp(.38-z/180,.12,.36));shadow.style.transform=`translateX(-50%) scale(${scale})`;const angle=Math.atan2(e.ball.vy||0,e.ball.vx||0)*180/Math.PI+180,len=clamp(spd*.10,10,34);trail.style.width=len+'px';trail.style.opacity=String(clamp((z/30)*(spd/210),.10,.45));trail.style.transform=`translate(-100%,0) rotate(${angle}deg)`}else{shadow.style.opacity='0';trail.style.opacity='0';trail.style.width='0px'}requestAnimationFrame(visual)}
  requestAnimationFrame(visual);window.FutLiveAerialBall={version:VERSION,launch,airborne,ownPenalty,deliberateBackpass,state,debug:()=>({z:e.ball.z,vz:e.ball.vz,airborne:airborne(),type:e.ball.type})};
}
boot();
})();