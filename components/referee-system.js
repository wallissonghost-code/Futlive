(()=>{'use strict';
const STATES=Object.freeze({FOLLOWING:'FOLLOWING',WHISTLE:'WHISTLE',APPROACHING:'APPROACHING',WARNING:'WARNING',YELLOW_CARD:'YELLOW_CARD',RED_CARD:'RED_CARD',RESTARTING:'RESTARTING'});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine,stage=document.getElementById('fieldStage'),pauseBtn=document.getElementById('pauseBtn'),game=document.getElementById('game');
  if(!e||!stage||!pauseBtn||!game||!e.players?.length||!window.FutLiveRefereeSprite){setTimeout(boot,45);return}if(window.FutLiveReferee)return;
  const el=document.createElement('div');el.className='referee-agent';stage.appendChild(el);const sprite=new window.FutLiveRefereeSprite(el);
  const notice=document.createElement('div');notice.className='referee-notice';document.body.appendChild(notice);
  const style=document.createElement('style');style.textContent=`.referee-notice{position:fixed;z-index:110;left:50%;top:29%;transform:translate(-50%,-50%) scale(.85);opacity:0;pointer-events:none;padding:9px 15px;border-radius:999px;background:#071019e8;border:1px solid #ffffff2d;color:#fff;font-size:12px;font-weight:1000;letter-spacing:.08em;transition:.16s}.referee-notice.show{opacity:1;transform:translate(-50%,-50%) scale(1)}`;document.head.appendChild(style);
  const ref={state:STATES.FOLLOWING,x:e.field().w*.5,y:e.field().h*.62,target:null,busy:false,discipline:new Map(),STATES,sprite,ballContactAt:0,followX:null,followY:null,followSide:1,lastSideChange:0};
  function setState(s){ref.state=s;el.dataset.state=s;if(s===STATES.YELLOW_CARD)sprite.playCard('yellow');else if(s===STATES.RED_CARD)sprite.playCard('red')}
  function record(p){let r=ref.discipline.get(p);if(!r){r={yellowCards:0,redCard:false,fouls:0};ref.discipline.set(p,r);p.yellowCards=0;p.redCard=false;p.fouls=0}return r}
  e.players.forEach(record);
  const originalMove=e.moveToward.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{
    if(p?.sentOff)return 0;
    if(p&&!p.goalkeeper&&ref.state===STATES.FOLLOWING){
      const av=sprite.getAvoidanceConfig(),dx=p.x-ref.x,dy=p.y-ref.y,d=Math.hypot(dx,dy);
      if(d<av.radius&&d>.001){
        const gx=tx-p.x,gy=ty-p.y,gm=Math.hypot(gx,gy)||1,nx=gx/gm,ny=gy/gm;
        const towardRef=nx*(-dx/d)+ny*(-dy/d);
        if(towardRef>.10){
          const strength=Math.min(1,(av.radius-d)/Math.max(1,av.radius-av.bodyRadius));
          const cross=nx*dy-ny*dx,side=cross>=0?1:-1;
          const lateral=Math.min(av.maxLateral,av.maxLateral*strength*strength);
          tx+=(-ny)*side*lateral;ty+=(nx)*side*lateral;
        }
      }
    }
    return originalMove(p,tx,ty,speed,dt)
  };
  function sendOff(p){const r=record(p);r.redCard=true;p.redCard=true;p.sentOff=true;p.el.style.display='none';p.x=-999;p.y=-999;p.ctrl.stop(false);if(e.ball.owner===p){e.ball.owner=null;e.ball.type='free'}}
  function show(text,ms=900){notice.textContent=text;notice.classList.add('show');clearTimeout(ref.noticeTimer);ref.noticeTimer=setTimeout(()=>notice.classList.remove('show'),ms)}
  function decideCard(d){const p=d.offender,r=record(p);r.fouls++;p.fouls=r.fouls;let card='NONE';const rear=d.rear||false,intensity=d.intensity||0;
    if(d.classification==='DANGEROUS_FOUL'){card=(rear&&intensity>.82)||intensity>.93?'RED':(Math.random()<.78?'YELLOW':'RED')}
    else if(d.classification==='RECKLESS_FOUL'){card=Math.random()<(.58+Math.max(0,intensity-.65)*.5)?'YELLOW':'NONE'}
    else if(d.classification==='FOUL'&&r.fouls>=3&&Math.random()<.22)card='YELLOW';
    if(card==='YELLOW'){r.yellowCards++;p.yellowCards=r.yellowCards;if(r.yellowCards>=2)card='RED'}
    if(card==='RED')sendOff(p);return card
  }
  function nearestRestart(team,x,y){return e.players.filter(p=>p.team===team&&!p.sentOff&&!p.goalkeeper).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||e.players.find(p=>p.team===team&&!p.sentOff)}
  function resumeFromFoul(d){setState(STATES.RESTARTING);const f=e.field();e.ball.owner=null;e.ball.x=clamp(d.x,f.left+20,f.right-20);e.ball.y=clamp(d.y,f.top+20,f.bottom-30);e.ball.vx=e.ball.vy=0;e.ball.type='free';const taker=nearestRestart(d.victim.team,e.ball.x,e.ball.y);if(taker){taker.x=clamp(e.ball.x+(taker.team==='blue'?-16:16),f.left+25,f.right-25);taker.y=clamp(e.ball.y-27,f.top+20,f.bottom-40);e.takePossession(taker,'foul-restart');window.FutLiveGroundGame?.protect(taker,480)}setTimeout(()=>{window.FutLiveMatchFlow?.setPhase('PLAYING');if(game.classList.contains('is-paused'))pauseBtn.click();setState(STATES.FOLLOWING);ref.busy=false},480)}
  function onFoul(ev){const d=ev.detail;if(!d||ref.busy||window.FutLiveMatchState?.phase!=='PLAYING')return;ref.busy=true;ref.target={x:d.x,y:d.y};window.FutLiveMatchFlow?.setPhase('FOUL_STOPPAGE');if(!game.classList.contains('is-paused'))pauseBtn.click();setState(STATES.WHISTLE);show('📣 FALTA',650);setTimeout(()=>{setState(STATES.APPROACHING);const card=decideCard(d);setTimeout(()=>{if(card==='YELLOW'){setState(STATES.YELLOW_CARD);show('🟨 CARTÃO AMARELO',1100)}else if(card==='RED'){setState(STATES.RED_CARD);show('🟥 CARTÃO VERMELHO',1300)}else{setState(STATES.WARNING);show('⚠️ FALTA',800)}setTimeout(()=>resumeFromFoul(d),card==='RED'?1250:card==='YELLOW'?1050:720)},620)},300)}
  window.addEventListener('futlive:foul',onFoul);
  function ballContact(){const b=e.ball,phase=window.FutLiveMatchState?.phase;if(b.owner||b.type==='foul-dead'||!['PLAYING','KICKOFF'].includes(phase)||performance.now()-ref.ballContactAt<260)return;const speed=Math.hypot(b.vx||0,b.vy||0);if(speed<28)return;const hb=sprite.getBallHitbox(ref.x,ref.y),dx=b.x-hb.x,dy=b.y-hb.y,n=(dx*dx)/(hb.rx*hb.rx)+(dy*dy)/(hb.ry*hb.ry);if(n>1)return;const mag=Math.hypot(dx,dy)||1,nx=dx/mag,ny=dy/mag,dot=b.vx*nx+b.vy*ny;let vx=b.vx-1.45*dot*nx,vy=b.vy-1.45*dot*ny;vx=vx*.78+nx*18;vy=vy*.78+ny*18;b.vx=vx;b.vy=vy;b.x+=nx*4;b.y+=ny*4;ref.ballContactAt=performance.now();window.dispatchEvent(new CustomEvent('futlive:referee-ball-contact',{detail:{x:b.x,y:b.y,beforeSpeed:speed,afterSpeed:Math.hypot(vx,vy),ballType:b.type,referee:{x:ref.x,y:ref.y}}}))}
  function crowdAdjustedTarget(x,y,f){
    let ax=0,ay=0,total=0;
    for(const p of e.players){if(p.sentOff)continue;const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);if(d>=42||d<.01)continue;const w=(42-d)/42;ax+=dx/d*w;ay+=dy/d*w;total+=w}
    if(total>0){const m=Math.hypot(ax,ay)||1,shift=Math.min(26,total*8);x+=ax/m*shift;y+=ay/m*shift}
    return{x:clamp(x,f.left+38,f.right-38),y:clamp(y,f.top+34,f.bottom-42)}
  }
  function followTarget(f,b,dt,t){
    const center=(f.left+f.right)/2,margin=f.w*.11;
    if(t-ref.lastSideChange>850){if(ref.followSide===1&&b.x>center+margin){ref.followSide=-1;ref.lastSideChange=t}else if(ref.followSide===-1&&b.x<center-margin){ref.followSide=1;ref.lastSideChange=t}}
    let attackDir=0;if(b.owner)attackDir=b.owner.team==='blue'?1:-1;else if(Math.abs(b.vx)>35)attackDir=Math.sign(b.vx);if(!attackDir)attackDir=b.x<center?1:-1;
    const behind=78,lateral=66;
    let desiredX=b.x-attackDir*behind,desiredY=b.y+ref.followSide*lateral;
    const adjusted=crowdAdjustedTarget(desiredX,desiredY,f);desiredX=adjusted.x;desiredY=adjusted.y;
    if(ref.followX==null||ref.followY==null){ref.followX=desiredX;ref.followY=desiredY}
    const alpha=1-Math.exp(-Math.max(.001,dt)/.28);ref.followX+=(desiredX-ref.followX)*alpha;ref.followY+=(desiredY-ref.followY)*alpha;
    return{x:ref.followX,y:ref.followY}
  }
  let last=performance.now();function loop(t){const dt=Math.min(.04,(t-last)/1000||.016);last=t;const f=e.field();let tx,ty;if(ref.target&&ref.state!==STATES.FOLLOWING){tx=ref.target.x;ty=ref.target.y}else{const q=followTarget(f,e.ball,dt,t);tx=q.x;ty=q.y}const dx=tx-ref.x,dy=ty-ref.y,m=Math.hypot(dx,dy);let moveX=0,moveY=0,speed=0;if(m>2){const step=Math.min(m,92*dt),ux=dx/m,uy=dy/m;moveX=ux*step;moveY=uy*step;ref.x+=moveX;ref.y+=moveY;speed=dt>0?step/dt:0}el.style.left=ref.x+'px';el.style.top=ref.y+'px';sprite.updateMotion(moveX,moveY,speed,t);ballContact();requestAnimationFrame(loop)}requestAnimationFrame(loop);
  ref.moveNearCenter=()=>{const f=e.field();ref.target={x:f.w*.5,y:f.h*.58};setState(STATES.APPROACHING)};ref.releaseFollow=()=>{ref.target=null;ref.followX=ref.x;ref.followY=ref.y;setState(STATES.FOLLOWING)};ref.getRecord=p=>record(p);window.FutLiveReferee=ref;
}
boot();
})();