(()=>{'use strict';
const STATES=Object.freeze({FOLLOWING:'FOLLOWING',WHISTLE:'WHISTLE',APPROACHING:'APPROACHING',WARNING:'WARNING',YELLOW_CARD:'YELLOW_CARD',RED_CARD:'RED_CARD',RESTARTING:'RESTARTING'});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine,stage=document.getElementById('fieldStage'),pauseBtn=document.getElementById('pauseBtn'),game=document.getElementById('game');
  if(!e||!stage||!pauseBtn||!game||!e.players?.length||!window.FutLiveRefereeSprite){setTimeout(boot,45);return}if(window.FutLiveReferee)return;
  const el=document.createElement('div');el.className='referee-agent';stage.appendChild(el);const sprite=new window.FutLiveRefereeSprite(el);
  const notice=document.createElement('div');notice.className='referee-notice';document.body.appendChild(notice);
  const style=document.createElement('style');style.textContent=`.referee-notice{position:fixed;z-index:110;left:50%;top:29%;transform:translate(-50%,-50%) scale(.85);opacity:0;pointer-events:none;padding:9px 15px;border-radius:999px;background:#071019e8;border:1px solid #ffffff2d;color:#fff;font-size:12px;font-weight:1000;letter-spacing:.08em;transition:.16s}.referee-notice.show{opacity:1;transform:translate(-50%,-50%) scale(1)}.player.has-yellow-card .player-sprite-img{filter:drop-shadow(0 0 2px rgba(255,220,45,.95)) drop-shadow(0 0 4px rgba(255,210,0,.52)) drop-shadow(0 4px 5px #0008)}.player.temp-red-card{opacity:.20}.player-card-timer{position:absolute;z-index:20;left:50%;top:-11px;transform:translateX(-50%);padding:2px 4px;border-radius:5px;background:#230607e6;color:#fff;font-size:6px;line-height:1;font-weight:1000;white-space:nowrap;text-shadow:0 1px 2px #000;pointer-events:none}`;document.head.appendChild(style);
  const ref={state:STATES.FOLLOWING,x:e.field().w*.5,y:e.field().h*.62,target:null,busy:false,discipline:new Map(),STATES,sprite,ballContactAt:0,followX:null,followY:null,followSide:1,lastSideChange:0};
  function setState(s){ref.state=s;el.dataset.state=s;if(s===STATES.YELLOW_CARD)sprite.playCard('yellow');else if(s===STATES.RED_CARD)sprite.playCard('red')}
  function record(p){let r=ref.discipline.get(p);if(!r){r={yellowCards:0,redCard:false,fouls:0,suspendedUntil:0};ref.discipline.set(p,r);p.yellowCards=0;p.redCard=false;p.fouls=0;p.tempSuspended=false}return r}
  e.players.forEach(record);
  const originalMove=e.moveToward.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{
    if(p?.sentOff||p?.tempSuspended||ref.busy)return 0;
    if(p&&!p.goalkeeper&&ref.state===STATES.FOLLOWING){
      const av=sprite.getAvoidanceConfig(),dx=p.x-ref.x,dy=p.y-ref.y,d=Math.hypot(dx,dy);
      if(d<av.radius&&d>.001){
        const gx=tx-p.x,gy=ty-p.y,gm=Math.hypot(gx,gy)||1,nx=gx/gm,ny=gy/gm;
        const towardRef=nx*(-dx/d)+ny*(-dy/d);
        if(towardRef>.10){const strength=Math.min(1,(av.radius-d)/Math.max(1,av.radius-av.bodyRadius));const cross=nx*dy-ny*dx,side=cross>=0?1:-1;const lateral=Math.min(av.maxLateral,av.maxLateral*strength*strength);tx+=(-ny)*side*lateral;ty+=(nx)*side*lateral}
      }
    }
    return originalMove(p,tx,ty,speed,dt)
  };
  function forcePlayersIdle(){for(const p of e.players){if(p.tempSuspended)continue;try{p.ctrl?.idle?.()}catch(_){}}}
  function yellowGlow(p,on=true){p?.el?.classList.toggle('has-yellow-card',!!on)}
  function suspendPlayer(p,ms=10000){
    if(!p)return;const r=record(p),until=performance.now()+ms;r.redCard=true;r.suspendedUntil=until;p.redCard=true;p.tempSuspended=true;p.sentOff=true;yellowGlow(p,false);p.el?.classList.add('temp-red-card');p.ctrl?.idle?.();
    if(e.ball.owner===p){e.ball.owner=null;e.ball.type='free';e.ball.vx=e.ball.vy=0}
    let badge=p.el?.querySelector('.player-card-timer');if(!badge&&p.el){badge=document.createElement('span');badge.className='player-card-timer';p.el.appendChild(badge)}
    clearInterval(p._redPenaltyTimer);clearTimeout(p._redPenaltyEnd);
    const update=()=>{const left=Math.max(0,until-performance.now());if(badge)badge.textContent=`🟥 ${Math.ceil(left/1000)}s`};update();p._redPenaltyTimer=setInterval(update,250);
    p._redPenaltyEnd=setTimeout(()=>{clearInterval(p._redPenaltyTimer);p._redPenaltyTimer=null;p.tempSuspended=false;p.sentOff=false;p.redCard=false;r.redCard=false;r.suspendedUntil=0;p.el?.classList.remove('temp-red-card');badge?.remove();p.ctrl?.idle?.();show('↩️ JOGADOR DE VOLTA',650)},ms)
  }
  function show(text,ms=900){notice.textContent=text;notice.classList.add('show');clearTimeout(ref.noticeTimer);ref.noticeTimer=setTimeout(()=>notice.classList.remove('show'),ms)}
  function decideCard(d){const p=d.offender,r=record(p);r.fouls++;p.fouls=r.fouls;let card='NONE';const rear=d.rear||false,intensity=d.intensity||0;
    if(d.classification==='DANGEROUS_FOUL'){card=(rear&&intensity>.82)||intensity>.93?'RED':(Math.random()<.78?'YELLOW':'RED')}
    else if(d.classification==='RECKLESS_FOUL'){card=Math.random()<(.58+Math.max(0,intensity-.65)*.5)?'YELLOW':'NONE'}
    else if(d.classification==='FOUL'&&r.fouls>=3&&Math.random()<.22)card='YELLOW';
    if(card==='YELLOW'){r.yellowCards++;p.yellowCards=r.yellowCards;if(r.yellowCards>=2)card='RED'}
    return card
  }
  function nearestRestart(team,x,y){return e.players.filter(p=>p.team===team&&!p.sentOff&&!p.tempSuspended&&!p.goalkeeper).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||e.players.find(p=>p.team===team&&!p.sentOff&&!p.tempSuspended)}
  function resumeFromFoul(d){setState(STATES.RESTARTING);const f=e.field();e.ball.owner=null;e.ball.x=clamp(d.x,f.left+20,f.right-20);e.ball.y=clamp(d.y,f.top+20,f.bottom-30);e.ball.vx=e.ball.vy=0;e.ball.type='free';const taker=nearestRestart(d.victim.team,e.ball.x,e.ball.y);if(taker){taker.x=clamp(e.ball.x+(taker.team==='blue'?-16:16),f.left+25,f.right-25);taker.y=clamp(e.ball.y-27,f.top+20,f.bottom-40);e.takePossession(taker,'foul-restart');window.FutLiveGroundGame?.protect(taker,480)}setTimeout(()=>{window.FutLiveMatchFlow?.setPhase('PLAYING');if(game.classList.contains('is-paused'))pauseBtn.click();ref.target=null;ref.followX=ref.x;ref.followY=ref.y;setState(STATES.FOLLOWING);ref.busy=false},560)}
  function waitUntilNear(p,maxMs=1900){return new Promise(resolve=>{const started=performance.now();const tick=()=>{const d=Math.hypot(ref.x-p.x,ref.y-p.y);if(d<27||performance.now()-started>=maxMs){resolve();return}setTimeout(tick,70)};tick()})}
  async function onFoul(ev){
    const d=ev.detail;if(!d||ref.busy||window.FutLiveMatchState?.phase!=='PLAYING')return;ref.busy=true;window.FutLiveMatchFlow?.setPhase('FOUL_STOPPAGE');if(!game.classList.contains('is-paused'))pauseBtn.click();forcePlayersIdle();e.ball.vx=e.ball.vy=0;setState(STATES.WHISTLE);show('📣 FALTA',800);
    await new Promise(r=>setTimeout(r,520));const offender=d.offender;ref.target={x:offender.x+(offender.team==='blue'?-20:20),y:offender.y+8};setState(STATES.APPROACHING);const card=decideCard(d);await waitUntilNear(offender,1900);forcePlayersIdle();
    if(card==='YELLOW'){setState(STATES.YELLOW_CARD);yellowGlow(offender,true);show('🟨 CARTÃO AMARELO',1450);await new Promise(r=>setTimeout(r,1450))}
    else if(card==='RED'){setState(STATES.RED_CARD);suspendPlayer(offender,10000);show('🟥 10s FORA',1550);await new Promise(r=>setTimeout(r,1550))}
    else{setState(STATES.WARNING);show('⚠️ FALTA',900);await new Promise(r=>setTimeout(r,900))}
    resumeFromFoul(d)
  }
  window.addEventListener('futlive:foul',onFoul);
  function ballContact(){const b=e.ball,phase=window.FutLiveMatchState?.phase;if(b.owner||b.type==='foul-dead'||!['PLAYING','KICKOFF'].includes(phase)||performance.now()-ref.ballContactAt<260)return;const speed=Math.hypot(b.vx||0,b.vy||0);if(speed<28)return;const hb=sprite.getBallHitbox(ref.x,ref.y),dx=b.x-hb.x,dy=b.y-hb.y,n=(dx*dx)/(hb.rx*hb.rx)+(dy*dy)/(hb.ry*hb.ry);if(n>1)return;const mag=Math.hypot(dx,dy)||1,nx=dx/mag,ny=dy/mag,dot=b.vx*nx+b.vy*ny;let vx=b.vx-1.45*dot*nx,vy=b.vy-1.45*dot*ny;vx=vx*.78+nx*18;vy=vy*.78+ny*18;b.vx=vx;b.vy=vy;b.x+=nx*4;b.y+=ny*4;ref.ballContactAt=performance.now();window.dispatchEvent(new CustomEvent('futlive:referee-ball-contact',{detail:{x:b.x,y:b.y,beforeSpeed:speed,afterSpeed:Math.hypot(vx,vy),ballType:b.type,referee:{x:ref.x,y:ref.y}}}))}
  function crowdAdjustedTarget(x,y,f){let ax=0,ay=0,total=0;for(const p of e.players){if(p.sentOff||p.tempSuspended)continue;const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);if(d>=42||d<.01)continue;const w=(42-d)/42;ax+=dx/d*w;ay+=dy/d*w;total+=w}if(total>0){const m=Math.hypot(ax,ay)||1,shift=Math.min(26,total*8);x+=ax/m*shift;y+=ay/m*shift}return{x:clamp(x,f.left+38,f.right-38),y:clamp(y,f.top+34,f.bottom-42)}}
  function followTarget(f,b,dt,t){const center=(f.left+f.right)/2,margin=f.w*.11;if(t-ref.lastSideChange>850){if(ref.followSide===1&&b.x>center+margin){ref.followSide=-1;ref.lastSideChange=t}else if(ref.followSide===-1&&b.x<center-margin){ref.followSide=1;ref.lastSideChange=t}}let attackDir=0;if(b.owner)attackDir=b.owner.team==='blue'?1:-1;else if(Math.abs(b.vx)>35)attackDir=Math.sign(b.vx);if(!attackDir)attackDir=b.x<center?1:-1;const behind=108,lateral=82,minBallDistance=72;let desiredX=b.x-attackDir*behind,desiredY=b.y+ref.followSide*lateral;const rawDX=desiredX-b.x,rawDY=desiredY-b.y,rawDist=Math.hypot(rawDX,rawDY)||1;if(rawDist<minBallDistance){const push=minBallDistance/rawDist;desiredX=b.x+rawDX*push;desiredY=b.y+rawDY*push}const adjusted=crowdAdjustedTarget(desiredX,desiredY,f);desiredX=adjusted.x;desiredY=adjusted.y;const adx=desiredX-b.x,ady=desiredY-b.y,ad=Math.hypot(adx,ady)||1;if(ad<minBallDistance){desiredX=clamp(b.x+adx/ad*minBallDistance,f.left+38,f.right-38);desiredY=clamp(b.y+ady/ad*minBallDistance,f.top+34,f.bottom-42)}if(ref.followX==null||ref.followY==null){ref.followX=desiredX;ref.followY=desiredY}const alpha=1-Math.exp(-Math.max(.001,dt)/.34);ref.followX+=(desiredX-ref.followX)*alpha;ref.followY+=(desiredY-ref.followY)*alpha;return{x:ref.followX,y:ref.followY}}
  let last=performance.now();function loop(t){const dt=Math.min(.04,(t-last)/1000||.016);last=t;const f=e.field();let tx,ty;if(ref.target&&ref.state!==STATES.FOLLOWING){tx=ref.target.x;ty=ref.target.y}else{const q=followTarget(f,e.ball,dt,t);tx=q.x;ty=q.y}const dx=tx-ref.x,dy=ty-ref.y,m=Math.hypot(dx,dy);let moveX=0,moveY=0,speed=0;if(m>2){const maxSpeed=ref.state===STATES.FOLLOWING?70:92,step=Math.min(m,maxSpeed*dt),ux=dx/m,uy=dy/m;moveX=ux*step;moveY=uy*step;ref.x+=moveX;ref.y+=moveY;speed=dt>0?step/dt:0}el.style.left=ref.x+'px';el.style.top=ref.y+'px';sprite.updateMotion(moveX,moveY,speed,t);ballContact();requestAnimationFrame(loop)}requestAnimationFrame(loop);
  ref.moveNearCenter=()=>{const f=e.field();ref.target={x:f.w*.5,y:f.h*.58};setState(STATES.APPROACHING)};ref.releaseFollow=()=>{ref.target=null;ref.followX=ref.x;ref.followY=ref.y;setState(STATES.FOLLOWING)};ref.getRecord=p=>record(p);window.FutLiveReferee=ref;
}
boot();
})();