(()=>{'use strict';
const CFG=Object.freeze({
  base:'./assets/referee',
  movementSheet:'./assets/referee/normalized/referee_movement.svg',
  cell:{w:100,h:115,cols:7,rows:4,footX:50,footY:109},
  display:{desktopScale:.68,mobileScale:.67,mobileMaxWidth:390},
  idleSpeed:2.5,
  walkFps:{min:8,normal:9,max:10,normalSpeed:58,maxSpeed:92},
  axisHysteresis:1.30,
  minDirectionHoldMs:320,
  inversionRatio:1.45,
  inversionMinSpeed:42,
  vectorSmoothingMs:190,
  motionDeadZone:.12,
  cardStepMs:260,
  cardHoldMs:620,
  cardFallback:{desktop:{width:46,height:52,scale:1.35,offsetX:-16,offsetY:-23,anchorY:.86},mobile:{width:44,height:50,scale:1.38,offsetX:-15,offsetY:-22,anchorY:.86}},
  hitbox:{offsetX:0,offsetY:-10,rx:7,ry:11},
  avoidance:{radius:27,bodyRadius:9,maxLateral:7.5}
});
const MOVE=Object.freeze({idle_down:[1,2,3,4],walk_down:[5,6,7,8],walk_right:[9,10,11,12,13,14,15,16],walk_up:[17,18,19,20,21,22,23,24],walk_left:[25,26,27,28]});
const CARD=Object.freeze({card_yellow:['card_yellow_01.png','card_yellow_02.png'],card_red:['card_red_01.png','card_red_02.png']});
const cardUrl=name=>`${CFG.base}/${name}`;
class FutLiveRefereeSprite{
  constructor(el){
    this.el=el;this.moveEl=document.createElement('div');this.moveEl.className='referee-movement-sprite';this.cardImg=document.createElement('img');this.cardImg.className='referee-card-sprite';this.cardImg.alt='Árbitro';this.cardImg.draggable=false;this.el.innerHTML='';this.el.appendChild(this.moveEl);this.el.appendChild(this.cardImg);
    this.direction='down';this.pendingDirection=null;this.pendingSince=0;this.lastDirectionAt=performance.now();this.anim='idle_down';this.index=0;this.moving=false;this.lastMotionAt=performance.now();this.smoothDX=0;this.smoothDY=0;this.walkPhase=0;this.lastAnimAt=performance.now();this.cardBusy=false;this.cardAnim=null;this.cardStartedAt=0;this.cardIndex=0;this.available=new Map();
    this.installStyle();this.preload();this.layoutMovement();this.showIdle('down');window.addEventListener('resize',()=>this.layoutMovement(),{passive:true});
  }
  installStyle(){if(document.getElementById('refereeSpriteStyle'))return;const s=document.createElement('style');s.id='refereeSpriteStyle';s.textContent=`.referee-agent{position:absolute;z-index:5;width:0;height:0;pointer-events:none;overflow:visible}.referee-movement-sprite{position:absolute;background-image:url('${CFG.movementSheet}');background-repeat:no-repeat;filter:drop-shadow(0 3px 4px #0008);pointer-events:none;will-change:background-position}.referee-card-sprite{position:absolute;display:none;object-fit:contain;filter:drop-shadow(0 3px 4px #0008);pointer-events:none}`;document.head.appendChild(s)}
  preload(){const sheet=new Image();sheet.onerror=()=>console.warn('[Futlive][RefereeSprite] sprite normalizado ausente:',CFG.movementSheet);sheet.src=CFG.movementSheet;for(const [anim,files] of Object.entries(CARD))for(const f of files){const src=cardUrl(f),i=new Image();i.onload=()=>this.available.set(src,true);i.onerror=()=>{this.available.set(src,false);console.warn('[Futlive][RefereeSprite] frame de cartão ausente:',src,'animação:',anim)};i.src=src}}
  isMobile(){return window.matchMedia(`(max-width:${CFG.display.mobileMaxWidth}px)`).matches}
  movementScale(){return this.isMobile()?CFG.display.mobileScale:CFG.display.desktopScale}
  layoutMovement(){const s=this.movementScale(),c=CFG.cell;this.moveEl.style.width=(c.w*s)+'px';this.moveEl.style.height=(c.h*s)+'px';this.moveEl.style.left=(-c.footX*s)+'px';this.moveEl.style.top=(-c.footY*s)+'px';this.moveEl.style.backgroundSize=(c.w*c.cols*s)+'px '+(c.h*c.rows*s)+'px';if(!this.cardBusy)this.renderMovementFrame(this.currentFrameNumber())}
  currentFrameNumber(){const frames=MOVE[this.anim]||MOVE.idle_down;return frames[Math.max(0,Math.min(frames.length-1,this.index||0))]||frames[0]}
  renderMovementFrame(frameNo){const s=this.movementScale(),c=CFG.cell,n=Math.max(1,Math.min(28,frameNo)),idx=n-1,col=idx%c.cols,row=Math.floor(idx/c.cols);this.moveEl.style.backgroundPosition=(-col*c.w*s)+'px '+(-row*c.h*s)+'px';this.moveEl.dataset.frame=String(n);this.el.dataset.frame=String(n)}
  movementFrames(anim){return MOVE[anim]||MOVE.idle_down}
  walkAnim(dir){return `walk_${dir}`}
  idleFrame(dir){if(dir==='down')return{anim:'idle_down',index:0};return{anim:this.walkAnim(dir),index:0}}
  showMovement(anim,index=0){const frames=this.movementFrames(anim);this.anim=anim;this.index=((index%frames.length)+frames.length)%frames.length;this.cardImg.style.display='none';this.moveEl.style.display='block';this.renderMovementFrame(frames[this.index]);this.el.dataset.anim=anim;this.el.dataset.direction=this.direction}
  showIdle(dir=this.direction){this.moving=false;this.direction=dir||this.direction;this.pendingDirection=null;const f=this.idleFrame(this.direction);this.showMovement(f.anim,f.index);this.lastAnimAt=performance.now()}
  smoothVector(dx,dy,t){const dt=Math.max(1,Math.min(50,t-this.lastMotionAt));this.lastMotionAt=t;const alpha=1-Math.exp(-dt/CFG.vectorSmoothingMs);this.smoothDX+=(dx-this.smoothDX)*alpha;this.smoothDY+=(dy-this.smoothDY)*alpha;return[this.smoothDX,this.smoothDY]}
  chooseDirection(rawDX,rawDY,speed,t){const [dx,dy]=this.smoothVector(rawDX,rawDY,t),ax=Math.abs(dx),ay=Math.abs(dy);if(Math.hypot(dx,dy)<CFG.motionDeadZone)return this.direction;const currentHorizontal=this.direction==='left'||this.direction==='right';if(currentHorizontal&&Math.sign(rawDX)!==0&&((this.direction==='right'&&rawDX<0)||(this.direction==='left'&&rawDX>0))&&Math.abs(rawDX)>Math.abs(rawDY)*CFG.inversionRatio&&speed>=CFG.inversionMinSpeed){this.direction=rawDX>0?'right':'left';this.lastDirectionAt=t;this.pendingDirection=null;return this.direction}if(!currentHorizontal&&Math.sign(rawDY)!==0&&((this.direction==='down'&&rawDY<0)||(this.direction==='up'&&rawDY>0))&&Math.abs(rawDY)>Math.abs(rawDX)*CFG.inversionRatio&&speed>=CFG.inversionMinSpeed){this.direction=rawDY>0?'down':'up';this.lastDirectionAt=t;this.pendingDirection=null;return this.direction}let next=this.direction;if(currentHorizontal){if(ay>ax*CFG.axisHysteresis)next=dy>=0?'down':'up';else if(ax>=ay)next=dx>=0?'right':'left'}else{if(ax>ay*CFG.axisHysteresis)next=dx>=0?'right':'left';else if(ay>=ax)next=dy>=0?'down':'up'}if(next===this.direction){this.pendingDirection=null;return this.direction}if(t-this.lastDirectionAt<CFG.minDirectionHoldMs)return this.direction;if(this.pendingDirection!==next){this.pendingDirection=next;this.pendingSince=t;return this.direction}if(t-this.pendingSince>=CFG.minDirectionHoldMs){this.direction=next;this.lastDirectionAt=t;this.pendingDirection=null}return this.direction}
  fpsForSpeed(speed){const f=CFG.walkFps;if(speed<=f.normalSpeed){const p=Math.max(0,Math.min(1,(speed-CFG.idleSpeed)/(f.normalSpeed-CFG.idleSpeed)));return f.min+(f.normal-f.min)*p}const p=Math.max(0,Math.min(1,(speed-f.normalSpeed)/(f.maxSpeed-f.normalSpeed)));return f.normal+(f.max-f.normal)*p}
  updateMotion(dx,dy,speed,t=performance.now()){if(this.cardBusy){this.updateCard(t);return}const rawMag=Math.hypot(dx,dy);if(speed<=CFG.idleSpeed||rawMag<.01){this.smoothDX*=.88;this.smoothDY*=.88;if(this.moving)this.showIdle(this.direction);this.lastAnimAt=t;return}const dir=this.chooseDirection(dx,dy,speed,t),anim=this.walkAnim(dir),frames=this.movementFrames(anim),fps=this.fpsForSpeed(speed);const elapsed=Math.max(0,Math.min(80,t-this.lastAnimAt));this.lastAnimAt=t;this.walkPhase+=elapsed*fps/1000;const nextIndex=Math.floor(this.walkPhase)%frames.length;this.moving=true;if(this.anim!==anim||this.index!==nextIndex)this.showMovement(anim,nextIndex)}
  safeCardFiles(anim){const files=CARD[anim]||[],ok=files.filter(f=>this.available.get(cardUrl(f))!==false);if(ok.length)return ok;console.warn('[Futlive][RefereeSprite] animação de cartão indisponível:',anim);return[]}
  applyCardLayout(){const c=this.isMobile()?CFG.cardFallback.mobile:CFG.cardFallback.desktop;this.cardImg.style.width=c.width+'px';this.cardImg.style.height=c.height+'px';this.cardImg.style.left=c.offsetX+'px';this.cardImg.style.top=c.offsetY+'px';this.cardImg.style.transform=`scale(${c.scale})`;this.cardImg.style.transformOrigin=`50% ${c.anchorY*100}%`}
  showCard(index){const files=this.safeCardFiles(this.cardAnim);if(!files.length){this.cardBusy=false;this.showIdle(this.direction);return}this.cardIndex=Math.max(0,Math.min(files.length-1,index));this.applyCardLayout();this.moveEl.style.display='none';this.cardImg.style.display='block';const file=files[this.cardIndex],src=cardUrl(file);if(!this.cardImg.src.endsWith(file))this.cardImg.src=src;this.el.dataset.anim=this.cardAnim;this.el.dataset.frame=file}
  playCard(kind){this.cardAnim=kind==='red'?'card_red':'card_yellow';this.cardBusy=true;this.moving=false;this.pendingDirection=null;this.cardStartedAt=performance.now();this.showCard(0)}
  updateCard(t){if(!this.cardBusy)return;const files=this.safeCardFiles(this.cardAnim),elapsed=t-this.cardStartedAt;if(files.length>1&&elapsed>=CFG.cardStepMs&&this.cardIndex!==files.length-1)this.showCard(files.length-1);if(elapsed>=CFG.cardStepMs+CFG.cardHoldMs){this.cardBusy=false;this.cardAnim=null;this.smoothDX=this.smoothDY=0;this.lastMotionAt=t;this.lastAnimAt=t;this.showIdle(this.direction)}}
  getBallHitbox(x,y){return{x:x+CFG.hitbox.offsetX,y:y+CFG.hitbox.offsetY,rx:CFG.hitbox.rx,ry:CFG.hitbox.ry}}
  getAvoidanceConfig(){return CFG.avoidance}
  destroy(){this.cardBusy=false;this.el.innerHTML=''}
}
window.FutLiveRefereeSprite=FutLiveRefereeSprite;window.FutLiveRefereeSpriteConfig={CFG,MOVE,CARD};
})();